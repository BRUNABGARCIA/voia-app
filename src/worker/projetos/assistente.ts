import type { Hono } from 'hono';
import { z } from 'zod';
import { withSession, requireAuth, requireRole, type AuthEnv } from '../auth/middleware';
import { requireProjectAccess } from './acesso';
import { registrarEvento } from './historico';
import { FASES_COMERCIAIS, ESTADOS_DOCUMENTO, dataValida, normalizarNome } from '../../shared/operacao-voia';

const id = z.number().int().positive();
const prazo = z.string().refine(dataValida).nullable().optional();
const dadosTarefa = z.object({ status:z.enum(['pendente','concluida']).optional(), prazo, descricao:z.string().max(2000).nullable().optional(), responsavel_id:id.nullable().optional() }).strict();
const operacao = z.discriminatedUnion('tipo',[
  z.object({tipo:z.literal('projeto'),dados:z.object({fase_comercial:z.enum(FASES_COMERCIAIS).optional(),valor_contratado:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional()}).strict()} ).strict(),
  z.object({tipo:z.literal('tarefa'),id,dados:dadosTarefa}).strict(),
  z.object({tipo:z.literal('criar_tarefa'),dados:dadosTarefa.omit({status:true}).extend({nome:z.string().trim().min(1).max(200)}).strict()}).strict(),
  z.object({tipo:z.literal('documento'),id,dados:z.object({estado_documental:z.enum(ESTADOS_DOCUMENTO)}).strict()}).strict(),
  z.object({tipo:z.literal('criar_documento'),dados:z.object({nome:z.string().trim().min(1).max(200),categoria:z.literal('art_rrt'),estado_documental:z.enum(ESTADOS_DOCUMENTO)}).strict()}).strict(),
]);

export function registrarRotasAssistente(projetos:Hono<AuthEnv>) {
  projetos.post('/:id/assistente/confirmar',withSession,requireAuth,requireRole('administrador','gestor'),requireProjectAccess,async c=>{
    const projetoId=Number(c.req.param('id'));
    const parsed=z.object({confirmado:z.literal(true),operacoes:z.array(operacao).min(1).max(100)}).strict().safeParse(await c.req.json().catch(()=>null));
    if(!parsed.success) return c.json({error:'Confirmação ou alterações inválidas.'},400);
    // Valida TODAS as referências antes da primeira escrita. Reutiliza as
    // rotas operacionais existentes na aplicação, incluindo seu isolamento.
    const tarefas=await c.env.DB.prepare('SELECT id,nome FROM projeto_tarefas WHERE projeto_id=?').bind(projetoId).all<{id:number;nome:string}>();
    const docs=await c.env.DB.prepare('SELECT id,nome,storage_key FROM projeto_documentos WHERE projeto_id=?').bind(projetoId).all<{id:number;nome:string;storage_key:string|null}>();
    const chaves=new Set<string>();
    for(const op of parsed.data.operacoes) {
      if (!Object.keys(op.dados).length) return c.json({error:'Alteração vazia.'},400);
      const chave=op.tipo==='tarefa'||op.tipo==='documento'?`${op.tipo}:${op.id}`:op.tipo==='projeto'?`projeto:${Object.keys(op.dados).sort().join(',')}`:`${op.tipo}:${normalizarNome(op.dados.nome)}`;
      if(op.tipo==='projeto') { for(const campo of Object.keys(op.dados)) {const k=`campo:${campo}`;if(chaves.has(k))return c.json({error:'Mais de uma alteração para o mesmo campo.'},400);chaves.add(k);} }
      if(chaves.has(chave)) return c.json({error:'Alterações duplicadas na revisão.'},400); chaves.add(chave);
      if(op.tipo==='tarefa'&&!tarefas.results.some(t=>t.id===op.id) || op.tipo==='documento'&&!docs.results.some(d=>d.id===op.id)) return c.json({error:'Registro não encontrado neste projeto. Revise a seleção.'},400);
      if(op.tipo==='criar_tarefa'&&tarefas.results.some(t=>normalizarNome(t.nome)===normalizarNome(op.dados.nome)) || op.tipo==='criar_documento'&&docs.results.some(d=>normalizarNome(d.nome)===normalizarNome(op.dados.nome))) return c.json({error:'Já existe um registro correspondente. Analise novamente para atualizá-lo.'},409);
      if(op.tipo==='documento'&&['anexado'].includes(op.dados.estado_documental)&&!docs.results.find(d=>d.id===op.id)?.storage_key || op.tipo==='criar_documento'&&['anexado'].includes(op.dados.estado_documental)) return c.json({error:'Arquivo ausente; não é possível marcar como anexado.'},400);
      if((op.tipo==='tarefa'||op.tipo==='criar_tarefa')&&op.dados.responsavel_id) {
        const usuario=await c.env.DB.prepare('SELECT id FROM usuarios WHERE id=? AND ativo=1').bind(op.dados.responsavel_id).first();
        if(!usuario) return c.json({error:'Responsável inexistente ou inativo.'},400);
        const membro=await c.env.DB.prepare("SELECT u.id FROM usuarios u WHERE u.id=? AND (u.perfil IN ('administrador','gestor') OR EXISTS(SELECT 1 FROM projeto_membros m WHERE m.projeto_id=? AND m.usuario_id=u.id))").bind(op.dados.responsavel_id,projetoId).first();
        if(!membro) return c.json({error:'Responsável não pertence à equipe do projeto.'},400);
      }
    }
    const aplicadas:number[]=[];
    for(const [indice,op] of parsed.data.operacoes.entries()) {
      let path=`/${projetoId}`, method='PATCH'; let body: string|FormData=JSON.stringify(op.dados);
      if(op.tipo==='tarefa') path+=`/tarefas/${op.id}`;
      if(op.tipo==='documento') path+=`/documentos/${op.id}`;
      if(op.tipo==='criar_tarefa') {path+='/tarefas';method='POST';body=JSON.stringify({...op.dados,status:'pendente',visivel_cliente:false});}
      if(op.tipo==='criar_documento') {path+='/documentos';method='POST';const f=new FormData();for(const [k,v] of Object.entries(op.dados))f.set(k,String(v));f.set('esperado','true');f.set('visivel_cliente','false');f.set('visivel_parceiro','false');body=f;}
      try {
        const res=await projetos.request(path,{method,headers:{cookie:c.req.header('cookie')||'',...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body},c.env);
        if(!res.ok) {const d=await res.json().catch(()=>null) as {error?:string}|null; return c.json({error:d?.error||'Falha ao aplicar alteração.',aplicadas,falhou:indice},409);}
        aplicadas.push(indice);
        await registrarEvento(c.env.DB,{projetoId,tipo:'sistema',tipoEvento:'assistente_voia_confirmado',entidadeTipo:'projeto',entidadeId:projetoId,titulo:'Atualização confirmada pelo Assistente VOIA',descricao:`Alteração ${op.tipo}; campos: ${Object.keys(op.dados).join(', ')}.`,usuarioId:c.get('user')!.id,visivelCliente:false});
      } catch {return c.json({error:'Falha ao salvar alteração ou histórico. Confira o projeto antes de repetir.',aplicadas,falhou:indice},409);}
    }
    return c.json({aplicadas});
  });
}

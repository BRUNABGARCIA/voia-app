import type {Context,Hono} from 'hono';
import {z} from 'zod';
import type {AuthEnv} from '../auth/middleware';
import type {Planilha} from '../../shared/planilhas';
import {pedidoSolicitacaoSchema,reconstruirDocumento,temPendencias,type DocumentoExterno} from '../../shared/solicitacoes-proposta';

type Row={id:number;requisicao_hash:string;planilha_id:number;versao:number;itens_origem:string;documento:string;emitida_em:string;status:string;motivo_cancelamento:string|null};
const resposta=(r:Row)=>({id:r.id,status:r.status,motivo_cancelamento:r.motivo_cancelamento,publicacao:{numero:`SP-${r.emitida_em.slice(0,4)}-${String(r.id).padStart(4,'0')}`,emitida_em:r.emitida_em,documento:JSON.parse(r.documento) as DocumentoExterno}});
/** Registered on the existing planilhas router, behind its auth, role, body and obra access middleware. */
export function registrarSolicitacoes(routes:Hono<AuthEnv>,ler:(c:Context<AuthEnv>,id:number)=>Promise<Planilha|null>){
 const base='/:id/planilhas/:planilha/solicitacoes';
 routes.post(base+'/revisao',async c=>{
  const p=await ler(c,Number(c.req.param('planilha')));if(!p)return c.json({error:'Planilha não encontrada.'},404);
  const b=pedidoSolicitacaoSchema.safeParse(await c.req.json().catch(()=>null));if(!b.success)return c.json({error:'Revise os campos da solicitação.'},400);
  if(b.data.versao!==p.versao)return c.json({error:'A planilha mudou. Reabra a planilha e faça uma nova revisão.'},409);
  const obra=await c.env.DB.prepare('SELECT o.nome AS obra,p.nome AS projeto,c.nome AS cliente,o.endereco FROM obras o JOIN projetos p ON p.id=o.projeto_id JOIN clientes c ON c.id=p.cliente_id WHERE o.id=?').bind(p.obra_id).first<{obra:string;projeto:string;cliente:string;endereco:string|null}>();
  try{const documento=reconstruirDocumento(p,b.data,obra!);return c.json({documento,itens:p.itens.flatMap(i=>b.data.itens.filter(e=>e.id===i.id)),versao:p.versao});}catch(e){return c.json({error:(e as Error).message},400);}
 });
 routes.post(base,async c=>{
  const p=await ler(c,Number(c.req.param('planilha')));if(!p)return c.json({error:'Planilha não encontrada.'},404);
  const b=pedidoSolicitacaoSchema.safeParse(await c.req.json().catch(()=>null));if(!b.success)return c.json({error:'Revise os campos da solicitação.'},400);
  // A retry must match the original intent, even when the worksheet changed later.
  const canonical={...b.data,itens:[...b.data.itens].sort((a,b)=>a.id.localeCompare(b.id))};
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical)));
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const anterior=await c.env.DB.prepare('SELECT * FROM obra_solicitacoes_proposta WHERE chave=? AND planilha_id=?').bind(b.data.chave,p.id).first<Row>();if(anterior)return anterior.requisicao_hash===hash?c.json(resposta(anterior)):c.json({error:'Esta tentativa já foi emitida com outro conteúdo. Abra o histórico ou inicie nova revisão.'},409);
  if(b.data.versao!==p.versao)return c.json({error:'A planilha mudou. Reabra a planilha e faça uma nova revisão.'},409);
  const obra=await c.env.DB.prepare('SELECT o.nome AS obra,p.nome AS projeto,c.nome AS cliente,o.endereco FROM obras o JOIN projetos p ON p.id=o.projeto_id JOIN clientes c ON c.id=p.cliente_id WHERE o.id=?').bind(p.obra_id).first<{obra:string;projeto:string;cliente:string;endereco:string|null}>();
  let documento:DocumentoExterno;try{documento=reconstruirDocumento(p,b.data,obra!);}catch(e){return c.json({error:(e as Error).message},400);}
  if(temPendencias(documento)&&!b.data.aceitar_pendencias)return c.json({error:'Confirme explicitamente a emissão sem quantidade/unidade ou corrija a planilha.'},400);
  const json=JSON.stringify(documento);if(new TextEncoder().encode(json).length>1_400_000)return c.json({error:'Solicitação muito extensa. Divida a seleção em mais de uma emissão.'},413);
  const row=await c.env.DB.prepare(`INSERT INTO obra_solicitacoes_proposta(chave,requisicao_hash,planilha_id,versao,itens_origem,documento,criada_por,emitida_em)
   SELECT ?,?,id,versao,?,?,?,? FROM obra_planilhas WHERE id=? AND obra_id=? AND versao=? ON CONFLICT(chave) DO NOTHING RETURNING *`).bind(b.data.chave,hash,JSON.stringify(p.itens.filter(i=>b.data.itens.some(e=>e.id===i.id)).map(i=>i.id)),json,c.get('user')!.id,new Date().toISOString(),p.id,p.obra_id,p.versao).first<Row>();
  if(!row){const retry=await c.env.DB.prepare('SELECT * FROM obra_solicitacoes_proposta WHERE chave=? AND planilha_id=? AND requisicao_hash=?').bind(b.data.chave,p.id,hash).first<Row>();return retry?c.json(resposta(retry)):c.json({error:'A planilha mudou ou a tentativa já foi utilizada. Faça uma nova revisão.'},409);}
  return c.json(resposta(row),201);
 });
 routes.get(base,async c=>{
  const p=await ler(c,Number(c.req.param('planilha')));if(!p)return c.json({error:'Planilha não encontrada.'},404);
  const rows=await c.env.DB.prepare('SELECT id,emitida_em,status,json_extract(documento,\'$.titulo\') AS titulo FROM obra_solicitacoes_proposta WHERE planilha_id=? ORDER BY id DESC').bind(p.id).all();return c.json({solicitacoes:rows.results});
 });
 routes.get(base+'/:solicitacao',async c=>{
  const p=await ler(c,Number(c.req.param('planilha')));if(!p)return c.json({error:'Planilha não encontrada.'},404);
  const row=await c.env.DB.prepare('SELECT * FROM obra_solicitacoes_proposta WHERE id=? AND planilha_id=?').bind(Number(c.req.param('solicitacao')),p.id).first<Row>();return row?c.json(resposta(row)):c.json({error:'Solicitação não encontrada.'},404);
 });
 routes.post(base+'/:solicitacao/duplicar',async c=>{
  const p=await ler(c,Number(c.req.param('planilha')));if(!p)return c.json({error:'Planilha não encontrada.'},404);
  const row=await c.env.DB.prepare('SELECT * FROM obra_solicitacoes_proposta WHERE id=? AND planilha_id=?').bind(Number(c.req.param('solicitacao')),p.id).first<Row>();if(!row)return c.json({error:'Solicitação não encontrada.'},404);
  const doc=JSON.parse(row.documento) as DocumentoExterno,ids=JSON.parse(row.itens_origem) as string[];
  if(ids.some(id=>!p.itens.some(i=>i.id===id)))return c.json({error:'Itens removidos da planilha. Selecione novamente os serviços para uma nova solicitação.'},409);
  const editaveis={titulo:doc.titulo,escopo:doc.escopo,prazo:doc.prazo,destinatario:doc.destinatario,contato:doc.contato,telefone:doc.telefone,email:doc.email,observacoes:doc.observacoes,condicoes:doc.condicoes,incluir_cliente:!!doc.cliente};
  const pedido={chave:crypto.randomUUID(),versao:p.versao,dados:editaveis,itens:ids.map((id,n)=>({id,escopo:doc.itens[n].escopo,observacao:doc.itens[n].observacao})),aceitar_pendencias:false};
  // Source order can change; pair legacy rows by stable code instead of the current order.
  pedido.itens=ids.map(id=>{const item=p.itens.find(i=>i.id===id)!;const old=doc.itens.find(i=>i.codigo===item.codigo)!;return {id,escopo:old.escopo,observacao:old.observacao};});
  return c.json({pedido,documento:reconstruirDocumento(p,pedido, {obra:doc.obra,projeto:doc.projeto,cliente:doc.cliente,endereco:doc.endereco}),aviso:'Novo rascunho com os dados atuais da planilha. Revise antes de emitir.'});
 });
 routes.post(base+'/:solicitacao/cancelar',async c=>{
  const p=await ler(c,Number(c.req.param('planilha')));if(!p)return c.json({error:'Planilha não encontrada.'},404);
  const b=z.object({motivo:z.string().trim().min(1).max(1000)}).strict().safeParse(await c.req.json().catch(()=>null));if(!b.success)return c.json({error:'Informe o motivo do cancelamento.'},400);
  const row=await c.env.DB.prepare("UPDATE obra_solicitacoes_proposta SET status='cancelada',cancelada_em=?,cancelada_por=?,motivo_cancelamento=? WHERE id=? AND planilha_id=? AND status='emitida' RETURNING *").bind(new Date().toISOString(),c.get('user')!.id,b.data.motivo,Number(c.req.param('solicitacao')),p.id).first<Row>();return row?c.json(resposta(row)):c.json({error:'Solicitação não encontrada ou já cancelada.'},409);
 });
}

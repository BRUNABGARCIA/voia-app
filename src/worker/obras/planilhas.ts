import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { withSession, requireAuth, requireRole, type AuthEnv } from '../auth/middleware';
import { requireObraAccess } from './acesso';
import { normalizarBusca, referenciaOrigemSchema, planilhaConteudoSchema, type ConteudoPlanilha, type ItemPlanilha, type Planilha } from '../../shared/planilhas';
import { referenciaCatalogo } from '../bases/catalogo';
import { itemDoCatalogo,referenciaTecnica,regimeValido } from '../../shared/bases-servicos';

const routes=new Hono<AuthEnv>();
routes.use('/biblioteca-planilhas',withSession,requireAuth,requireRole('administrador','gestor'));
routes.use('/:id/planilhas',withSession,requireAuth,requireRole('administrador','gestor'));
routes.use('/:id/planilhas/*',withSession,requireAuth,requireRole('administrador','gestor'));
const limite=bodyLimit({maxSize:1_500_000,onError:c=>c.json({error:'Conteúdo excede 1,5 MB. Reduza o lote; o rascunho foi preservado.'},413)});
routes.use('/biblioteca-planilhas',limite);
routes.use('/:id/planilhas',limite);
routes.use('/:id/planilhas/*',limite);
routes.use('/:id/planilhas',requireObraAccess);
routes.use('/:id/planilhas/*',requireObraAccess);
routes.onError((e,c)=>{console.error('Falha em Planilhas',e);return c.json({error:'Não foi possível concluir a operação. Preserve o rascunho e tente novamente.'},500);});
type Cabecalho=Omit<Planilha,'itens'|'grupos'|'somente_mao_de_obra'>&{somente_mao_de_obra:number|null};
async function ler(c:Context<AuthEnv>,id:number):Promise<Planilha|null>{
  const p=await c.env.DB.prepare('SELECT id,obra_id,nome,tipo,descricao,status,somente_mao_de_obra,versao,criada_em,atualizada_em FROM obra_planilhas WHERE id=? AND obra_id=?').bind(id,Number(c.req.param('id'))).first<Cabecalho>();
  if(!p)return null;
  const [g,i]=await Promise.all([
    c.env.DB.prepare('SELECT codigo,nome FROM obra_planilha_grupos WHERE planilha_id=? ORDER BY ordem').bind(id).all<{codigo:string;nome:string}>(),
    c.env.DB.prepare('SELECT dados FROM obra_planilha_itens WHERE planilha_id=? AND ativo=1 ORDER BY ordem').bind(id).all<{dados:string}>(),
  ]);
  return {...p,somente_mao_de_obra:p.somente_mao_de_obra===null?null:!!p.somente_mao_de_obra,grupos:g.results,itens:i.results.map(i=>JSON.parse(i.dados) as ItemPlanilha)};
}
async function preparar(c:Context<AuthEnv>,p:ConteudoPlanilha,id?:number){
  const antigos=id?(await c.env.DB.prepare('SELECT id,codigo,dados FROM obra_planilha_itens WHERE planilha_id=?').bind(id).all<{id:string;codigo:string;dados:string}>()).results:[];
  const mapa=new Map(antigos.map(i=>[i.id,i.codigo])),ocupados=new Set(antigos.map(i=>i.codigo));
  const proximos:Record<string,number>={};
  for(const i of antigos){const [g,n]=i.codigo.split('.');proximos[g]=Math.max(proximos[g]??0,Number(n));}
  // IDs belong to exactly one sheet, including archived/deleted rows.
  if(p.itens.length){
    const outros=await c.env.DB.prepare('SELECT id,planilha_id FROM obra_planilha_itens WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(p.itens.map(i=>i.id))).all<{id:string;planilha_id:number}>();
    if(outros.results.some(i=>i.planilha_id!==id))throw new Error('ID de item pertence a outra planilha.');
  }
  const biblioteca=p.itens.flatMap(i=>i.biblioteca_id===null||mapa.has(i.id)||i.referencia_origem?[]:[i.biblioteca_id]);
  if(biblioteca.length){const {results}=await c.env.DB.prepare('SELECT id FROM voia_biblioteca_servicos WHERE id IN (SELECT value FROM json_each(?)) AND ativo=1').bind(JSON.stringify(biblioteca)).all<{id:number}>();const permitidos=new Set(results.map(s=>s.id));if(biblioteca.some(i=>!permitidos.has(i)))throw new Error('Serviço de biblioteca inválido.');}
  const cacheReferencias=new Map<string,Awaited<ReturnType<typeof referenciaCatalogo>>>();
  for(const i of p.itens){
    const anterior=antigos.find(a=>a.id===i.id);const historico=anterior?JSON.parse(anterior.dados) as ItemPlanilha:null;
    if(i.referencia_origem&&!regimeValido(i.referencia_origem))throw Error('Preço selecionado incompatível com o regime.');
    if(historico){if(JSON.stringify(historico.referencia_origem?referenciaTecnica(referenciaOrigemSchema.parse(historico.referencia_origem)):null)!==JSON.stringify(i.referencia_origem?referenciaTecnica(i.referencia_origem):null)||historico.biblioteca_id!==i.biblioteca_id)throw Error('Referência original do item é imutável.');continue;}
    const ref=i.referencia_origem;
    if(ref||i.biblioteca_id!==null){
      const fonte=ref?.fonte??'biblioteca',sourceId=ref?.item_id??i.biblioteca_id!,key=fonte+sourceId;
      if(!cacheReferencias.has(key))cacheReferencias.set(key,await referenciaCatalogo(c.env.DB,fonte,sourceId));const original=cacheReferencias.get(key);
      if((fonte==='biblioteca'?sourceId:null)!==i.biblioteca_id)throw Error('Referência incompatível com o item.');
      const snapshot=original?itemDoCatalogo(original,i.grupo).referencia_origem!:null;
      if(ref&&(!snapshot||JSON.stringify(referenciaTecnica(ref))!==JSON.stringify(referenciaTecnica(snapshot)))){
        // Duplicating a real historical worksheet must retain its old reference, including inactive editions.
        const historica=await c.env.DB.prepare("SELECT id FROM obra_planilha_itens WHERE json_remove(json_extract(dados,'$.referencia_origem'),'$.regime_escolhido','$.preco_referencia_centavos')=? LIMIT 1").bind(JSON.stringify(referenciaTecnica(ref))).first();
        if(!historica)throw Error('A referência mudou ou foi alterada. Pesquise e selecione novamente.');continue;
      }
      if(!snapshot)throw Error('Referência ativa não encontrada.');i.referencia_origem=ref?{...snapshot,...(ref.regime_escolhido!==undefined?{regime_escolhido:ref.regime_escolhido,preco_referencia_centavos:ref.preco_referencia_centavos}: {})}:snapshot;
    }
  }
  // Reserve explicitly imported codes before allocating blanks; never renumber existing identities.
  for(const i of p.itens){const anterior=mapa.get(i.id);if(anterior&&anterior!==i.codigo)throw new Error('Código histórico não pode ser alterado.');if(!anterior&&i.codigo){if(ocupados.has(i.codigo))throw new Error('Código já utilizado nesta planilha.');ocupados.add(i.codigo);proximos[i.grupo]=Math.max(proximos[i.grupo]??0,Number(i.codigo.split('.')[1]));}}
  for(const i of p.itens)if(!i.codigo){const n=(proximos[i.grupo]??0)+1;if(n>999999)throw new Error('Limite de códigos atingido.');proximos[i.grupo]=n;i.codigo=`${i.grupo}.${String(n).padStart(2,'0')}`;}
  return p;
}
function escritas(c:Context<AuthEnv>,p:ConteudoPlanilha,id:number,token:string){
  // Every mutation is gated by the successful optimistic claim. A stale batch does no writes.
  const gate='EXISTS(SELECT 1 FROM obra_planilhas WHERE id=? AND operacao=?)';
  return [
    c.env.DB.prepare(`DELETE FROM obra_planilha_grupos WHERE planilha_id=? AND ${gate}`).bind(id,id,token),
    c.env.DB.prepare(`INSERT INTO obra_planilha_grupos(planilha_id,codigo,nome,ordem) SELECT ?,json_extract(value,'$.codigo'),json_extract(value,'$.nome'),CAST(key AS INTEGER) FROM json_each(?) WHERE ${gate}`).bind(id,JSON.stringify(p.grupos),id,token),
    c.env.DB.prepare(`UPDATE obra_planilha_itens SET ativo=0 WHERE planilha_id=? AND ${gate}`).bind(id,id,token),
    c.env.DB.prepare(`INSERT INTO obra_planilha_itens(id,planilha_id,codigo,grupo,ordem,ativo,biblioteca_id,quantidade,valor_unit_centavos,memoria,dados)
      SELECT json_extract(value,'$.id'),?,json_extract(value,'$.codigo'),json_extract(value,'$.grupo'),CAST(key AS INTEGER),1,json_extract(value,'$.biblioteca_id'),json_extract(value,'$.quantidade'),json_extract(value,'$.valor_unit_centavos'),json_extract(value,'$.memoria'),value FROM json_each(?) WHERE ${gate}
      ON CONFLICT(id) DO UPDATE SET ordem=excluded.ordem,ativo=1,biblioteca_id=excluded.biblioteca_id,quantidade=excluded.quantidade,valor_unit_centavos=excluded.valor_unit_centavos,memoria=excluded.memoria,dados=excluded.dados WHERE obra_planilha_itens.planilha_id=excluded.planilha_id AND obra_planilha_itens.codigo=excluded.codigo`).bind(id,JSON.stringify(p.itens),id,token),
    c.env.DB.prepare(`INSERT INTO obra_planilha_snapshots(id,planilha_id,versao,finalidade,dados,criada_por) SELECT ?,id,versao,'salvamento',?,? FROM obra_planilhas WHERE id=? AND operacao=?`).bind(crypto.randomUUID(),JSON.stringify(p),c.get('user')!.id,id,token),
  ];
}
routes.get('/biblioteca-planilhas',async c=>{
  const [servicos,modelos]=await Promise.all([c.env.DB.prepare('SELECT * FROM voia_biblioteca_servicos WHERE ativo=1 ORDER BY grupo,nome').all(),c.env.DB.prepare('SELECT * FROM voia_planilha_modelos WHERE ativo=1').all()]);
  return c.json({servicos:servicos.results,modelos:modelos.results});
});
const servicoSchema=z.object({nome:z.string().trim().min(1).max(300),grupo:z.string().regex(/^\d{2}$/),categoria:z.string().max(150),subcategoria:z.string().max(150),unidade:z.string().max(30),descricao:z.string().max(5000),escopo:z.string().max(8000),tags:z.string().max(500),observacoes:z.string().max(8000)}).strict();
routes.post('/biblioteca-planilhas',requireRole('administrador'),async c=>{
  const p=servicoSchema.safeParse(await c.req.json().catch(()=>null));if(!p.success)return c.json({error:'Serviço inválido.'},400);
  const v=p.data,codigo="VOIA-"+crypto.randomUUID();const row=await c.env.DB.prepare(`INSERT INTO voia_biblioteca_servicos(codigo,nome,grupo,categoria,subcategoria,unidade,descricao,escopo,tags,observacoes,origem,criada_por,busca_normalizada) VALUES(?,?,?,?,?,?,?,?,?,?,'Cadastro explícito VOIA',?,?) RETURNING *`).bind(codigo,v.nome,v.grupo,v.categoria,v.subcategoria,v.unidade,v.descricao,v.escopo,v.tags,v.observacoes,c.get('user')!.id,normalizarBusca([codigo,v.nome,v.descricao,v.escopo,v.categoria,v.subcategoria,v.tags].join(' '))).first();return c.json({servico:row},201);
});
routes.get('/:id/planilhas',async c=>{const {results}=await c.env.DB.prepare('SELECT id,nome,tipo,status,versao,atualizada_em,(SELECT COUNT(*) FROM obra_planilha_itens i WHERE i.planilha_id=p.id AND i.ativo=1) AS itens_total FROM obra_planilhas p WHERE obra_id=? ORDER BY atualizada_em DESC,id DESC').bind(Number(c.req.param('id'))).all();return c.json({planilhas:results});});
routes.get('/:id/planilhas/:planilha',async c=>{const p=await ler(c,Number(c.req.param('planilha')));return p?c.json({planilha:p}):c.json({error:'Planilha não encontrada.'},404);});
routes.post('/:id/planilhas',async c=>{
  const parsed=planilhaConteudoSchema.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({error:'Planilha inválida.',detalhes:parsed.error.issues.map(i=>i.message)},400);
  let p:ConteudoPlanilha;try{p=await preparar(c,parsed.data);}catch(e){return c.json({error:(e as Error).message},400);}
  const token=crypto.randomUUID();
  // Creation and initial contents are atomic; last_insert_rowid cannot be used across this batch's other inserts.
  const max=await c.env.DB.prepare('SELECT COALESCE(MAX(id),0)+1 AS id FROM obra_planilhas').first<{id:number}>();
  const id=max!.id;
  try{await c.env.DB.batch([c.env.DB.prepare('INSERT INTO obra_planilhas(id,obra_id,nome,tipo,descricao,status,somente_mao_de_obra,operacao,criada_por) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,Number(c.req.param('id')),p.nome,p.tipo,p.descricao,p.status,p.somente_mao_de_obra===null?null:Number(p.somente_mao_de_obra),token,c.get('user')!.id),...escritas(c,p,id,token)]);}catch(e){console.error('Falha ao criar planilha',e);return c.json({error:'Não foi possível criar. Tente novamente; nada foi salvo parcialmente.'},409);}
  return c.json({planilha:await ler(c,id)},201);
});
routes.put('/:id/planilhas/:planilha',async c=>{
  const id=Number(c.req.param('planilha')),atual=await ler(c,id);if(!atual)return c.json({error:'Planilha não encontrada.'},404);
  const parsed=z.object({versao:z.number().int().positive(),conteudo:planilhaConteudoSchema}).strict().safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({error:'Conteúdo inválido.',detalhes:parsed.error.issues.map(i=>i.message)},400);
  if(parsed.data.versao!==atual.versao)return c.json({error:'Outra sessão alterou a planilha. Seu rascunho foi preservado; reabra e concilie as alterações.'},409);
  let p:ConteudoPlanilha;try{p=await preparar(c,parsed.data.conteudo,id);}catch(e){return c.json({error:(e as Error).message},400);}
  const token=crypto.randomUUID();
  const res=await c.env.DB.batch([c.env.DB.prepare('UPDATE obra_planilhas SET nome=?,tipo=?,descricao=?,status=?,somente_mao_de_obra=?,versao=versao+1,operacao=?,atualizada_em=CURRENT_TIMESTAMP WHERE id=? AND obra_id=? AND versao=?').bind(p.nome,p.tipo,p.descricao,p.status,p.somente_mao_de_obra===null?null:Number(p.somente_mao_de_obra),token,id,atual.obra_id,parsed.data.versao),...escritas(c,p,id,token)]);
  if(!res[0].meta.changes)return c.json({error:'Conflito de versão. Rascunho preservado.'},409);
  return c.json({planilha:await ler(c,id)});
});
routes.post('/:id/planilhas/:planilha/snapshots',async c=>{
  const p=await ler(c,Number(c.req.param('planilha')));if(!p)return c.json({error:'Planilha não encontrada.'},404);
  const body=z.object({versao:z.number().int(),itens:z.array(z.string().uuid()).min(1).max(2000),finalidade:z.enum(['quantitativo_xlsx','solicitacao'])}).strict().safeParse(await c.req.json().catch(()=>null));
  if(!body.success)return c.json({error:'Seleção inválida.'},400);
  if(body.data.versao!==p.versao)return c.json({error:'Versão mudou. Salve e gere novamente.'},409);
  const ids=new Set(body.data.itens);if(ids.size!==body.data.itens.length||p.itens.filter(i=>ids.has(i.id)).length!==ids.size)return c.json({error:'Item fora da planilha ou duplicado.'},400);
  const snapshot={...p,itens:p.itens.filter(i=>ids.has(i.id))},id=crypto.randomUUID();
  const res=await c.env.DB.prepare('INSERT INTO obra_planilha_snapshots(id,planilha_id,versao,finalidade,dados,criada_por) SELECT ?,id,versao,?,?,? FROM obra_planilhas WHERE id=? AND versao=?').bind(id,body.data.finalidade,JSON.stringify(snapshot),c.get('user')!.id,p.id,body.data.versao).run();
  if(!res.meta.changes)return c.json({error:'Versão mudou. Salve e gere novamente.'},409);return c.json({id,snapshot},201);
});
routes.get('/:id/planilhas/:planilha/snapshots/:snapshot',async c=>{
  const p=await ler(c,Number(c.req.param('planilha')));if(!p)return c.json({error:'Planilha não encontrada.'},404);
  const row=await c.env.DB.prepare('SELECT id,versao,finalidade,dados,criada_em FROM obra_planilha_snapshots WHERE id=? AND planilha_id=?').bind(c.req.param('snapshot'),p.id).first<{dados:string}>();return row?c.json({...row,snapshot:JSON.parse(row.dados),dados:undefined}):c.json({error:'Snapshot não encontrado.'},404);
});
export default routes;

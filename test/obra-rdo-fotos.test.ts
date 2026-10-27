import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import app from '../src/worker/index';
import { criarCliente, criarProjeto, criarUsuario, vincularMembro } from './helpers/fixtures';
import { extrairCookie, jsonRequest } from './helpers/http';
import { SESSION_COOKIE_NAME } from '../src/worker/auth/session';
const png=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0x0d,0x49,0x48,0x44,0x52]);
async function contexto(s:string){
  const admin=await criarUsuario(`rdo-fotos-admin-${s}@voia.local`,'administrador'),parceiro=await criarUsuario(`rdo-fotos-parceiro-${s}@voia.local`,'colaborador');
  async function login(email:string){const r=await app.request('/api/auth/login',jsonRequest('POST',{email,senha:'senha-padrao-teste'}),env);return extrairCookie(r,SESSION_COOKIE_NAME)!;}
  const cookie=await login(`rdo-fotos-admin-${s}@voia.local`),cookieParceiro=await login(`rdo-fotos-parceiro-${s}@voia.local`);
  const cliente=await criarCliente('Sintético '+s),p1=await criarProjeto(cliente,admin,'Projeto A '+s),p2=await criarProjeto(cliente,admin,'Projeto B '+s);await vincularMembro(p1,parceiro);
  async function obra(p:number){const r=await app.request('/api/obras',jsonRequest('POST',{projeto_id:p,nome:'Obra sintética'},cookie),env);return (await r.json<{obra:{id:number}}>()).obra.id;}
  const a=await obra(p1),b=await obra(p2);
  async function rdo(obra:number,data:string){const r=await app.request(`/api/obras/${obra}/rdo`,jsonRequest('POST',{data,servicos_executados:'Serviço informado'},cookie),env);return (await r.json<{rdo:{id:number}}>()).rdo.id;}
  const ra=await rdo(a,'2026-10-26'),ra2=await rdo(a,'2026-10-27'),rb=await rdo(b,'2026-10-26');
  const get=(path:string,auth=cookie)=>app.request(path,{headers:{cookie:auth}},env);
  function upload(obra:number,rdo?:number,auth=cookie){const f=new FormData();f.set('arquivo',new File([png],'execucao.png',{type:'image/png'}));f.set('legenda','Concretagem');f.set('data','2000-01-01');if(rdo!==undefined)f.set('rdo_id',String(rdo));return app.request(`/api/obras/${obra}/fotos`,{method:'POST',headers:{cookie:auth},body:f},env);}
  return {a,b,ra,ra2,rb,cookie,cookieParceiro,get,upload};
}
it('foto vinculada usa data server-side do RDO, mesmo registro/R2 no diário e galeria, sem migration',async()=>{
  const c=await contexto('vinculo');const r=await c.upload(c.a,c.ra);expect(r.status).toBe(201);const {foto}=await r.json<{foto:{id:number;rdo_id:number;data:string;legenda:string}}>();expect(foto).toMatchObject({rdo_id:c.ra,data:'2026-10-26',legenda:'Concretagem'});
  const vinculadas=await (await c.get(`/api/obras/${c.a}/fotos?rdo_id=${c.ra}`)).json<{fotos:{id:number}[]}>(),galeria=await (await c.get(`/api/obras/${c.a}/fotos`)).json<{fotos:{id:number}[]}>();expect(vinculadas.fotos.map(f=>f.id)).toEqual([foto.id]);expect(galeria.fotos.map(f=>f.id)).toEqual([foto.id]);
  const row=await env.DB.prepare('SELECT storage_key FROM obra_fotos WHERE id=?').bind(foto.id).first<{storage_key:string}>();expect(await env.DOCUMENTOS_BUCKET.head(row!.storage_key)).not.toBeNull();expect((await c.get(`/api/obras/${c.a}/fotos/${foto.id}/arquivo?rdo_id=${c.ra}`)).status).toBe(200);
  const {rdos}=await (await c.get(`/api/obras/${c.a}/rdo`)).json<{rdos:{id:number;fotos_total:number}[]}>();expect(rdos.find(r=>r.id===c.ra)?.fotos_total).toBe(1);
});
it('filtra por identidade de RDO; dois RDOs não misturam fotos nem com mesma data',async()=>{
  const c=await contexto('filtro');await app.request(`/api/obras/${c.a}/rdo/${c.ra2}`,jsonRequest('PATCH',{data:'2026-10-26'},c.cookie),env);await c.upload(c.a,c.ra);const r=await c.get(`/api/obras/${c.a}/fotos?rdo_id=${c.ra2}`);expect(await r.json()).toEqual({fotos:[]});
});
it('rejeita upload vinculado a RDO de outra obra antes de criar foto ou objeto',async()=>{
  const c=await contexto('upload-idor'),antes=(await env.DOCUMENTOS_BUCKET.list()).objects.length;expect((await c.upload(c.a,c.rb)).status).toBe(400);expect((await env.DOCUMENTOS_BUCKET.list()).objects.length).toBe(antes);expect(await env.DB.prepare('SELECT id FROM obra_fotos WHERE obra_id=?').bind(c.a).first()).toBeNull();
});
it('parceiro não lista nem lê arquivo de outra obra via RDO ou trocando o path',async()=>{
  const c=await contexto('leitura-idor'),{foto}=await (await c.upload(c.b,c.rb)).json<{foto:{id:number}}>();
  for(const path of [`/api/obras/${c.b}/fotos?rdo_id=${c.rb}`,`/api/obras/${c.a}/fotos?rdo_id=${c.rb}`,`/api/obras/${c.a}/fotos/${foto.id}/arquivo?rdo_id=${c.ra}`,`/api/obras/${c.b}/fotos/${foto.id}/arquivo?rdo_id=${c.rb}`])expect((await c.get(path,c.cookieParceiro)).status).toBe(404);
});
it('escopo do RDO protege arquivo e exclusão inclusive entre RDOs da mesma obra',async()=>{
  const c=await contexto('arquivo-escopo'),{foto}=await (await c.upload(c.a,c.ra)).json<{foto:{id:number}}>();expect((await c.get(`/api/obras/${c.a}/fotos/${foto.id}/arquivo?rdo_id=${c.ra2}`)).status).toBe(404);
  expect((await app.request(`/api/obras/${c.a}/fotos/${foto.id}?rdo_id=${c.ra2}`,{method:'DELETE',headers:{cookie:c.cookie}},env)).status).toBe(404);expect((await c.get(`/api/obras/${c.a}/fotos/${foto.id}/arquivo`)).status).toBe(200);
});
it('fotos antigas sem RDO continuam na galeria e fora do diário, sem reatribuição',async()=>{
  const c=await contexto('legado'),{foto}=await (await c.upload(c.a)).json<{foto:{id:number;rdo_id:null;data:string}}>();expect(foto).toMatchObject({rdo_id:null,data:'2000-01-01'});expect((await (await c.get(`/api/obras/${c.a}/fotos`)).json<{fotos:unknown[]}>()).fotos).toHaveLength(1);expect(await (await c.get(`/api/obras/${c.a}/fotos?rdo_id=${c.ra}`)).json()).toEqual({fotos:[]});
});
it('alterar data do RDO sincroniza fotos associadas e preserva galeria antiga',async()=>{
  const c=await contexto('data');await c.upload(c.a,c.ra);await c.upload(c.a);const r=await app.request(`/api/obras/${c.a}/rdo/${c.ra}`,jsonRequest('PATCH',{data:'2026-11-01'},c.cookie),env);expect(r.status).toBe(200);const {results}=await env.DB.prepare('SELECT rdo_id,data FROM obra_fotos WHERE obra_id=? ORDER BY id').bind(c.a).all();expect(results).toEqual([{rdo_id:c.ra,data:'2026-11-01'},{rdo_id:null,data:'2000-01-01'}]);
});
it('parceiro anexa ao próprio RDO, mas só Admin/gestor exclui e contagem atualiza',async()=>{
  const c=await contexto('permissoes');const r=await c.upload(c.a,c.ra,c.cookieParceiro);expect(r.status).toBe(201);const {foto}=await r.json<{foto:{id:number}}>();expect((await app.request(`/api/obras/${c.a}/fotos/${foto.id}?rdo_id=${c.ra}`,{method:'DELETE',headers:{cookie:c.cookieParceiro}},env)).status).toBe(403);expect((await app.request(`/api/obras/${c.a}/fotos/${foto.id}?rdo_id=${c.ra}`,{method:'DELETE',headers:{cookie:c.cookie}},env)).status).toBe(200);expect(await (await c.get(`/api/obras/${c.a}/fotos`)).json()).toEqual({fotos:[]});
});
it.each(['','0','-1','abc','1.2'])('rejeita filtro inválido %s',async(valor)=>{const c=await contexto('invalido-'+valor);expect((await c.get(`/api/obras/${c.a}/fotos?rdo_id=${valor}`)).status).toBe(400);});

it('edita apenas legenda, preservando RDO, data, ownership e objeto R2',async()=>{
  const c=await contexto('legenda'),{foto}=await (await c.upload(c.a,c.ra)).json<{foto:{id:number}}>();const antes=await env.DB.prepare('SELECT * FROM obra_fotos WHERE id=?').bind(foto.id).first<Record<string,unknown>>();const objetos=(await env.DOCUMENTOS_BUCKET.list()).objects;
  const r=await app.request(`/api/obras/${c.a}/fotos/${foto.id}?rdo_id=${c.ra}`,jsonRequest('PATCH',{legenda:'Nova legenda'},c.cookieParceiro),env);expect(r.status).toBe(200);expect(await env.DB.prepare('SELECT * FROM obra_fotos WHERE id=?').bind(foto.id).first()).toEqual({...antes,legenda:'Nova legenda'});expect((await env.DOCUMENTOS_BUCKET.list()).objects).toEqual(objetos);
});
it('edição de foto bloqueia IDOR e campos protegidos mesmo junto de legenda válida',async()=>{
  const c=await contexto('legenda-idor'),{foto}=await (await c.upload(c.b,c.rb)).json<{foto:{id:number}}>();
  expect((await app.request(`/api/obras/${c.a}/fotos/${foto.id}`,jsonRequest('PATCH',{legenda:'Intrusão'},c.cookieParceiro),env)).status).toBe(404);
  expect((await app.request(`/api/obras/${c.b}/fotos/${foto.id}`,jsonRequest('PATCH',{legenda:'Intrusão'},c.cookieParceiro),env)).status).toBe(404);
  expect((await app.request(`/api/obras/${c.b}/fotos/${foto.id}`,jsonRequest('PATCH',{legenda:'Legítima',obra_id:c.a,rdo_id:c.ra,data:'2000-01-01',enviado_por_id:1,storage_key:'outra'},c.cookie),env)).status).toBe(400);
});
it('foto não pode ser editada por outro RDO da mesma Obra e visualizador não escreve',async()=>{
  const c=await contexto('legenda-escopo'),{foto}=await (await c.upload(c.a,c.ra)).json<{foto:{id:number}}>();expect((await app.request(`/api/obras/${c.a}/fotos/${foto.id}?rdo_id=${c.ra2}`,jsonRequest('PATCH',{legenda:'Outra'},c.cookie),env)).status).toBe(404);
  await criarUsuario('rdo-fotos-view@voia.local','visualizador');const login=await app.request('/api/auth/login',jsonRequest('POST',{email:'rdo-fotos-view@voia.local',senha:'senha-padrao-teste'}),env),cookie=extrairCookie(login,SESSION_COOKIE_NAME)!;expect((await app.request(`/api/obras/${c.a}/fotos/${foto.id}`,jsonRequest('PATCH',{legenda:'Outra'},cookie),env)).status).toBe(403);
});
async function ocorrencia(c:Awaited<ReturnType<typeof contexto>>,obra=c.a){const r=await app.request(`/api/obras/${obra}/ocorrencias`,jsonRequest('POST',{titulo:'Registro original',descricao:'Original',categoria:'execucao'},c.cookie),env);return (await r.json<{ocorrencia:{id:number}}>()).ocorrencia.id;}
it('edita ocorrência com validação e auditoria, preservando autoria e datas históricas',async()=>{
  const c=await contexto('oc-editar'),id=await ocorrencia(c),antes=await env.DB.prepare('SELECT * FROM obra_ocorrencias WHERE id=?').bind(id).first<Record<string,unknown>>();const r=await app.request(`/api/obras/${c.a}/ocorrencias/${id}`,jsonRequest('PATCH',{titulo:'Título revisto',descricao:'Nova descrição',categoria:'qualidade',prioridade:'alta',prazo:'2026-11-01'},c.cookieParceiro),env);expect(r.status).toBe(200);const depois=await env.DB.prepare('SELECT * FROM obra_ocorrencias WHERE id=?').bind(id).first<Record<string,unknown>>();expect(depois).toMatchObject({...antes,titulo:'Título revisto',descricao:'Nova descrição',categoria:'qualidade',prioridade:'alta',prazo:'2026-11-01',atualizado_em:depois!.atualizado_em});expect(await env.DB.prepare("SELECT id FROM projeto_atualizacoes WHERE entidade_tipo='ocorrencia' AND entidade_id=? AND tipo_evento='ocorrencia_editada'").bind(id).first()).not.toBeNull();
});
it('ocorrência bloqueia campos protegidos, IDOR e responsável externo',async()=>{
  const c=await contexto('oc-idor'),id=await ocorrencia(c),outro=await ocorrencia(c,c.b),externo=await criarUsuario('oc-externo@voia.local','colaborador');
  expect((await app.request(`/api/obras/${c.a}/ocorrencias/${id}`,jsonRequest('PATCH',{titulo:'Outro',criado_por_id:externo,obra_id:c.b,id:outro,resolvido_em:'2000-01-01'},c.cookie),env)).status).toBe(400);
  expect((await app.request(`/api/obras/${c.a}/ocorrencias/${outro}`,jsonRequest('PATCH',{titulo:'Outro'},c.cookie),env)).status).toBe(404);
  expect((await app.request(`/api/obras/${c.b}/ocorrencias/${outro}`,jsonRequest('PATCH',{titulo:'Outro'},c.cookieParceiro),env)).status).toBe(404);
  expect((await app.request(`/api/obras/${c.a}/ocorrencias/${id}`,jsonRequest('PATCH',{responsavel_id:externo},c.cookie),env)).status).toBe(400);
});

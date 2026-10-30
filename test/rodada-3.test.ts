import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import type { D1Migration } from '@cloudflare/vitest-plugin';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/worker/index';
import { SESSION_COOKIE_NAME } from '../src/worker/auth/session';
import { criarCliente, criarDocumento, criarEtapa, criarProjeto, criarTarefa, criarUsuario, vincularMembro } from './helpers/fixtures';
import { extrairCookie, jsonRequest } from './helpers/http';
import { consolidarTrabalho } from '../src/react-app/lib/consolidar-trabalho';
import { criarTrabalho } from '../src/react-app/lib/novo-trabalho';
import { interpretarAtualizacao } from '../src/shared/assistente-voia';
import { textoYara } from './fixtures/yara';

afterEach(()=>vi.unstubAllGlobals());
async function contexto(s:string) {
  const email=`admin-r3-${s}@voia.local`,admin=await criarUsuario(email,'administrador');
  const login=await app.request('/api/auth/login',jsonRequest('POST',{email,senha:'senha-padrao-teste'}),env);
  const cookie=extrairCookie(login,SESSION_COOKIE_NAME)!;
  const cliente=await criarCliente(`Cliente ${s}`),projeto=await criarProjeto(cliente,admin,`Projeto ${s}`);
  const confirmar=(operacoes:unknown[],confirmado=true)=>app.request(`/api/projetos/${projeto}/assistente/confirmar`,jsonRequest('POST',{confirmado,operacoes},cookie),env);
  return {admin,cliente,projeto,cookie,confirmar};
}

describe('Rodada 3: migration aditiva e fluxo operacional',()=>{
  it('aplica 0029 sobre banco anterior e preserva integralmente os registros legados',async()=>{
    const e=env as unknown as {DB_LEGADO:D1Database;TEST_MIGRATIONS:D1Migration[]};
    const db=e.DB_LEGADO,migrations=e.TEST_MIGRATIONS;
    await applyD1Migrations(db,migrations.filter(m=>!m.name.startsWith('0029')));
    await db.prepare("INSERT INTO usuarios(id,nome,email,perfil) VALUES (991,'Pessoa legada','legado@voia.local','administrador')").run();
    await db.prepare("INSERT INTO clientes(id,tipo,nome) VALUES(991,'PF','Cliente legado')").run();
    await db.prepare("INSERT INTO projetos(id,cliente_id,nome,status,criado_por_id,valor_contratado) VALUES(991,991,'Projeto legado','em_andamento',991,125000)").run();
    await db.prepare("INSERT INTO projeto_documentos(id,projeto_id,nome,autor_id,storage_key) VALUES(991,991,'Documento legado',991,'chave-legada-preservada')").run();
    const projeto=await db.prepare('SELECT * FROM projetos WHERE id=991').first<Record<string,unknown>>(),doc=await db.prepare('SELECT * FROM projeto_documentos WHERE id=991').first<Record<string,unknown>>();
    expect(projeto).not.toHaveProperty('fase_comercial');expect(doc).not.toHaveProperty('esperado');
    await applyD1Migrations(db,migrations);
    expect(await db.prepare('SELECT * FROM projetos WHERE id=991').first()).toEqual({...projeto,fase_comercial:null});
    expect(await db.prepare('SELECT * FROM projeto_documentos WHERE id=991').first()).toEqual({...doc,esperado:0,estado_documental:null,prazo:null});
    await expect(db.prepare("UPDATE projetos SET fase_comercial='ativo' WHERE id=991").run()).rejects.toThrow();
  });

  it('cria Yara com plano revisado, etapas vinculadas e documentos sem arquivo, sem Obra',async()=>{
    const c=await contexto('yara'),r=consolidarTrabalho([{nome:'WhatsApp',texto:textoYara}]).rascunho;
    expect(r.projeto).toMatchObject({fase_comercial:'aprovada',status:'planejamento'});expect(r.etapas).toHaveLength(4);expect(r.documentosEsperados?.map(d=>d.nome)).toEqual(['ART','Termo de conclusão']);
    r.acoes[0].responsavel_id=c.admin;
    vi.stubGlobal('fetch',async(url:string,init:RequestInit)=>{const headers=new Headers(init.headers);headers.set('cookie',c.cookie);return app.request(url,{...init,headers},env);});
    const id=await criarTrabalho(r,[],{tarefas:0,documentos:0});
    expect(await env.DB.prepare('SELECT status,fase_comercial FROM projetos WHERE id=?').bind(id).first()).toEqual({status:'planejamento',fase_comercial:'aprovada'});
    expect((await env.DB.prepare('SELECT * FROM projeto_etapas WHERE projeto_id=?').bind(id).all()).results).toHaveLength(4);
    const tarefas=await env.DB.prepare('SELECT etapa_id,prazo,responsavel_id FROM projeto_tarefas WHERE projeto_id=? ORDER BY id').bind(id).all();
    expect(tarefas.results).toHaveLength(5);expect(tarefas.results.every(t=>!!t.etapa_id)).toBe(true);expect(tarefas.results.map(t=>t.prazo)).toEqual(['2026-10-15',null,null,'2026-10-30','2026-11-14']);
    const documentos=await env.DB.prepare('SELECT esperado,estado_documental,storage_key FROM projeto_documentos WHERE projeto_id=?').bind(id).all();
    expect(documentos.results).toEqual([{esperado:1,estado_documental:'pendente_emissao',storage_key:null},{esperado:1,estado_documental:'aguardando_etapa',storage_key:null}]);
    expect(await env.DB.prepare('SELECT id FROM obras WHERE projeto_id=?').bind(id).first()).toBeNull();
    const agenda=await app.request('/api/calendario?inicio=2026-10-01&fim=2026-11-30',{headers:{cookie:c.cookie}},env);
    expect(agenda.status).toBe(200);
    // The operational calendar uses SQLite's clock, not inicio/fim query params.
    // Keep the historical Yara fixture intact, even when its date ages out.
    const janela=await env.DB.prepare("SELECT date('now','-14 days') AS inicio,date('now','+60 days') AS fim").first<{inicio:string;fim:string}>();
    const eventos=(await agenda.json<{eventos:{titulo:string;projetoId:number}[]}>()).eventos;
    expect(eventos.some(e=>e.projetoId===id&&e.titulo==='Vistoria inicial')).toBe(janela!.inicio<='2026-10-15'&&janela!.fim>='2026-10-15');
  });

  it('calendário inclui limite de 14 dias e exclui dia anterior, usando a data do banco',async()=>{
    const c=await contexto('calendario-janela');
    await env.DB.prepare("INSERT INTO projeto_tarefas(projeto_id,nome,responsavel_id,prazo,status) VALUES(?,'No limite local',?,date('now','-14 days'),'pendente'),(?,'Fora do limite local',?,date('now','-15 days'),'pendente')").bind(c.projeto,c.admin,c.projeto,c.admin).run();
    const agenda=await app.request('/api/calendario',{headers:{cookie:c.cookie}},env);
    expect(agenda.status).toBe(200);const eventos=(await agenda.json<{eventos:{titulo:string}[]}>()).eventos;
    expect(eventos.some(e=>e.titulo==='No limite local')).toBe(true);expect(eventos.some(e=>e.titulo==='Fora do limite local')).toBe(false);
  });

  it('proposta aguardando aceite não inicia o projeto nem as etapas',async()=>{
    const c=await contexto('proposta');const r=consolidarTrabalho([{nome:'proposta.txt',texto:'Cliente: Ana Souza\nServiço: Consultoria\nVistoria inicial: 15/10/2026\nEmissão da ART após a vistoria.'}]).rascunho;
    expect(r.projeto.fase_comercial).toBe('aguardando_retorno');expect(r.acoes.every(a=>a.status==='aguardando')).toBe(true);
    vi.stubGlobal('fetch',async(url:string,init:RequestInit)=>{const headers=new Headers(init.headers);headers.set('cookie',c.cookie);return app.request(url,{...init,headers},env);});
    const id=await criarTrabalho(r,[],{tarefas:0,documentos:0});expect(await env.DB.prepare('SELECT status FROM projetos WHERE id=?').bind(id).first()).toEqual({status:'prospeccao'});
    expect((await env.DB.prepare('SELECT status,data_inicio_real FROM projeto_etapas WHERE projeto_id=?').bind(id).all()).results.every(e=>e.status==='pendente'&&e.data_inicio_real===null)).toBe(true);
  });

  it('documento pendente e emitido sem arquivo recebe upload no mesmo item, preservando Emitido',async()=>{
    const c=await contexto('doc');const f=new FormData();f.set('nome','ART');f.set('categoria','art_rrt');f.set('esperado','true');f.set('estado_documental','pendente_emissao');
    const res=await app.request(`/api/projetos/${c.projeto}/documentos`,{method:'POST',headers:{cookie:c.cookie},body:f},env);expect(res.status).toBe(201);
    const {documento}=await res.json<{documento:{id:number;possui_arquivo:number}}>();expect(documento.possui_arquivo).toBe(0);
    const recebido=await app.request(`/api/projetos/${c.projeto}/documentos/${documento.id}`,jsonRequest('PATCH',{estado_documental:'recebido'},c.cookie),env);expect(recebido.status).toBe(200);expect(await recebido.json()).toMatchObject({documento:{estado_documental:'recebido',possui_arquivo:0}});
    const emitida=await app.request(`/api/projetos/${c.projeto}/documentos/${documento.id}`,jsonRequest('PATCH',{estado_documental:'emitido'},c.cookie),env);expect(emitida.status).toBe(200);expect(await emitida.json()).toMatchObject({documento:{estado_documental:'emitido',possui_arquivo:0}});
    const upload=new FormData();upload.set('arquivo',new File(['ART emitida'], 'art.txt',{type:'text/plain'}));
    const u=await app.request(`/api/projetos/${c.projeto}/documentos/${documento.id}/arquivo`,{method:'POST',headers:{cookie:c.cookie},body:upload},env);expect(u.status).toBe(200);expect(await u.json()).toMatchObject({documento:{id:documento.id,esperado:1,estado_documental:'emitido',possui_arquivo:1}});
    expect((await env.DB.prepare('SELECT id FROM projeto_documentos WHERE projeto_id=?').bind(c.projeto).all()).results).toHaveLength(1);
  });

  it('upload de esperado pendente marca Recebido e não converte documentos legados',async()=>{
    const c=await contexto('upload'),legado=await criarDocumento(c.projeto,c.admin,'Legado'),esperado=await criarDocumento(c.projeto,c.admin,'Esperado');
    await env.DB.prepare("UPDATE projeto_documentos SET esperado=1,estado_documental='pendente' WHERE id=?").bind(esperado).run();
    for(const id of [legado,esperado]){const f=new FormData();f.set('arquivo',new File(['arquivo'],`doc-${id}.txt`,{type:'text/plain'}));expect((await app.request(`/api/projetos/${c.projeto}/documentos/${id}/arquivo`,{method:'POST',headers:{cookie:c.cookie},body:f},env)).status).toBe(200);}
    expect(await env.DB.prepare('SELECT esperado,estado_documental FROM projeto_documentos WHERE id=?').bind(legado).first()).toEqual({esperado:0,estado_documental:null});
    expect(await env.DB.prepare('SELECT esperado,estado_documental FROM projeto_documentos WHERE id=?').bind(esperado).first()).toEqual({esperado:1,estado_documental:'recebido'});
  });

  it('confirma somente alterações selecionadas; aprovação e valor não registram pagamento nem Obra',async()=>{
    const c=await contexto('selecionadas');const r=interpretarAtualizacao('Cliente aprovou a proposta. Fechou por R$ 5.000, vai pagar 50% de entrada.',{tarefas:[],documentos:[]},'2026-10-14');
    expect(await env.DB.prepare('SELECT fase_comercial FROM projetos WHERE id=?').bind(c.projeto).first()).toEqual({fase_comercial:null});
    const fase=r.sugestoes.filter(s=>s.operacao.tipo==='projeto'&&s.operacao.dados.fase_comercial);expect((await c.confirmar(fase.map(s=>s.operacao))).status).toBe(200);
    expect(await env.DB.prepare('SELECT fase_comercial,valor_contratado,status FROM projetos WHERE id=?').bind(c.projeto).first()).toMatchObject({fase_comercial:'aprovada',valor_contratado:null});
    expect(await env.DB.prepare('SELECT id FROM obras WHERE projeto_id=?').bind(c.projeto).first()).toBeNull();
    expect(await env.DB.prepare('SELECT id FROM projeto_parceiro_remuneracoes WHERE projeto_id=?').bind(c.projeto).first()).toBeNull();
    expect(await env.DB.prepare("SELECT id FROM projeto_atualizacoes WHERE projeto_id=? AND tipo_evento='assistente_voia_confirmado'").bind(c.projeto).first()).toBeTruthy();
  });

  it('atualiza a vistoria e ART existentes sem duplicatas e preserva a ausência do arquivo',async()=>{
    const c=await contexto('existentes'),etapa=await criarEtapa(c.projeto,'Vistoria'),tarefa=await criarTarefa(c.projeto,etapa,'Vistoria inicial'),doc=await criarDocumento(c.projeto,c.admin,'ART');
    const r=interpretarAtualizacao('Fiz a vistoria inicial hoje e já emiti a ART.',{tarefas:[{id:tarefa,nome:'Vistoria inicial',status:'pendente'}],documentos:[{id:doc,nome:'ART',categoria:'art_rrt',possui_arquivo:0}]},'2026-10-14');
    expect((await c.confirmar(r.sugestoes.map(s=>s.operacao))).status).toBe(200);
    expect(await env.DB.prepare('SELECT status FROM projeto_tarefas WHERE id=?').bind(tarefa).first()).toEqual({status:'concluida'});
    expect(await env.DB.prepare('SELECT estado_documental,storage_key FROM projeto_documentos WHERE id=?').bind(doc).first()).toEqual({estado_documental:'emitido',storage_key:null});
    expect((await env.DB.prepare('SELECT id FROM projeto_tarefas WHERE projeto_id=?').bind(c.projeto).all()).results).toHaveLength(1);
  });

  it('recusa, retoma comercialmente e preserva cliente, registros e histórico',async()=>{
    const c=await contexto('recusa'),doc=await criarDocumento(c.projeto,c.admin,'Proposta');
    for(const fase_comercial of ['perdida','aprovada'])expect((await c.confirmar([{tipo:'projeto',dados:{fase_comercial}}])).status).toBe(200);
    expect(await env.DB.prepare('SELECT id FROM clientes WHERE id=?').bind(c.cliente).first()).toBeTruthy();expect(await env.DB.prepare('SELECT id FROM projeto_documentos WHERE id=?').bind(doc).first()).toBeTruthy();
    expect((await env.DB.prepare("SELECT id FROM projeto_atualizacoes WHERE projeto_id=? AND tipo_evento='fase_comercial_alterada'").bind(c.projeto).all()).results).toHaveLength(2);
  });

  it('rejeita falta de confirmação, datas impossíveis, duplicatas e IDs externos antes de qualquer alteração',async()=>{
    const c=await contexto('invalidos'),outro=await criarProjeto(c.cliente,c.admin,'Outro projeto'),etapa=await criarEtapa(outro,'Etapa'),tarefa=await criarTarefa(outro,etapa,'Vistoria inicial');
    expect((await c.confirmar([{tipo:'projeto',dados:{fase_comercial:'aprovada'}}],false)).status).toBe(400);
    expect((await c.confirmar([{tipo:'criar_tarefa',dados:{nome:'Vistoria',prazo:'2026-02-31'}}])).status).toBe(400);
    expect((await c.confirmar([{tipo:'projeto',dados:{fase_comercial:'aprovada'}},{tipo:'tarefa',id:tarefa,dados:{status:'concluida'}}])).status).toBe(400);
    expect(await env.DB.prepare('SELECT fase_comercial FROM projetos WHERE id=?').bind(c.projeto).first()).toEqual({fase_comercial:null});
    const e=await criarEtapa(c.projeto,'Etapa'),existente=await criarTarefa(c.projeto,e,'Vistoria inicial');
    expect((await c.confirmar([{tipo:'criar_tarefa',dados:{nome:'Vistoria inicial'}}])).status).toBe(409);
    expect((await c.confirmar([{tipo:'tarefa',id:existente,dados:{status:'concluida'}},{tipo:'tarefa',id:existente,dados:{status:'pendente'}}])).status).toBe(400);
  });

  it('parceiro mantém isolamento e não recebe permissões administrativas de fase, checklist ou assistente',async()=>{
    const c=await contexto('parceiro'),email='parceiro-r3@voia.local',parceiro=await criarUsuario(email,'colaborador');await vincularMembro(c.projeto,parceiro);
    const login=await app.request('/api/auth/login',jsonRequest('POST',{email,senha:'senha-padrao-teste'}),env),cookie=extrairCookie(login,SESSION_COOKIE_NAME)!;
    expect((await app.request(`/api/projetos/${c.projeto}/assistente/confirmar`,jsonRequest('POST',{confirmado:true,operacoes:[{tipo:'projeto',dados:{fase_comercial:'aprovada'}}]},cookie),env)).status).toBe(403);
    expect((await app.request(`/api/projetos/${c.projeto}`,jsonRequest('PATCH',{fase_comercial:'aprovada'},cookie),env)).status).toBe(403);
    const doc=await criarDocumento(c.projeto,c.admin,'ART');await env.DB.prepare('UPDATE projeto_documentos SET visivel_parceiro=1 WHERE id=?').bind(doc).run();
    expect((await app.request(`/api/projetos/${c.projeto}/documentos/${doc}`,jsonRequest('PATCH',{estado_documental:'emitido'},cookie),env)).status).toBe(403);
    const outro=await criarProjeto(c.cliente,c.admin,'Projeto externo');expect((await app.request(`/api/projetos/${outro}/documentos`,{headers:{cookie}},env)).status).toBe(404);
  });

  it('não aceita estados de arquivo fictícios nem referências de etapa externas',async()=>{
    const c=await contexto('doc-invalidos'),doc=await criarDocumento(c.projeto,c.admin,'ART');
    expect((await c.confirmar([{tipo:'documento',id:doc,dados:{estado_documental:'anexado'}}])).status).toBe(400);
    expect((await app.request(`/api/projetos/${c.projeto}/documentos/${doc}`,jsonRequest('PATCH',{estado_documental:'anexado'},c.cookie),env)).status).toBe(400);
    const f=new FormData();f.set('nome','ART');f.set('estado_documental','anexado');expect((await app.request(`/api/projetos/${c.projeto}/documentos`,{method:'POST',headers:{cookie:c.cookie},body:f},env)).status).toBe(400);
  });
  it('Assistente valida vínculo do responsável e campos financeiros extras antes de persistir',async()=>{
    const c=await contexto('responsavel'),externo=await criarUsuario('responsavel-externo-r3@voia.local','colaborador');
    expect((await c.confirmar([{tipo:'projeto',dados:{fase_comercial:'aprovada'}},{tipo:'criar_tarefa',dados:{nome:'Vistoria',responsavel_id:externo}}])).status).toBe(400);
    expect(await env.DB.prepare('SELECT fase_comercial FROM projetos WHERE id=?').bind(c.projeto).first()).toEqual({fase_comercial:null});
    expect((await c.confirmar([{tipo:'projeto',dados:{valor_contratado:500000,pagamento_recebido:true}}])).status).toBe(400);
    await vincularMembro(c.projeto,externo);expect((await c.confirmar([{tipo:'criar_tarefa',dados:{nome:'Vistoria',responsavel_id:externo}}])).status).toBe(200);
  });
  it('vincula o modelo escolhido sem gerar etapas duplicadas e retoma falha de etapa sem repetir cliente/projeto',async()=>{
    const c=await contexto('modelo-retomada');
    const r=consolidarTrabalho([{nome:'Briefing',texto:'Cliente: Ana Silva\nEtapa 1 — Levantamento\nTarefa: Medir terreno'}]).rascunho;
    const tipo=await env.DB.prepare("SELECT id FROM tipos_servico WHERE nome='Vistoria'").first<{id:number}>();r.projeto.tipo_servico_ids=[tipo!.id];
    let falhar=true;let clientePosts=0,projetoPosts=0;
    vi.stubGlobal('fetch',async(url:string,init:RequestInit)=>{
      if(url==='/api/clientes')clientePosts++;if(url==='/api/projetos')projetoPosts++;
      if(url.endsWith('/etapas')&&falhar)return new Response(JSON.stringify({error:'Falha de etapa'}),{status:500});
      const headers=new Headers(init.headers);headers.set('cookie',c.cookie);return app.request(url,{...init,headers},env);
    });const checkpoint={tarefas:0,documentos:0};await expect(criarTrabalho(r,[],checkpoint)).rejects.toThrow('Falha de etapa');falhar=false;const id=await criarTrabalho(r,[],checkpoint);expect(clientePosts).toBe(1);expect(projetoPosts).toBe(1);expect(await env.DB.prepare('SELECT tipo_servico_id FROM projeto_tipos_servico WHERE projeto_id=?').bind(id).first()).toEqual({tipo_servico_id:tipo!.id});expect((await env.DB.prepare('SELECT id FROM projeto_etapas WHERE projeto_id=?').bind(id).all()).results).toHaveLength(1);
  });
  it('resumo distingue zero etapas de etapas efetivamente concluídas e mantém progresso por tarefas sem etapa',async()=>{
    const c=await contexto('resumo-visual');const ler=async()=>{const r=await app.request(`/api/projetos/${c.projeto}`,{headers:{cookie:c.cookie}},env);expect(r.status).toBe(200);return r.json();};
    expect(await ler()).toMatchObject({resumoOperacional:{totalEtapas:0,etapasConcluidas:0,etapaAtual:null}});
    const tarefa=await app.request(`/api/projetos/${c.projeto}/tarefas`,jsonRequest('POST',{nome:'Tarefa sem etapa',status:'pendente'},c.cookie),env);const t=await tarefa.json<{tarefa:{id:number}}>();
    expect(await ler()).toMatchObject({resumoOperacional:{totalEtapas:0,etapasConcluidas:0}});
    expect((await app.request(`/api/projetos/${c.projeto}/tarefas/${t.tarefa.id}`,jsonRequest('PATCH',{status:'concluida'},c.cookie),env)).status).toBe(200);expect(await ler()).toMatchObject({projeto:{progresso:100},resumoOperacional:{totalEtapas:0,etapasConcluidas:0}});
    const a=await criarEtapa(c.projeto,'Etapa A'),b=await criarEtapa(c.projeto,'Etapa B');await env.DB.prepare("UPDATE projeto_etapas SET status='concluida' WHERE id=?").bind(a).run();expect(await ler()).toMatchObject({resumoOperacional:{totalEtapas:2,etapasConcluidas:1,etapaAtual:{id:b}}});await env.DB.prepare("UPDATE projeto_etapas SET status='concluida' WHERE id=?").bind(b).run();expect(await ler()).toMatchObject({resumoOperacional:{totalEtapas:2,etapasConcluidas:2,etapaAtual:null}});
  });

});

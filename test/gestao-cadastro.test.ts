import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import app from '../src/worker/index';
import { SESSION_COOKIE_NAME } from '../src/worker/auth/session';
import { criarCliente, criarDocumento, criarEtapa, criarProjeto, criarTarefa, criarUsuario, vincularMembro } from './helpers/fixtures';
import { extrairCookie, jsonRequest } from './helpers/http';

async function contexto(sufixo: string) {
  const email = `admin-gestao-${sufixo}@voia.local`; const admin = await criarUsuario(email, 'administrador');
  const login = await app.request('/api/auth/login', jsonRequest('POST', { email, senha: 'senha-padrao-teste' }), env);
  const cookie = extrairCookie(login, SESSION_COOKIE_NAME)!;
  const cliente = await criarCliente(`Cliente ${sufixo}`); const projeto = await criarProjeto(cliente, admin, `Projeto ${sufixo}`);
  return { admin, cookie, cliente, projeto };
}

describe('gestão segura de cadastros criados por engano', () => {
  it('exclui tarefa sem etapa com autorização, recalcula progresso e registra histórico', async () => {
    const c = await contexto('tarefa');
    const criar = async (nome: string, status: string) => app.request(`/api/projetos/${c.projeto}/tarefas`, jsonRequest('POST', { nome, status }, c.cookie), env);
    const res = await criar('Tarefa por engano', 'pendente'); const { tarefa } = await res.json<{ tarefa: { id: number } }>();
    await criar('Tarefa concluída', 'concluida');
    const excluida = await app.request(`/api/projetos/${c.projeto}/tarefas/${tarefa.id}`, { method: 'DELETE', headers: { cookie: c.cookie } }, env);
    expect(excluida.status).toBe(200); expect(await excluida.json()).toMatchObject({ progresso: 100 });
    expect(await env.DB.prepare('SELECT id FROM projeto_tarefas WHERE id = ?').bind(tarefa.id).first()).toBeNull();
    expect(await env.DB.prepare("SELECT titulo FROM projeto_atualizacoes WHERE projeto_id = ? AND tipo_evento = 'tarefa_excluida'").bind(c.projeto).first()).toMatchObject({ titulo: 'Tarefa excluída: Tarefa por engano' });
    const leitura = await app.request(`/api/projetos/${c.projeto}`, { headers: { cookie: c.cookie } }, env);
    expect(await leitura.json()).toMatchObject({ resumoOperacional: { totalEtapas: 0, etapaAtual: null } });
  });

  it('anexa TXT pela API e remove documento e objeto R2 com histórico', async () => {
    const c = await contexto('txt'); const form = new FormData(); form.set('nome', 'Termo'); form.set('arquivo', new File(['Cliente: Lincoln e Nayara'], 'termo.txt', { type: 'text/plain' }));
    const upload = await app.request(`/api/projetos/${c.projeto}/documentos`, { method: 'POST', headers: { cookie: c.cookie }, body: form }, env);
    expect(upload.status).toBe(201); const { documento } = await upload.json<{ documento: { id: number } }>();
    const registro = await env.DB.prepare('SELECT storage_key FROM projeto_documentos WHERE id = ?').bind(documento.id).first<{ storage_key: string }>();
    expect(await env.DOCUMENTOS_BUCKET.get(registro!.storage_key)).toBeTruthy();
    const res = await app.request(`/api/projetos/${c.projeto}/documentos/${documento.id}`, { method: 'DELETE', headers: { cookie: c.cookie } }, env);
    expect(res.status).toBe(200); expect(await env.DOCUMENTOS_BUCKET.get(registro!.storage_key)).toBeNull();
    expect(await env.DB.prepare('SELECT id FROM projeto_documentos WHERE id = ?').bind(documento.id).first()).toBeNull();
    expect(await env.DB.prepare("SELECT titulo FROM projeto_atualizacoes WHERE projeto_id = ? AND tipo_evento = 'documento_excluido'").bind(c.projeto).first()).toMatchObject({ titulo: 'Documento excluído' });
  });

  it('exclui etapa com suas tarefas, preserva documentos e não deixa vínculo órfão', async () => {
    const c = await contexto('etapa'); const etapa = await criarEtapa(c.projeto, 'Etapa por engano'); const tarefa = await criarTarefa(c.projeto, etapa, 'Tarefa vinculada'); const documento = await criarDocumento(c.projeto, c.admin, 'Documento preservado');
    await env.DB.prepare('UPDATE projeto_documentos SET etapa_id = ? WHERE id = ?').bind(etapa, documento).run();
    const res = await app.request(`/api/projetos/${c.projeto}/etapas/${etapa}`, { method: 'DELETE', headers: { cookie: c.cookie } }, env);
    expect(res.status).toBe(200); expect(await env.DB.prepare('SELECT id FROM projeto_tarefas WHERE id = ?').bind(tarefa).first()).toBeNull();
    expect(await env.DB.prepare('SELECT etapa_id FROM projeto_documentos WHERE id = ?').bind(documento).first()).toMatchObject({ etapa_id: null });
    expect(await env.DB.prepare("SELECT id FROM projeto_atualizacoes WHERE projeto_id = ? AND tipo_evento = 'etapa_excluida'").bind(c.projeto).first()).toBeTruthy();
  });

  it('cancelar projeto preserva cliente, tarefas, documentos, obras e financeiro', async () => {
    const c = await contexto('cancelar'); const etapa = await criarEtapa(c.projeto, 'Etapa'); const tarefa = await criarTarefa(c.projeto, etapa, 'Tarefa'); const documento = await criarDocumento(c.projeto, c.admin, 'Documento');
    const obra = await app.request('/api/obras', jsonRequest('POST', { projeto_id: c.projeto, nome: 'Obra existente', status: 'planejamento' }, c.cookie), env);
    expect(obra.status).toBe(201);
    await env.DB.prepare("INSERT INTO projeto_parceiro_remuneracoes (projeto_id, parceiro_id, tipo, valor_acordado) VALUES (?, ?, 'fixo', 10000)").bind(c.projeto, c.admin).run();
    const res = await app.request(`/api/projetos/${c.projeto}`, jsonRequest('PATCH', { status: 'cancelado' }, c.cookie), env);
    expect(res.status).toBe(200);
    expect(await env.DB.prepare('SELECT status FROM projetos WHERE id = ?').bind(c.projeto).first()).toMatchObject({ status: 'cancelado' });
    expect(await env.DB.prepare('SELECT id FROM clientes WHERE id = ?').bind(c.cliente).first()).toBeTruthy();
    expect(await env.DB.prepare('SELECT id FROM projeto_tarefas WHERE id = ?').bind(tarefa).first()).toBeTruthy();
    expect(await env.DB.prepare('SELECT id FROM projeto_documentos WHERE id = ?').bind(documento).first()).toBeTruthy();
    expect(await env.DB.prepare('SELECT id FROM obras WHERE projeto_id = ?').bind(c.projeto).first()).toBeTruthy();
    expect(await env.DB.prepare('SELECT valor_acordado FROM projeto_parceiro_remuneracoes WHERE projeto_id = ?').bind(c.projeto).first()).toMatchObject({ valor_acordado: 10000 });
  });

  it('parceiro vinculado continua sem permissão para excluir ou cancelar', async () => {
    const c = await contexto('parceiro'); const parceiro = await criarUsuario('parceiro-gestao@voia.local', 'colaborador'); await vincularMembro(c.projeto, parceiro);
    const login = await app.request('/api/auth/login', jsonRequest('POST', { email: 'parceiro-gestao@voia.local', senha: 'senha-padrao-teste' }), env); const cookie = extrairCookie(login, SESSION_COOKIE_NAME)!;
    const etapa = await criarEtapa(c.projeto, 'Etapa'); const tarefa = await criarTarefa(c.projeto, etapa, 'Tarefa'); const documento = await criarDocumento(c.projeto, c.admin, 'Documento');
    for (const path of [`etapas/${etapa}`, `tarefas/${tarefa}`, `documentos/${documento}`]) expect((await app.request(`/api/projetos/${c.projeto}/${path}`, { method: 'DELETE', headers: { cookie } }, env)).status).toBe(403);
    expect((await app.request(`/api/projetos/${c.projeto}`, jsonRequest('PATCH', { status: 'cancelado' }, cookie), env)).status).toBe(403);
    expect(await env.DB.prepare('SELECT id FROM projeto_tarefas WHERE id = ?').bind(tarefa).first()).toBeTruthy();
  });
  it('histórico de exclusão não revela nome de documento privado ao parceiro', async () => {
    const c = await contexto('historico-privado');
    const parceiro = await criarUsuario('parceiro-historico-privado@voia.local', 'colaborador'); await vincularMembro(c.projeto, parceiro);
    const documento = await criarDocumento(c.projeto, c.admin, 'Contrato financeiro confidencial');
    const removido = await app.request(`/api/projetos/${c.projeto}/documentos/${documento}`, { method: 'DELETE', headers: { cookie: c.cookie } }, env);
    expect(removido.status).toBe(200);
    const login = await app.request('/api/auth/login', jsonRequest('POST', { email: 'parceiro-historico-privado@voia.local', senha: 'senha-padrao-teste' }), env);
    const cookie = extrairCookie(login, SESSION_COOKIE_NAME)!;
    const historico = await app.request(`/api/projetos/${c.projeto}/atualizacoes`, { headers: { cookie } }, env);
    expect(historico.status).toBe(200); expect(await historico.text()).not.toContain('Contrato financeiro confidencial');
  });
});

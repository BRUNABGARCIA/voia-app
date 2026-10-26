import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import app from '../src/worker/index';
import { SESSION_COOKIE_NAME } from '../src/worker/auth/session';
import { criarUsuario } from './helpers/fixtures';
import { extrairCookie, jsonRequest } from './helpers/http';
import { analisarTexto, criarTrabalho, valorEmCentavos, type ProgressoCriacao } from '../src/react-app/lib/novo-trabalho';

import { textoYara as texto } from './fixtures/yara';

afterEach(() => vi.unstubAllGlobals());
describe('cadastro inteligente', () => {
  it('extrai Yara sem gravações e sem inventar campos ausentes', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const r = analisarTexto(texto, 2030);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.cliente).toEqual({ nome: 'Yara Campos', whatsapp: '+55 65 9944-4550', origem: 'WhatsApp', cidade: 'Várzea Grande', estado: 'MT', endereco: '' });
    expect(r.cidadeSugerida).toBe(true);
    expect(r.projeto).toMatchObject({ local: 'Condomínio Parque Chapada dos Campos', descricao: 'Acompanhamento técnico + emissão de ART', valor: 'R$ 650,00', status: 'planejamento', pagamento: '' });
    expect(r.acoes.map(a => [a.nome, a.prazo, a.hora])).toEqual([
      ['Vistoria inicial', '2026-10-15', '09:00'], ['Emitir ART', null, ''], ['Vistoria final', null, ''], ['Follow-up de 15 dias', '2026-10-30', ''], ['Follow-up de 30 dias', '2026-11-14', ''],
    ]);
    expect(r.acoes[1].descricao).toBe('Após a vistoria inicial.');
  });
  it('não presume cliente, serviço, origem, horário ou datas a partir de texto insuficiente', () => {
    const r = analisarTexto('Um orçamento, sem dados adicionais.');
    expect(r.cliente.nome).toBe(''); expect(r.cliente.origem).toBe(''); expect(r.projeto.descricao).toBe(''); expect(r.acoes).toEqual([]);
    expect(analisarTexto('Vistoria inicial: 31/02/2026 às 09:00').acoes).toEqual([]);
    expect(analisarTexto('Vistoria inicial: 15/10', 2027).acoes[0]).toMatchObject({ prazo: '2027-10-15', hora: '' });
    expect(analisarTexto('ART').projeto.descricao).toBe('');
    expect(analisarTexto('ART').acoes).toEqual([]);
  });
  it('valida o valor em centavos antes de criar', () => {
    expect(valorEmCentavos('R$ 650,00')).toBe(65000);
    expect(valorEmCentavos('1.234,56')).toBe(123456);
    expect(valorEmCentavos('')).toBeNull();
    expect(() => valorEmCentavos('650abc')).toThrow();
    expect(() => valorEmCentavos('-50')).toThrow();
  });
  it('cria os dados editados, tarefas e anexos, sem criar Obra ou ART fictícia', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/clientes' ? { cliente: { id: 7 } } : url === '/api/projetos' ? { projeto: { id: 9 } } : { ok: true }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = analisarTexto(texto); r.cliente.nome = 'Yara Campos revisado';
    const progresso: ProgressoCriacao = { tarefas: 0, documentos: 0 };
    const id = await criarTrabalho(r, [new File(['proposta'], 'proposta.txt')], progresso);
    expect(id).toBe(9);
    const chamadas = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(JSON.parse(chamadas[0][1].body as string).nome).toBe('Yara Campos revisado');
    expect(JSON.parse(chamadas[1][1].body as string)).toMatchObject({ status: 'planejamento', valor_contratado: 65000, cliente_id: 7, tipo_servico_ids: [] });
    expect(JSON.parse(chamadas[2][1].body as string).descricao).toContain('09:00');
    expect(chamadas.every(([url]) => !url.includes('/obras'))).toBe(true);
    expect(chamadas.filter(([url]) => url.endsWith('/documentos'))).toHaveLength(1);
  });
  it('interrompe erros de tarefas e retoma sem duplicar os registros já confirmados', async () => {
    let falhar = true;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/tarefas') && falhar) return new Response(JSON.stringify({ error: 'Falha de tarefa' }), { status: 500 });
      return new Response(JSON.stringify(url === '/api/clientes' ? { cliente: { id: 7 } } : url === '/api/projetos' ? { projeto: { id: 9 } } : { ok: true }), { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = analisarTexto(texto); const progresso: ProgressoCriacao = { tarefas: 0, documentos: 0 };
    await expect(criarTrabalho(r, [], progresso)).rejects.toThrow('Falha de tarefa');
    expect(progresso).toMatchObject({ clienteId: 7, projetoId: 9, tarefas: 0, documentos: 0 });
    falhar = false; await criarTrabalho(r, [], progresso);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/clientes')).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/projetos')).toHaveLength(1);
    expect(progresso.tarefas).toBe(5);
  });
  it('reporta falha no upload em vez de encerrar como sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Upload recusado' }), { status: 400 })));
    await expect(criarTrabalho(analisarTexto(texto), [new File(['x'], 'x.txt')], { clienteId: 7, projetoId: 9, tarefas: 5, documentos: 0 })).rejects.toThrow('Upload recusado');
  });
  it.each(['cliente', 'projeto'] as const)('interrompe falha de criação de %s', async (etapa) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: `Falha de ${etapa}` }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const progresso: ProgressoCriacao = { tarefas: 0, documentos: 0, ...(etapa === 'projeto' ? { clienteId: 7 } : {}) };
    await expect(criarTrabalho(analisarTexto(texto), [], progresso)).rejects.toThrow(`Falha de ${etapa}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(progresso.projetoId).toBeUndefined();
    expect(progresso.tarefas).toBe(0);
  });
  it('persiste Yara, as cinco ações e um anexo na API real local, sem criar Obra', async () => {
    const email = 'admin-cadastro-yara@voia.local';
    await criarUsuario(email, 'administrador');
    const login = await app.request('/api/auth/login', jsonRequest('POST', { email, senha: 'senha-padrao-teste' }), env);
    const cookie = extrairCookie(login, SESSION_COOKIE_NAME)!;
    const obrasAntes = await env.DB.prepare('SELECT COUNT(*) AS n FROM obras').first<{ n: number }>();
    const clientesAntes = await env.DB.prepare('SELECT COUNT(*) AS n FROM clientes').first<{ n: number }>();
    const r = analisarTexto(texto, 2030);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM clientes').first<{ n: number }>())?.n).toBe(clientesAntes?.n);
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const headers = new Headers(init.headers); headers.set('cookie', cookie);
      return app.request(url, { ...init, headers }, env);
    }));
    const progresso: ProgressoCriacao = { tarefas: 0, documentos: 0 };
    const id = await criarTrabalho(r, [new File(['%PDF-1.4\nproposta de teste'], 'proposta.pdf', { type: 'application/pdf' })], progresso);
    const cliente = await env.DB.prepare('SELECT nome, whatsapp, origem, cidade, estado, logradouro FROM clientes WHERE id = ?').bind(progresso.clienteId).first();
    expect(cliente).toMatchObject({ nome: 'Yara Campos', whatsapp: '+55 65 9944-4550', origem: 'WhatsApp', cidade: 'Várzea Grande', estado: 'MT', logradouro: null });
    const projeto = await env.DB.prepare('SELECT status, valor_contratado, observacoes FROM projetos WHERE id = ?').bind(id).first();
    expect(projeto).toMatchObject({ status: 'planejamento', valor_contratado: 65000, observacoes: 'Local: Condomínio Parque Chapada dos Campos' });
    const tarefas = await env.DB.prepare('SELECT nome, prazo, descricao FROM projeto_tarefas WHERE projeto_id = ? ORDER BY id').bind(id).all();
    expect(tarefas.results).toHaveLength(5);
    expect(tarefas.results[0]).toMatchObject({ nome: 'Vistoria inicial', prazo: '2026-10-15', descricao: 'Horário: 09:00.' });
    expect(tarefas.results[1]).toMatchObject({ nome: 'Emitir ART', prazo: null, descricao: 'Após a vistoria inicial.' });
    expect(tarefas.results[2]).toMatchObject({ nome: 'Vistoria final', prazo: null });
    expect(tarefas.results[3]).toMatchObject({ prazo: '2026-10-30' });
    expect(tarefas.results[4]).toMatchObject({ prazo: '2026-11-14' });
    const documentos = await env.DB.prepare('SELECT nome, visivel_cliente, visivel_parceiro, storage_key FROM projeto_documentos WHERE projeto_id = ?').bind(id).all();
    expect(documentos.results).toHaveLength(1);
    expect(documentos.results[0]).toMatchObject({ nome: 'proposta', visivel_cliente: 0, visivel_parceiro: 0 });
    expect(documentos.results[0].storage_key).toBeTruthy();
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM obras').first<{ n: number }>())?.n).toBe(obrasAntes?.n);
  });
});

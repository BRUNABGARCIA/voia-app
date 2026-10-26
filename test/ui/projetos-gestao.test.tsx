import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import EtapasPanel from '../../src/react-app/components/EtapasPanel';
import DocumentosPanel from '../../src/react-app/components/DocumentosPanel';
import ProjetoWorkspace from '../../src/react-app/pages/ProjetoWorkspace';
import { AuthContext } from '../../src/react-app/contexts/auth-context';
import { analisarTexto } from '../../src/react-app/lib/novo-trabalho';
import { textoYara } from '../fixtures/yara';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const projeto = { id: 9, nome: 'Projeto Yara', status: 'em_andamento', prioridade: 'normal', progresso: 0, cliente_id: 7, cliente_nome: 'Yara Campos', observacoes: 'Local: Condomínio Parque Chapada dos Campos', cidade: 'Várzea Grande', estado: 'MT', logradouro: null, numero: null, bairro: null, valor_contratado: 65000 };

function workspace(perfil = 'administrador') {
  render(<AuthContext.Provider value={{ user: { id: 1, nome: 'Bruna', email: 'teste@voia.local', perfil }, loading: false, login: async () => {}, logout: async () => {} }}><MemoryRouter initialEntries={['/projetos/9']}><Routes><Route path="/projetos/:id" element={<ProjetoWorkspace />} /></Routes></MemoryRouter></AuthContext.Provider>);
}
const resposta = (value: object) => new Response(JSON.stringify(value), { status: 200 });

describe('gestão dos projetos sem etapa', () => {
  it('remoção de documento exige confirmação clara antes de enviar DELETE', async () => {
    let documentos = [{ id: 1, nome: 'Anexo por engano', categoria: 'outros', etapa_id: null, nome_arquivo_original: 'anexo.txt', tamanho_bytes: 10, visivel_cliente: 0, visivel_parceiro: 0, criado_em: '2026-10-14 09:00:00' }];
    const mock = vi.fn(async (url: string, init?: RequestInit) => { if (init?.method === 'DELETE') { documentos = []; return resposta({ ok: true }); } return resposta(url.endsWith('/etapas') ? { etapas: [] } : { documentos }); });
    vi.stubGlobal('fetch', mock); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); const user = userEvent.setup();
    render(<DocumentosPanel projetoId={9} podeEditar podeExcluir />);
    await screen.findByText('Anexo por engano'); await user.click(screen.getByLabelText('Ações de Anexo por engano'));
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    expect(mock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    expect(confirm.mock.calls[0][0]).toContain('registros relacionados serão preservados');
    confirm.mockReturnValue(true); await user.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(screen.queryByText('Anexo por engano')).toBeNull());
  });
  it('exibe as cinco tarefas da Yara, progresso por tarefas e nenhuma etapa falsamente concluída', async () => {
    const tarefas = analisarTexto(textoYara).acoes.map((a, i) => ({ id: i + 1, etapa_id: null, nome: a.nome, prazo: a.prazo, status: 'pendente', prioridade: 'normal', responsavel_nome: i === 0 ? 'Bruna' : null }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => resposta(url.endsWith('/etapas') ? { etapas: [], progresso: 20, baseadoEm: 'tarefas', totalEtapas: 0, etapasConcluidas: 0, totalTarefas: 5, tarefasConcluidas: 1 } : url.endsWith('/tarefas') ? { tarefas } : { tiposServicoDisponiveis: [] })));
    render(<EtapasPanel projetoId={9} podeEditar={false} podeExcluir={false} onProgressoChange={vi.fn()} />);
    expect(await screen.findByText('Sem etapa definida.')).toBeTruthy();
    expect(screen.queryByText('Todas as etapas concluídas.')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Tarefas sem etapa' })).toBeTruthy();
    tarefas.forEach(t => expect(screen.getByText(t.nome)).toBeTruthy());
    expect(screen.getByText('1 de 5 tarefas concluídas')).toBeTruthy();
    expect(screen.getByText(/Responsável: Bruna/)).toBeTruthy();
  });

  it('só exclui tarefa depois da confirmação e de dentro do menu discreto', async () => {
    let tarefas = [{ id: 1, etapa_id: null, nome: 'Tarefa por engano', prazo: null, status: 'pendente', prioridade: 'normal', responsavel_nome: null }];
    const mock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') { tarefas = []; return resposta({ ok: true }); }
      return resposta(url.endsWith('/etapas') ? { etapas: [], progresso: 0, baseadoEm: 'tarefas', totalEtapas: 0, etapasConcluidas: 0, totalTarefas: tarefas.length, tarefasConcluidas: 0 } : url.endsWith('/tarefas') ? { tarefas } : { tiposServicoDisponiveis: [] });
    });
    vi.stubGlobal('fetch', mock); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); const user = userEvent.setup();
    render(<EtapasPanel projetoId={9} podeEditar podeExcluir onProgressoChange={vi.fn()} />);
    await screen.findByText('Tarefa por engano');
    await user.click(screen.getByLabelText('Ações de Tarefa por engano'));
    await user.click(screen.getByRole('button', { name: 'Excluir tarefa' }));
    expect(mock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    confirm.mockReturnValue(true); await user.click(screen.getByRole('button', { name: 'Excluir tarefa' }));
    await waitFor(() => expect(screen.queryByText('Tarefa por engano')).toBeNull());
    expect(mock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1);
  });

  it('preserva condomínio e separa cidade/UF do endereço pendente na visão geral', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta({ projeto, tiposServico: [], resumoOperacional: { totalEtapas: 0, etapaAtual: null, tarefasAtrasadas: 0, proximoPrazo: null } })));
    workspace();
    expect(await screen.findByText('Condomínio Parque Chapada dos Campos')).toBeTruthy();
    expect(screen.getByText('Não informado — pendente')).toBeTruthy();
    expect(screen.getByText('Várzea Grande')).toBeTruthy(); expect(screen.getByText('MT')).toBeTruthy();
    expect(screen.getByText('Sem etapa definida.')).toBeTruthy(); expect(screen.queryByText('Todas as etapas concluídas.')).toBeNull();
  });

  it('permite cancelar cadastro por engano mediante confirmação, preservando os relacionamentos', async () => {
    const mock = vi.fn(async (_url: string, init?: RequestInit) => resposta(init?.method === 'PATCH' ? { projeto: { ...projeto, status: 'cancelado' } } : { projeto, tiposServico: [], resumoOperacional: { totalEtapas: 0, etapaAtual: null, tarefasAtrasadas: 0, proximoPrazo: null } }));
    vi.stubGlobal('fetch', mock); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true); const user = userEvent.setup();
    workspace(); await screen.findByText('Projeto Yara');
    await user.click(screen.getByText('Mais ações...'));
    await user.click(screen.getByRole('button', { name: 'Cancelar cadastro criado por engano' }));
    await waitFor(() => expect(mock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true));
    expect(confirm.mock.calls[0][0]).toContain('nenhum registro será excluído');
    expect(mock.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body).toBe(JSON.stringify({ status: 'cancelado' }));
    expect(mock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

  it('não oferece cancelamento administrativo ao parceiro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta({ projeto, tiposServico: [], resumoOperacional: { totalEtapas: 0, etapaAtual: null, tarefasAtrasadas: 0, proximoPrazo: null } })));
    workspace('colaborador'); await screen.findByText('Projeto Yara');
    expect(screen.queryByText('Mais ações...')).toBeNull();
  });
});

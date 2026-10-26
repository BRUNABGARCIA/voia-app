import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import NovoTrabalhoInteligenteModal from '../../src/react-app/components/NovoTrabalhoInteligenteModal';
import { textoYara } from '../fixtures/yara';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function abrirRevisao() {
  const user = userEvent.setup();
  const fechar = vi.fn();
  render(<MemoryRouter><NovoTrabalhoInteligenteModal onClose={fechar} /></MemoryRouter>);
  const analisar = screen.getByRole('button', { name: 'Analisar e organizar →' });
  expect((analisar as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Texto, conversa ou briefing'), { target: { value: textoYara } });
  expect((analisar as HTMLButtonElement).disabled).toBe(false);
  await user.click(analisar);
  expect(screen.getByText('2: revisão', { exact: false })).toBeTruthy();
  expect(screen.queryByLabelText('Texto, conversa ou briefing')).toBeNull();
  return { user, fechar };
}

describe('Modal real do Cadastro Inteligente — Yara', () => {
  it('aceita mais de três anexos, acumula seleções, impede duplicatas e remove só o arquivo escolhido', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());
    render(<MemoryRouter><NovoTrabalhoInteligenteModal onClose={vi.fn()} /></MemoryRouter>);
    const input = screen.getByLabelText('Propostas e documentos');
    const files = Array.from({ length: 7 }, (_, i) => new File([`documento ${i}`], `arquivo-${i}.txt`, { type: 'text/plain' }));
    await user.upload(input, files.slice(0, 3));
    await waitFor(() => expect(screen.getByText('3 arquivos selecionados')).toBeTruthy());
    await user.upload(input, files.slice(3));
    await waitFor(() => expect(screen.getByText('7 arquivos selecionados')).toBeTruthy());
    await user.upload(input, new File(['documento 0'], 'arquivo-0.txt', { type: 'text/plain' }));
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
    expect(screen.getByText('7 arquivos selecionados')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remover arquivo-3.txt' }));
    expect(screen.getByText('6 arquivos selecionados')).toBeTruthy();
    expect(screen.queryByText('arquivo-3.txt')).toBeNull();
    expect(screen.getByText('arquivo-0.txt')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('mantém imagens não analisáveis anexáveis e só envia o documento após confirmar', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/clientes' ? { cliente: { id: 7 } } : url === '/api/projetos' ? { projeto: { id: 9 } } : url.endsWith('/etapas') ? { etapa: { id: 42 } } : { ok: true }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup(); const fechar = vi.fn();
    render(<MemoryRouter><NovoTrabalhoInteligenteModal onClose={fechar} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Texto, conversa ou briefing'), { target: { value: textoYara } });
    await user.upload(screen.getByLabelText('Propostas e documentos'), new File([new Uint8Array([255, 216, 255])], 'foto.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect((screen.getByLabelText('Propostas e documentos') as HTMLInputElement).disabled).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Analisar e organizar →' }));
    expect(await screen.findByText('○ Será apenas anexado')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Confirmar e criar →' }));
    await waitFor(() => expect(fechar).toHaveBeenCalled());
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/documentos'))).toHaveLength(3);
  });

  it('bloqueia confirmação até resolver conflito entre dois documentos', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const user = userEvent.setup();
    render(<MemoryRouter><NovoTrabalhoInteligenteModal onClose={vi.fn()} /></MemoryRouter>);
    await user.upload(screen.getByLabelText('Propostas e documentos'), [new File(['Cliente: Lincoln e Nayara\nPrazo: 20 dias'], 'proposta.txt', { type: 'text/plain' }), new File(['Prazo: 25 dias'], 'termo.txt', { type: 'text/plain' })]);
    await waitFor(() => expect((screen.getByLabelText('Propostas e documentos') as HTMLInputElement).disabled).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Analisar e organizar →' }));
    expect(await screen.findByText('Conflito identificado')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Confirmar e criar →' }) as HTMLButtonElement).disabled).toBe(true);
    const escolha = screen.getByLabelText('Resolver conflito: Prazo informado');
    await user.selectOptions(escolha, '1');
    expect((screen.getByRole('textbox', { name: 'Prazo informado' }) as HTMLInputElement).value).toBe('25 dias');
    expect((screen.getByRole('button', { name: 'Confirmar e criar →' }) as HTMLButtonElement).disabled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('Analisar e organizar abre revisão editável com as ações e pendências, sem gravar', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const { user, fechar } = await abrirRevisao();
    const valor = (label: string) => (screen.getByLabelText(label, { exact: true }) as HTMLInputElement).value;
    expect(valor('Nome')).toBe('Yara Campos');
    expect(valor('WhatsApp')).toBe('+55 65 9944-4550');
    expect(valor('Origem')).toBe('WhatsApp');
    expect(valor('Cidade')).toBe('Várzea Grande');
    expect(valor('UF')).toBe('MT');
    expect(valor('Local')).toBe('Condomínio Parque Chapada dos Campos');
    expect(valor('Serviço / resumo')).toBe('Acompanhamento técnico + emissão de ART');
    expect(valor('Valor')).toBe('R$ 650,00');
    expect((screen.getByLabelText('Status operacional') as HTMLSelectElement).value).toBe('planejamento');
    expect((screen.getByLabelText('Fase comercial') as HTMLSelectElement).value).toBe('aprovada');
    expect(valor('Endereço completo')).toBe(''); expect(valor('Forma de pagamento')).toBe('');
    const valores = (label: string) => screen.getAllByLabelText(label, { exact: true }).map(e => (e as HTMLInputElement).value);
    expect(valores('Ação')).toEqual(['Vistoria inicial', 'Emitir ART', 'Vistoria final', 'Follow-up de 15 dias', 'Follow-up de 30 dias']);
    expect(valores('Data (vazio = a agendar)')).toEqual(['2026-10-15', '', '', '2026-10-30', '2026-11-14']);
    expect(valores('Horário')).toEqual(['09:00', '', '', '', '']);
    expect(valores('Descrição / dependência')[1]).toBe('Após a vistoria inicial.');
    expect(screen.getByText('Endereço completo: não informado.')).toBeTruthy();
    expect(screen.getByText('Forma de pagamento: não informada.')).toBeTruthy();
    expect(screen.getByText('Vistoria final: a agendar.')).toBeTruthy();
    const confirmar = screen.getByRole('button', { name: 'Confirmar e criar →' }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    await user.clear(screen.getByLabelText('Nome', { exact: true }));
    await user.type(screen.getByLabelText('Nome', { exact: true }), 'Yara Campos revisado');
    expect(valor('Nome')).toBe('Yara Campos revisado');
    await user.click(screen.getByRole('checkbox'));
    expect(confirmar.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Várzea Grande revisada' } });
    expect(confirmar.disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled(); expect(fechar).not.toHaveBeenCalled();
  });

  it('só Confirmar e criar envia os dados editados, com status correto e sem requisição de Obra', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/clientes' ? { cliente: { id: 7 } } : url === '/api/projetos' ? { projeto: { id: 9 } } : url.endsWith('/etapas') ? { etapa: { id: 42 } } : { ok: true }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { user, fechar } = await abrirRevisao();
    fireEvent.change(screen.getByLabelText('Nome', { exact: true }), { target: { value: 'Yara Campos revisado' } });
    await user.click(screen.getByRole('checkbox'));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar e criar →' }));
    await waitFor(() => expect(fechar).toHaveBeenCalledTimes(1));
    const chamadas = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(chamadas).toHaveLength(13);
    expect(JSON.parse(chamadas[0][1].body as string).nome).toBe('Yara Campos revisado');
    expect(JSON.parse(chamadas[1][1].body as string)).toMatchObject({ status: 'planejamento', fase_comercial: 'aprovada', valor_contratado: 65000 });
    expect(chamadas.filter(([url]) => url.endsWith('/tarefas'))).toHaveLength(5);
    expect(chamadas.some(([url]) => url.includes('/obras'))).toBe(false);
  });

  it('mostra falha de criação e mantém o modal aberto, sem avançar para projeto ou tarefas', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'Não foi possível criar o cliente.' }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const { user, fechar } = await abrirRevisao();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Confirmar e criar →' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Não foi possível criar o cliente.'));
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(fechar).not.toHaveBeenCalled();
  });
});

import PlanoExecucaoEditor from './PlanoExecucaoEditor';
import { FASES_COMERCIAIS, FASE_COMERCIAL_LABEL } from '../../shared/operacao-voia';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import AnexosTrabalho from './AnexosTrabalho';
import { adicionarArquivos, analisarAnexo, type AnaliseAnexo } from '../lib/documentos-texto';
import { consolidarTrabalho, resolverCampo, type Conflito } from '../lib/consolidar-trabalho';
import { criarTrabalho, valorEmCentavos, type ProgressoCriacao, type Rascunho } from '../lib/novo-trabalho';

export default function NovoTrabalhoInteligenteModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const [analises, setAnalises] = useState<Map<File, AnaliseAnexo>>(new Map());
  const [conflitos, setConflitos] = useState<Conflito[]>([]);
  const [evidencias, setEvidencias] = useState<{ campo: string; fontes: string[] }[]>([]);
  const [cidadeConfirmada, setCidadeConfirmada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [iniciado, setIniciado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const progresso = useRef<ProgressoCriacao>({ tarefas: 0, documentos: 0 });
  const ocupado = useRef(false);
  async function selecionar(files: File[]) {
    if (selecionando || analisando || iniciado) return;
    setSelecionando(true); setErro(null);
    try {
      const resultado = await adicionarArquivos(arquivos, files);
      setArquivos(resultado.arquivos); setRascunho(null);
      if (resultado.erros.length) setErro(resultado.erros.join(' '));
    } catch { setErro('Não foi possível ler os arquivos selecionados.'); }
    finally { setSelecionando(false); }
  }
  function remover(file: File) { setArquivos(atual => atual.filter(f => f !== file)); setRascunho(null); setConflitos([]); }
  function removerAcao(indice: number) {
    if (!rascunho) return;
    setRascunho({ ...rascunho, acoes: rascunho.acoes.filter((_, n) => n !== indice) });
    setConflitos(atual => atual.filter(c => !c.campo.startsWith(`acoes.${indice}.`)).map(c => {
      const partes = c.campo.split('.');
      if (partes[0] === 'acoes' && Number(partes[1]) > indice) partes[1] = String(Number(partes[1]) - 1);
      return { ...c, campo: partes.join('.') };
    }));
  }
  async function analisar() {
    if (texto.length > 1_000_000) { setErro('O texto colado excede um milhão de caracteres. Divida o conteúdo antes de analisar.'); return; }
    setAnalisando(true); setErro(null); setCidadeConfirmada(false);
    try {
      const fontes = texto.trim() ? [{ nome: 'Texto colado', texto }] : [];
      const resultados = new Map<File, AnaliseAnexo>();
      let caracteres = texto.length;
      for (const file of arquivos) {
        let resultado = await analisarAnexo(file);
        if (resultado.status === 'analisado' && caracteres + resultado.texto.length > 1_000_000) resultado = { status: 'falhou', texto: '', motivo: 'Limite de um milhão de caracteres na revisão consolidada. Este arquivo será apenas anexado.' };
        resultados.set(file, resultado); setAnalises(new Map(resultados));
        if (resultado.status === 'analisado') { fontes.push({ nome: arquivos.filter(a => a.name === file.name).length > 1 ? `${file.name} (seleção ${arquivos.indexOf(file) + 1})` : file.name, texto: resultado.texto }); caracteres += resultado.texto.length; }
      }
      const revisao = consolidarTrabalho(fontes);
      setAnalises(resultados); setConflitos(revisao.conflitos); setEvidencias(revisao.evidencias); setRascunho(revisao.rascunho);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível analisar o conteúdo.'); }
    finally { setAnalisando(false); }
  }
  async function salvar() {
    if (!rascunho || ocupado.current) return;
    if (conflitos.some(c => !c.resolvido)) { setErro('Resolva os conflitos entre fontes antes de criar.'); return; }
    setErro(null);
    if (!['prospeccao','em_andamento', 'planejamento','concluido','cancelado','aguardando_cliente','aguardando_terceiro','pausado'].includes(rascunho.projeto.status) || !rascunho.cliente.nome.trim() || !rascunho.projeto.nome.trim() || rascunho.acoes.some(a => !a.nome.trim())) { setErro('Preencha o nome do cliente, do trabalho e das ações.'); return; }
    if (rascunho.cidadeSugerida && !cidadeConfirmada) { setErro('Confirme ou corrija a cidade sugerida antes de criar.'); return; }
    try { valorEmCentavos(rascunho.projeto.valor); } catch (e) { setErro((e as Error).message); return; }
    ocupado.current = true; setSalvando(true); setIniciado(true);
    try {
      const id = await criarTrabalho(rascunho, arquivos, progresso.current);
      onClose(); navigate(`/projetos/${id}`);
    } catch (e) {
      setErro(`${e instanceof Error ? e.message : 'Não foi possível criar.'} O cadastro pode estar parcialmente criado. Tente novamente aqui para continuar de onde parou.`);
    } finally { ocupado.current = false; setSalvando(false); }
  }
  const cliente = (campo: keyof Rascunho['cliente'], valor: string) => rascunho && setRascunho({ ...rascunho, cliente: { ...rascunho.cliente, [campo]: valor } });
  const projeto = (campo: keyof Rascunho['projeto'], valor: string) => rascunho && setRascunho({ ...rascunho, projeto: { ...rascunho.projeto, [campo]: valor } });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><div role="dialog" aria-modal="true" aria-labelledby="novo-trabalho-titulo" className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[24px] bg-white shadow-2xl">
    <div className="flex items-start justify-between border-b border-black/5 px-8 py-6"><div><div className="text-xs font-bold uppercase tracking-[.2em] text-amber-600">Cadastro inteligente · Etapa {rascunho ? '2: revisão' : '1: conteúdo'}</div><h2 id="novo-trabalho-titulo" className="mt-2 text-2xl font-semibold">Novo trabalho</h2><p className="mt-1 text-sm text-neutral-500">{rascunho ? 'Revise e edite os dados antes de confirmar. Nenhum cadastro foi salvo pela análise.' : 'Cole a conversa e adicione documentos. O conteúdo extraível será combinado numa revisão; os anexos só serão enviados após sua confirmação.'}</p></div><button disabled={salvando || analisando} aria-label="Fechar" onClick={onClose} className="text-2xl text-neutral-400 hover:text-black">×</button></div>
    {!rascunho ? <div className="grid gap-6 p-8 md:grid-cols-[1.5fr_1fr]"><label className="text-sm font-semibold">Texto, conversa ou briefing<textarea disabled={analisando || selecionando} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Cole aqui WhatsApp, briefing, anotações, escopo, valor, datas..." className="mt-2 min-h-80 w-full resize-y rounded-2xl border border-neutral-200 p-4 text-sm" /></label><AnexosTrabalho arquivos={arquivos} analises={analises} disabled={selecionando || analisando || iniciado} selecionar={selecionar} remover={remover} /></div> : <div className="p-8"><fieldset disabled={iniciado} className="grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl border border-neutral-200 p-5"><h3 className="font-semibold">Cliente</h3><div className="mt-4 grid gap-3">{([['nome', 'Nome'], ['whatsapp', 'WhatsApp'], ['origem', 'Origem'], ['cidade', 'Cidade'], ['estado', 'UF'], ['endereco', 'Endereço completo']] as const).map(([k, label]) => <Field key={k} label={label} value={rascunho.cliente[k]} onChange={v => { cliente(k, v); if (k === 'cidade' || k === 'estado') setCidadeConfirmada(false); }} />)}</div></section>
      <section className="rounded-2xl border border-neutral-200 p-5"><h3 className="font-semibold">Projeto / serviço</h3><div className="mt-4 grid gap-3">{([['nome', 'Nome do trabalho'], ['descricao', 'Serviço / resumo'], ['valor', 'Valor'], ['local', 'Local'], ['pagamento', 'Forma de pagamento'], ['observacoes', 'Observações'], ['prazoInformado', 'Prazo informado']] as const).map(([k, label]) => <Field key={k} label={label} value={rascunho.projeto[k]} onChange={v => projeto(k, v)} />)}<label className="text-xs text-neutral-500">Status operacional<select value={rascunho.projeto.status} onChange={e => projeto('status', e.target.value)} className="mt-1 block w-full rounded-xl border p-2 text-sm"><option value="">Situação não resolvida</option><option value="planejamento">Em planejamento / proposta não confirmada</option><option value="prospeccao">Em prospecção</option><option value="em_andamento">Execução em andamento</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option><option value="aguardando_cliente">Aguardando cliente</option><option value="aguardando_terceiro">Aguardando terceiro</option><option value="pausado">Pausado</option></select></label></div></section>
      <label className="text-sm md:col-span-2">Fase comercial<select value={rascunho.projeto.fase_comercial||''} onChange={e=>projeto('fase_comercial',e.target.value)} className="mt-1 block w-full rounded-xl border p-2"><option value="">Não informada</option>{FASES_COMERCIAIS.map(f=><option key={f} value={f}>{FASE_COMERCIAL_LABEL[f]}</option>)}</select></label><PlanoExecucaoEditor r={rascunho} alterar={setRascunho}/><section className="rounded-2xl border border-neutral-200 p-5 md:col-span-2"><h3 className="font-semibold">Próximas ações sugeridas</h3><p className="mt-1 text-xs text-neutral-500">Datas de follow-up usam a vistoria inicial como referência. Confira cada data. ART sem prazo será emitida após a vistoria quando indicado.</p>{rascunho.acoes.map((a, i) => <div key={i} className="mt-4 grid gap-3 rounded-xl bg-neutral-50 p-3 sm:grid-cols-2">{(['nome', 'prazo', 'hora', 'descricao'] as const).map(k => <Field key={k} label={{ nome: 'Ação', prazo: 'Data (vazio = a agendar)', hora: 'Horário', descricao: 'Descrição / dependência' }[k]} type={k === 'prazo' ? 'date' : k === 'hora' ? 'time' : 'text'} value={a[k] || ''} onChange={v => setRascunho({ ...rascunho, acoes: rascunho.acoes.map((x, n) => n === i ? { ...x, [k]: v || (k === 'prazo' ? null : '') } : x) })} />)}<button onClick={() => removerAcao(i)} className="text-left text-xs text-red-600">Remover ação</button></div>)}<button onClick={() => setRascunho({ ...rascunho, acoes: [...rascunho.acoes, { nome: '', prazo: null, hora: '', descricao: '' }] })} className="mt-3 text-sm font-semibold">+ Adicionar ação</button></section>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 md:col-span-2"><h3 className="font-semibold">Confirme antes de criar</h3>{rascunho.cidadeSugerida && <label className="mt-3 block text-sm"><input type="checkbox" checked={cidadeConfirmada} onChange={e => setCidadeConfirmada(e.target.checked)} /> Confirmo a cidade e UF: {rascunho.cliente.cidade || 'não informada'}/{rascunho.cliente.estado || 'não informada'} (sugestão a partir de “VG”).</label>}<ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{!rascunho.cliente.endereco && <li>Endereço completo: não informado.</li>}{!rascunho.projeto.pagamento && <li>Forma de pagamento: não informada.</li>}{rascunho.acoes.some(a => a.nome === 'Vistoria final' && !a.prazo) && <li>Vistoria final: a agendar.</li>}<li>Será criado um projeto/serviço. Nenhuma Obra será criada.</li></ul><p className="mt-3 text-xs">Documentos a vincular: {arquivos.length ? arquivos.map(a => a.name).join(', ') : 'nenhum anexo'}. A análise não gera uma ART emitida.</p></section>
      {conflitos.length > 0 && <section className="rounded-2xl border border-red-200 bg-red-50 p-5 md:col-span-2"><h3 className="font-semibold">Conflito identificado</h3><p className="mt-1 text-sm">Nenhuma fonte é escolhida automaticamente. Escolha um valor e ajuste o campo correspondente se necessário.</p>{conflitos.map((c, i) => <label key={c.campo} className="mt-3 block text-sm">{c.label}<select aria-label={`Resolver conflito: ${c.label}`} value={c.resolvido ? 'resolvido' : ''} onChange={e => { const opcao = c.opcoes[Number(e.target.value)]; if (!opcao) return; setRascunho(resolverCampo(rascunho, c.campo, opcao.valor)); setConflitos(conflitos.map((x,n) => n === i ? { ...x, resolvido: true } : x)); if (c.campo === 'cliente.cidade' || c.campo === 'cliente.estado') setCidadeConfirmada(false); }} className="mt-1 block w-full rounded-xl border bg-white p-2"><option value="">Escolha uma informação</option>{c.resolvido && <option value="resolvido">Conflito revisado — confira o campo editável</option>}{c.opcoes.map((o,n) => <option key={n} value={n}>{o.valor} — {o.fontes.join(', ')}</option>)}</select></label>)}</section>}
      <details className="text-xs text-neutral-500 md:col-span-2"><summary>Fontes das informações identificadas</summary>{evidencias.map(e => <p key={e.campo}>{e.campo}: {e.fontes.join(', ')}</p>)}</details>
    </fieldset><div className="mt-5"><AnexosTrabalho arquivos={arquivos} analises={analises} disabled={selecionando || analisando || iniciado} selecionar={selecionar} remover={remover} /></div></div>}
    {erro && <div role="alert" className="mx-8 mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 bg-neutral-50 px-8 py-5"><p className="text-xs text-neutral-500">Você revisa antes de qualquer cadastro.</p><div className="flex gap-2"><button disabled={salvando || iniciado || analisando} onClick={rascunho ? () => { setRascunho(null); setErro(null); } : onClose} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold">{rascunho ? 'Voltar' : 'Cancelar'}</button>{!rascunho ? <button disabled={analisando || selecionando || (!texto.trim() && !arquivos.length)} onClick={analisar} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold disabled:opacity-40">{analisando ? 'Analisando documentos…' : 'Analisar e organizar →'}</button> : <button disabled={salvando || conflitos.some(c => !c.resolvido) || (rascunho.cidadeSugerida && !cidadeConfirmada)} onClick={salvar} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold disabled:opacity-40">{salvando ? 'Criando…' : iniciado ? 'Continuar criação →' : 'Confirmar e criar →'}</button>}</div></div>
  </div></div>;
}
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="block"><span className="text-xs font-medium text-neutral-500">{label}</span><input type={type} value={value} placeholder={type === 'text' ? 'Não informado' : undefined} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-amber-400 disabled:bg-neutral-100" /></label>;
}

import { identificarFase } from '../../shared/operacao-voia';
import { sugerirPlano } from './plano-trabalho';
import { analisarTexto, sugerirFollowups, type Rascunho } from './novo-trabalho';
export type FonteTrabalho = { nome: string; texto: string };
export type Conflito = { campo: string; label: string; opcoes: { valor: string; fontes: string[] }[]; resolvido: boolean };
const normalizar = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function consolidarTrabalho(fontes: FonteTrabalho[]) {
  const dados = fontes.map(f => { const r = analisarTexto(f.texto); if (!r.cliente.origem && /^WhatsApp$/i.test(f.nome)) r.cliente.origem = 'WhatsApp'; return { fonte: f, r }; });
  const rascunho = analisarTexto('');
  const conflitos: Conflito[] = [];
  const evidencias: { campo: string; fontes: string[] }[] = [];
  function escolher(campo: string, label: string, candidatos: { valor: string; fonte: string }[], definir: (v: string) => void) {
    const opcoes: Conflito['opcoes'] = [];
    for (const c of candidatos.filter(c => c.valor.trim())) {
      const igual = opcoes.find(o => normalizar(o.valor) === normalizar(c.valor));
      if (igual) { if (!igual.fontes.includes(c.fonte)) igual.fontes.push(c.fonte); }
      else opcoes.push({ valor: c.valor, fontes: [c.fonte] });
    }
    if (opcoes.length > 1) { definir(''); conflitos.push({ campo, label, opcoes, resolvido: false }); }
    else if (opcoes.length === 1) { definir(opcoes[0].valor); evidencias.push({ campo: label, fontes: opcoes[0].fontes }); }
  }
  const labelsCliente = { nome: 'Nome do cliente', whatsapp: 'WhatsApp', origem: 'Origem', cidade: 'Cidade', estado: 'UF', endereco: 'Endereço completo' };
  const labelsProjeto = { descricao: 'Serviço', valor: 'Valor', local: 'Local/Condomínio', pagamento: 'Forma de pagamento', prazoInformado: 'Prazo informado' };
  function candidatos(grupo: 'cliente' | 'projeto', campo: string) {
    const rotulos: Record<string, string> = { nome: '(?:nome|cliente|contratantes?|nome do cliente)', whatsapp: '(?:whatsapp|celular|telefone)', origem: 'origem', cidade: 'cidade', estado: '(?:estado|UF)', endereco: 'endereço(?: completo)?', descricao: '(?:serviço|escopo)', valor: '(?:valor|investimento)', local: 'local', pagamento: '(?:forma de pagamento|pagamento)', prazoInformado: 'prazo(?: de entrega)?' };
    return dados.flatMap(d => {
      if(grupo==='projeto'&&campo==='valor') {
        const valores=[...new Set([...d.fonte.texto.matchAll(/R\$\s*(\d[\d.]*(?:,\d{1,2})?)/gi)].map(m=>`R$ ${m[1]}`))];
        if(valores.length>1&&(d.fonte.texto.match(/^\s*(?:valor|investimento)\s*:/gim)||[]).length<2)return valores.map((valor,i)=>({valor,fonte:`${d.fonte.nome} (valor ${i+1})`}));
      }
      const base = { valor: (d.r[grupo] as Record<string, string>)[campo], fonte: d.fonte.nome };
      const linhas = d.fonte.texto.split(/\r?\n/).map((linha, indice) => ({ linha, indice })).filter(l => new RegExp(`^\\s*${rotulos[campo]}\\s*:`, 'i').test(l.linha));
      // Repetições conflitantes de um campo rotulado dentro do mesmo arquivo
      // também precisam de decisão, em vez de usar apenas a primeira ocorrência.
      if (linhas.length < 2) return [base];
      return linhas.map(l => ({ valor: (analisarTexto(l.linha)[grupo] as Record<string, string>)[campo], fonte: `${d.fonte.nome} (linha ${l.indice + 1})` }));
    });
  }
  for (const campo of ['nome', 'whatsapp', 'origem', 'cidade', 'estado', 'endereco'] as const) escolher(`cliente.${campo}`, labelsCliente[campo], candidatos('cliente', campo), v => { rascunho.cliente[campo] = v; });
  for (const campo of ['descricao', 'valor', 'local', 'pagamento', 'prazoInformado'] as const) escolher(`projeto.${campo}`, labelsProjeto[campo], candidatos('projeto', campo), v => { rascunho.projeto[campo] = v; });
  const situacoes = dados.filter(d => d.r.projeto.status === 'em_andamento' || /proposta\s+(?:pendente|não aprovada)|não\s+(?:fechou|aprovou)/i.test(d.fonte.texto));
  escolher('projeto.status', 'Situação da proposta', situacoes.map(d => ({ valor: d.r.projeto.status, fonte: d.fonte.nome })), v => { rascunho.projeto.status = v; });
  rascunho.cidadeSugerida = dados.some(d => d.r.cidadeSugerida);
  rascunho.projeto.nome = `${rascunho.projeto.descricao || 'Novo trabalho'}${rascunho.cliente.nome ? ` — ${rascunho.cliente.nome}` : ''}`;
  // Une ações pelo nome, preservando divergências de datas/horários para decisão.
  const nomes = [...new Set(dados.flatMap(d => d.r.acoes.map(a => a.nome)))];
  for (const nome of nomes) {
    const correspondentes = dados.flatMap(d => d.r.acoes.filter(a => a.nome === nome).map(a => ({ a, fonte: d.fonte.nome })));
    const indice = rascunho.acoes.length;
    const acao = { nome, prazo: null as string | null, hora: '', descricao: '' };
    for (const campo of ['prazo', 'hora', 'descricao'] as const) escolher(`acoes.${indice}.${campo}`, `${nome} · ${campo}`, correspondentes.map(c => ({ valor: c.a[campo] || '', fonte: c.fonte })), v => { if (campo === 'prazo') acao.prazo = v || null; else acao[campo] = v; });
    rascunho.acoes.push(acao);
  }
  const vistoria = rascunho.acoes.find(a => a.nome === 'Vistoria inicial');
  if (vistoria?.prazo) {
    for (const acao of sugerirFollowups(vistoria.prazo, fontes.map(f => f.texto).join('\n'))) {
      if (!rascunho.acoes.some(a => a.nome === acao.nome)) rascunho.acoes.push(acao);
    }
  }
  const explicitas = fontes.map(f => identificarFase(f.texto));
  const fases = fontes.map((f,i) => ({ valor: explicitas[i] || (!explicitas.some(Boolean) && /proposta|orçamento/i.test(f.nome + ' ' + f.texto) ? 'aguardando_retorno' : ''), fonte: f.nome }));
  escolher('projeto.fase_comercial', 'Fase comercial', fases, v => { rascunho.projeto.fase_comercial = v ? v as NonNullable<typeof rascunho.projeto.fase_comercial> : null; });
  const planejado = sugerirPlano(rascunho, fontes.map(f => f.texto).join('\n'));
  if (conflitos.some(c => c.campo === 'projeto.fase_comercial')) planejado.projeto.fase_comercial = null;
  return { rascunho: planejado, conflitos, evidencias };
}

export function resolverCampo(r: Rascunho, caminho: string, valor: string): Rascunho {
  const [grupo, campo, atributo] = caminho.split('.');
  if (grupo === 'cliente') return { ...r, cliente: { ...r.cliente, [campo]: valor } };
  if (grupo === 'projeto') return { ...r, projeto: { ...r.projeto, [campo]: valor } };
  return { ...r, acoes: r.acoes.map((a, i) => i === Number(campo) ? { ...a, [atributo]: valor || (atributo === 'prazo' ? null : '') } : a) };
}

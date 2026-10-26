import { identificarFase, condicionadaAoAceite, dataValida, type FaseComercial, type EstadoDocumento } from '../../shared/operacao-voia';
export type Acao = { nome: string; prazo: string | null; hora: string; descricao: string; etapaChave?: string | null; responsavel_id?: number | null; status?: 'pendente' | 'aguardando' };
export type EtapaSugerida = { chave: string; nome: string; ordem: number; inicio: string | null; fim: string | null };
export type DocumentoEsperado = { nome: string; categoria: string; estado: EstadoDocumento; prazo: string | null; etapaChave: string | null };
export type Rascunho = {
  cliente: { nome: string; whatsapp: string; origem: string; cidade: string; estado: string; endereco: string };
  projeto: { nome: string; descricao: string; valor: string; status: string; local: string; pagamento: string; observacoes: string; prazoInformado: string; fase_comercial?: FaseComercial | null; tipo_servico_ids?:number[] };
  acoes: Acao[];
  cidadeSugerida: boolean;
  etapas?: EtapaSugerida[];
  documentosEsperados?: DocumentoEsperado[];
};

function somarDias(iso: string, dias: number) {
  const data = new Date(`${iso}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

export function sugerirFollowups(visitaISO: string, texto: string): Acao[] {
  return [15, 30].filter(dias => new RegExp(`(?:follow[ -]?up|perguntar|retornar|contatar)[^\\n.]{0,180}\\b${dias}\\s+dias\\b`, 'i').test(texto)).map(dias => ({ nome: `Follow-up de ${dias} dias`, prazo: somarDias(visitaISO, dias), hora: '', descricao: 'Data sugerida a partir da vistoria inicial. Confirme a referência.' }));
}

// Extrai apenas evidências do texto. Campos ausentes permanecem vazios.
export function analisarTexto(texto: string, anoReferencia = new Date().getFullYear()): Rascunho {
  const campo = (rotulo: string) => texto.match(new RegExp(`(?:^|\\n)\\s*${rotulo}\\s*:\\s*([^\\n\\r]+)`, 'i'))?.[1]?.trim() || '';
  const nome = campo('(?:nome|cliente|contratantes?|nome do cliente)') || texto.match(/\b[Cc]liente\s+([\p{Lu}][\p{L}]+(?:[ \t]+(?:e[ \t]+)?[\p{Lu}][\p{L}]+)*)/u)?.[1] || '';
  const tel = texto.match(/(?:\+?55[\s.-]*)?\(?([1-9]\d)\)?[\s.-]*(\d{4,5})[-\s]?(\d{4})\b/);
  const whatsapp = tel ? `+55 ${tel[1]} ${tel[2]}-${tel[3]}` : '';
  const valor = texto.match(/R\$\s*(\d[\d.]*(?:,\d{1,2})?)/i)?.[1] || '';
  const visita = texto.match(/(?:primeira\s+vistoria|vistoria\s+inicial)[^\d\n]*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:[^\d\n]*(\d{1,2})(?:[:h](\d{2}))?)?/i);
  let visitaISO: string | null = null;
  let hora = '';
  if (visita) {
    // Uma data de mensagem é evidência para o ano de uma vistoria sem ano.
    // Só a usamos quando não há anos conflitantes no conteúdo.
    const anosInformados = [...new Set(Array.from(texto.matchAll(/\b\d{1,2}\/\d{1,2}\/(\d{4})\b/g), m => Number(m[1])))];
    const ano = visita[3] ? Number(visita[3].length === 2 ? `20${visita[3]}` : visita[3]) : anosInformados.length === 1 ? anosInformados[0] : anoReferencia;
    const iso = `${ano}-${visita[2].padStart(2, '0')}-${visita[1].padStart(2, '0')}`;
    const data = new Date(`${iso}T12:00:00Z`);
    if (!Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === iso) visitaISO = iso;
    if (visita[4] && Number(visita[4]) < 24 && Number(visita[5] || 0) < 60) hora = `${visita[4].padStart(2, '0')}:${(visita[5] || '00').padStart(2, '0')}`;
  }
  let referenciaRelativa = '';
  if (!visitaISO) {
    const relativa = texto.match(/vistoria(?:\s+inicial)?\s+(hoje|amanhã)(?:\s+(?:às|as))?\s+(\d{1,2})(?:[:h](\d{2}))?/i);
    if (relativa && Number(relativa[2]) < 24 && Number(relativa[3] || 0) < 60) {
      const mensagens = Array.from(texto.matchAll(/\[\d{1,2}:\d{2},\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\]/g));
      const referencia = mensagens.length ? new Date(`${mensagens[mensagens.length - 1][3]}-${mensagens[mensagens.length - 1][2].padStart(2, '0')}-${mensagens[mensagens.length - 1][1].padStart(2, '0')}T12:00:00`) : new Date();
      const base = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}-${String(referencia.getDate()).padStart(2, '0')}`;
      visitaISO = relativa[1].toLowerCase() === 'amanhã' ? somarDias(base, 1) : base;
      hora = `${relativa[2].padStart(2, '0')}:${(relativa[3] || '00').padStart(2, '0')}`;
      referenciaRelativa = `Data sugerida para “${relativa[1]}” usando ${base} como referência (${mensagens.length ? 'mensagem' : 'dia da análise'}). Confirme a data.`;
    }
  }
  const art = /emiss[aã]o\s+(?:de|da)\s+ART|emitir\s+(?:a\s+)?ART/i.test(texto) && !/não\s+emitir\s+(?:a\s+)?ART|sem\s+emiss[aã]o\s+(?:de|da)\s+ART/i.test(texto);
  const acompanhamento = /acompanhamento\s+técnico/i.test(texto);
  const descricao = campo('(?:serviço|escopo)') || [acompanhamento ? 'Acompanhamento técnico' : '', art ? 'emissão de ART' : ''].filter(Boolean).join(' + ');
  const cidadeSugerida = /\bVG\b/i.test(texto);
  const localInformado = campo('local') || texto.match(/Condomínio\s+[^\n\r,;]+/i)?.[0]?.trim() || '';
  const local = /^condomínio\b/i.test(localInformado)
    ? localInformado.toLocaleLowerCase('pt-BR').replace(/\p{L}+/gu, (palavra, indice: number) => indice > 0 && /^(?:de|da|do|das|dos|e)$/.test(palavra) ? palavra : palavra[0].toLocaleUpperCase('pt-BR') + palavra.slice(1))
    : localInformado;
  const acoes: Acao[] = [];
  if (visitaISO || (!visita && /vistoria\s+inicial|primeira\s+vistoria/i.test(texto))) acoes.push({ nome: 'Vistoria inicial', prazo: visitaISO, hora, descricao: referenciaRelativa });
  const textoSemAcentos = texto.normalize('NFD').replace(/\p{M}/gu, '');
  const artDepoisDaVistoria = /apos\s+(?:a\s+)?vistoria|depois\s+(?:da\s+)?vistoria/i.test(textoSemAcentos)
    || /(?:primeira\s+vistoria|vistoria\s+inicial)[^\n]*\b(?:apos|depois)\s+isso\b[^\n]*\bART\b/i.test(textoSemAcentos);
  if (art) acoes.push({ nome: 'Emitir ART', prazo: null, hora: '', descricao: artDepoisDaVistoria ? 'Após a vistoria inicial.' : '' });
  if (/vistoria\s+final|duas\s+vistorias|2\s+vistorias/i.test(texto)) acoes.push({ nome: 'Vistoria final', prazo: null, hora: '', descricao: 'A agendar.' });
  if (visitaISO) acoes.push(...sugerirFollowups(visitaISO, texto));
  const fase = identificarFase(texto) || (/proposta|orçamento/i.test(texto) ? 'aguardando_retorno' : null);
  return {
    cliente: { nome, whatsapp, origem: campo('origem') || (/mensagem\s+(?:no|pelo|via)\s+WhatsApp/i.test(texto) ? 'WhatsApp' : ''), cidade: cidadeSugerida ? 'Várzea Grande' : campo('cidade'), estado: cidadeSugerida ? 'MT' : campo('(?:estado|UF)'), endereco: campo('endereço(?: completo)?') },
    projeto: { nome: `${descricao || 'Novo trabalho'}${nome ? ` — ${nome}` : ''}`, descricao, valor: valor ? `R$ ${valor}` : '', fase_comercial: fase, status: fase === 'em_andamento' ? 'em_andamento' : condicionadaAoAceite(fase) ? 'prospeccao' : 'planejamento', local, pagamento: campo('(?:forma de pagamento|pagamento)'), observacoes: '', prazoInformado: campo('prazo(?: de entrega)?') || texto.match(/\bprazo\s+(\d+\s+dias)\b/i)?.[1] || '' },
    acoes, cidadeSugerida,
  };
}

export function valorEmCentavos(valor: string): number | null {
  if (!valor.trim()) return null;
  const texto = valor.replace(/^R\$\s*/, '').trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(texto)) throw new Error('Informe um valor válido, como R$ 650,00.');
  const centavos = Math.round(Number(texto.replace(/\./g, '').replace(',', '.')) * 100);
  if (!Number.isSafeInteger(centavos)) throw new Error('Valor fora do limite permitido.');
  return centavos;
}

export type ProgressoCriacao = { clienteId?: number; projetoId?: number; tarefas: number; documentos: number; etapas?: Record<string, number>; esperados?: number; tiposVinculados?: boolean };
export async function criarTrabalho(r: Rascunho, arquivos: File[], progresso: ProgressoCriacao): Promise<number> {
  const etapas=r.etapas||[], docs=r.documentosEsperados||[];
  if(etapas.some(e=>!e.nome.trim()||!Number.isInteger(e.ordem)||e.ordem<0||e.inicio&&!dataValida(e.inicio)||e.fim&&!dataValida(e.fim)||e.inicio&&e.fim&&e.inicio>e.fim)) throw new Error('Revise nomes, ordem e datas das etapas antes de criar.');
  const chaves=new Set(etapas.map(e=>e.chave));
  if(chaves.size!==etapas.length || r.acoes.some(a=>!a.nome.trim()||a.prazo&&!dataValida(a.prazo)||a.hora&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.hora)||a.etapaChave&&!chaves.has(a.etapaChave)) || docs.some(d=>!d.nome.trim()||d.prazo&&!dataValida(d.prazo)||d.etapaChave&&!chaves.has(d.etapaChave))) throw new Error('Revise tarefas, documentos, datas e vínculos do plano antes de criar.');
  const observacoes = [r.projeto.local && `Local: ${r.projeto.local}`, r.cliente.endereco && `Endereço completo: ${r.cliente.endereco}`, r.projeto.pagamento && `Forma de pagamento: ${r.projeto.pagamento}`, r.projeto.prazoInformado && `Prazo informado: ${r.projeto.prazoInformado}`, r.projeto.observacoes].filter(Boolean).join('\n');
  if (observacoes.length > 2000) throw new Error('Local, endereço, pagamento e observações juntos devem ter até 2000 caracteres. Revise antes de criar.');
  const valor = valorEmCentavos(r.projeto.valor);
  async function post<T = unknown>(url: string, body: object | FormData, method: 'POST'|'PATCH' = 'POST'): Promise<T> {
    const multipart = body instanceof FormData;
    const init = { method, credentials: 'same-origin' as const, ...(!multipart && { headers: { 'Content-Type': 'application/json' } }), body: multipart ? body : JSON.stringify(body) };
    const response = await fetch(url, init);
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error((data as { error?: string } | null)?.error || `Não foi possível concluir ${url}.`);
    return data as T;
  }
  if (!progresso.clienteId) {
    const data = await post<{ cliente: { id: number } }>('/api/clientes', { tipo: 'PF', ...r.cliente, telefone: r.cliente.whatsapp || null, status: 'ativo', observacoes });
    progresso.clienteId = data.cliente.id;
  }
  if (!progresso.projetoId) {
    const data = await post<{ projeto: { id: number } }>('/api/projetos', { cliente_id: progresso.clienteId, nome: r.projeto.nome, descricao: r.projeto.descricao, status: r.projeto.status, fase_comercial: r.projeto.fase_comercial || null, prioridade: 'normal', valor_contratado: valor, cidade: r.cliente.cidade || null, estado: r.cliente.estado || null, observacoes, tipo_servico_ids: [] });
    progresso.projetoId = data.projeto.id;
  }
  const id = progresso.projetoId!;
  if(r.projeto.tipo_servico_ids?.length&&!progresso.tiposVinculados) { await post(`/api/projetos/${id}`,{tipo_servico_ids:r.projeto.tipo_servico_ids},'PATCH'); progresso.tiposVinculados=true; }
  progresso.etapas ??= {};
  for (const e of [...(r.etapas || [])].sort((a,b) => a.ordem-b.ordem)) {
    if (progresso.etapas[e.chave]) continue;
    const data = await post<{ etapa: { id: number } }>(`/api/projetos/${id}/etapas`, { nome: e.nome, ordem: e.ordem, data_inicio_prevista: e.inicio, data_fim_prevista: e.fim, status: 'pendente', visivel_cliente: false });
    if (!data?.etapa?.id) throw new Error('A API não retornou a etapa criada. Verifique o cadastro antes de continuar.');
    progresso.etapas[e.chave] = data.etapa.id;
  }
  while (progresso.tarefas < r.acoes.length) {
    const a = r.acoes[progresso.tarefas];
    await post(`/api/projetos/${id}/tarefas`, { nome: a.nome, descricao: [a.hora && `Horário: ${a.hora}.`, a.descricao].filter(Boolean).join('\n') || null, prazo: a.prazo || null, status: a.status || 'pendente', etapa_id: a.etapaChave ? progresso.etapas[a.etapaChave] : null, responsavel_id: a.responsavel_id || null, prioridade: 'normal', visivel_cliente: false });
    progresso.tarefas++;
  }
  progresso.esperados ??= 0;
  while (progresso.esperados < (r.documentosEsperados || []).length) {
    const d = r.documentosEsperados![progresso.esperados]; const fd = new FormData();
    fd.set('nome', d.nome); fd.set('categoria', d.categoria); fd.set('esperado', 'true'); fd.set('estado_documental', d.estado);
    if (d.prazo) fd.set('prazo', d.prazo);
    if (d.etapaChave && progresso.etapas[d.etapaChave]) fd.set('etapa_id', String(progresso.etapas[d.etapaChave]));
    fd.set('visivel_cliente','false'); fd.set('visivel_parceiro','false');
    await post(`/api/projetos/${id}/documentos`, fd); progresso.esperados++;
  }
  while (progresso.documentos < arquivos.length) {
    const file = arquivos[progresso.documentos];
    const fd = new FormData();
    fd.set('nome', file.name.replace(/\.[^.]+$/, '')); fd.set('categoria', /proposta/i.test(file.name) ? 'proposta' : 'outros'); fd.set('visivel_cliente', 'false'); fd.set('visivel_parceiro', 'false'); fd.set('arquivo', file);
    await post(`/api/projetos/${id}/documentos`, fd);
    progresso.documentos++;
  }
  return id;
}

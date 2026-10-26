import { identificarFase, normalizarNome, dataValida, type FaseComercial, type EstadoDocumento } from './operacao-voia';

export type OperacaoAssistente =
  | { tipo: 'projeto'; dados: { fase_comercial?: FaseComercial; valor_contratado?: number } }
  | { tipo: 'tarefa'; id: number; dados: { status?: 'pendente' | 'concluida'; prazo?: string | null; descricao?: string | null; responsavel_id?: number | null } }
  | { tipo: 'criar_tarefa'; dados: { nome: string; prazo?: string | null; descricao?: string | null; responsavel_id?: number | null } }
  | { tipo: 'documento'; id: number; dados: { estado_documental: EstadoDocumento } }
  | { tipo: 'criar_documento'; dados: { nome: string; categoria: 'art_rrt'; estado_documental: EstadoDocumento } };
export type SugestaoAssistente = { chave: string; titulo: string; selecionada: boolean; operacao: OperacaoAssistente; candidatos?: { id: number; nome: string }[]; conflito?: 'fase_comercial' | 'valor_contratado'; dataInformada?:string; conflitoData?:{cadastrada:string;informada:string;hora:string;expressao:string;decisao:'manter'|'alterar'|null} };
export type ContextoAssistente = { fase_comercial?: FaseComercial | null; tarefas: { id: number; nome: string; status: string; prazo?: string|null; responsavel_id?:number|null; responsavel_nome?:string|null; descricao?: string | null }[]; documentos: { id: number; nome: string; categoria: string; estado_documental?: EstadoDocumento | null; possui_arquivo?: number }[] };

function proximaData(texto: string, referencia: string) {
  const t = normalizarNome(texto); const base = new Date(`${referencia}T12:00:00Z`);
  const explicita = texto.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (explicita) { const iso = `${explicita[3] || referencia.slice(0,4)}-${explicita[2].padStart(2,'0')}-${explicita[1].padStart(2,'0')}`; return dataValida(iso) ? iso : null; }
  if (/\bamanha\b/.test(t)) base.setUTCDate(base.getUTCDate()+1);
  else if (/\bhoje\b/.test(t)) { /* referência explícita */ }
  else {
    const dia = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'].findIndex(d=>new RegExp(`\\b${d}\\b`).test(t));
    if (dia<0) return null;
    const delta=(dia-base.getUTCDay()+7)%7; base.setUTCDate(base.getUTCDate()+(delta||7));
  }
  return base.toISOString().slice(0,10);
}

// Interpretação pura: não faz fetch, não persiste e não representa um LLM.
export function interpretarAtualizacao(texto: string, contexto: ContextoAssistente, referencia: string) {
  const sugestoes: SugestaoAssistente[] = [], avisos: string[] = [];
  const t = normalizarNome(texto);
  const adicionar = (titulo: string, operacao: OperacaoAssistente, candidatos?: {id:number;nome:string}[]) => sugestoes.push({ chave: `s-${sugestoes.length}`, titulo, operacao, selecionada: !candidatos || candidatos.length===1, candidatos });
  const fases=[...new Set(texto.split(/[.!?\n]/).map(identificarFase).filter((f):f is FaseComercial=>!!f))];
  const fase = identificarFase(texto);
  if(fases.length>1){adicionar('Fases comerciais conflitantes: escolha a informação atual',{tipo:'projeto',dados:{}});sugestoes[sugestoes.length-1].selecionada=false;sugestoes[sugestoes.length-1].conflito='fase_comercial';avisos.push(`Fases identificadas: ${fases.join(', ')}. Nenhuma foi escolhida automaticamente.`);}
  else if (fase && fase!==contexto.fase_comercial) adicionar('Alterar fase comercial (status operacional preservado)',{tipo:'projeto',dados:{fase_comercial:fase}});
  const dinheiro = texto.match(/R\$\s*(\d[\d.]*(?:,\d{1,2})?)/i);
  const valor=dinheiro ? Math.round(Number(dinheiro[1].replace(/\./g,'').replace(',','.'))*100) : null;
  const valores=[...new Set([...texto.matchAll(/R\$\s*(\d[\d.]*(?:,\d{1,2})?)/gi)].map(m=>Math.round(Number(m[1].replace(/\./g,'').replace(',','.'))*100)))];
  if(valores.length>1){adicionar('Mais de um valor informado: confirme o valor contratado (centavos)',{tipo:'projeto',dados:{}});sugestoes[sugestoes.length-1].selecionada=false;sugestoes[sugestoes.length-1].conflito='valor_contratado';avisos.push(`Valores identificados (centavos): ${valores.join(', ')}. Confirme qual representa o valor contratado.`);}
  else if (valor!==null && Number.isSafeInteger(valor)) adicionar('Atualizar valor contratado (centavos)',{tipo:'projeto',dados:{valor_contratado:valor}});
  const entrada = texto.match(/(\d{1,3}(?:,\d+)?)\s*%\s*(?:de\s+)?entrada|entrada\s*(?:de\s+)?(\d{1,3}(?:,\d+)?)\s*%/i);
  if (entrada) {
    const p=Number((entrada[1]||entrada[2]).replace(',','.'));
    avisos.push(p<=100 && valor!==null && valores.length===1 ? `Entrada prevista: ${(Math.round(valor*p/100)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}. Sugestão somente; nenhum recebimento ou lançamento será criado. Data do restante não identificada.` : 'Entrada mencionada: confirme percentual, valor e vencimentos no Financeiro. Nenhum pagamento será registrado.');
  }
  const semAlteracoes:string[]=[];
  const mencoes = [...texto.matchAll(/[^.!?\n]*(?:vistoria|visita)[^.!?\n]*/gi)];
  for(const m of mencoes){
    const trecho=m[0],n=normalizarNome(trecho),final=/\bfinal\b/.test(n),inicial=/\binicial\b|primeira/.test(n),nome=final?'Vistoria final':inicial?'Vistoria inicial':'Vistoria';
    const candidatas=contexto.tarefas.filter(a=>/vistoria|visita/.test(normalizarNome(a.nome))&&(!final&&!inicial||normalizarNome(a.nome).includes(final?'final':'inicial')));
    const futura=/\b(?:vou|irei|preciso)\s+(?:fazer|realizar|agendar)\s+(?:a\s+)?(?:vistoria|visita)\b|\b(?:vistoria|visita)\b[^,;]*\b(?:sera|serao)\b/.test(n);
    const concluida=!futura&&/\b(?:fiz|realizei|conclui|concluida|realizada)\b/.test(n)&&!/\bnao\b/.test(n);
    const datas=[...trecho.matchAll(/\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/g)],dias=[...n.matchAll(/\b(?:domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/g)],horas=[...trecho.matchAll(/(?:às|as|\b)\s*(\d{1,2})[:h](\d{2})?/gi)];
    if(datas.length>1||dias.length>1||horas.length>1){avisos.push(`${nome}: datas ou horários ambíguos; confirme manualmente o agendamento.`);continue;}
    const data=proximaData(trecho,referencia),hora=horas[0];
    if(!concluida&&!data){if(candidatas.length)semAlteracoes.push(`${nome} — ${candidatas.every(a=>!a.prazo)?'permanece a agendar':'data cadastrada preservada'}.`);continue;}
    const horario=hora&&Number(hora[1])<24&&Number(hora[2]||0)<60?`${hora[1].padStart(2,'0')}:${(hora[2]||'00').padStart(2,'0')}`:null;
    const dados:{status?:'concluida';prazo?:string;descricao?:string}=concluida?{status:'concluida'}:{...(data?{prazo:data}:{}),...(horario?{descricao:`Horário: ${horario}.`}:{})};
    if(candidatas.length===1&&dados.descricao&&candidatas[0].descricao)dados.descricao=[dados.descricao,candidatas[0].descricao.replace(/Horário:\s*\d{2}:\d{2}\.?\s*/gi,'').trim()].filter(Boolean).join('\n');
    if(candidatas.length){
      if(concluida&&candidatas.length===1&&candidatas[0].status==='concluida'){semAlteracoes.push(`${nome} — já concluída.`);continue;}
      adicionar(`${nome}: ${concluida?'marcar como concluída':'revisar agendamento'}`,{tipo:'tarefa',id:candidatas.length===1?candidatas[0].id:0,dados},candidatas);
      const sug=sugestoes[sugestoes.length-1];if(data)sug.dataInformada=data;
      if(candidatas.length===1)Object.assign(sug,revisarDataTarefa(sug,candidatas[0],/\bhoje\b/.test(n)?'hoje':/\bamanha\b/.test(n)?'amanhã':''));
    }else if(concluida)avisos.push(`${nome}: nenhuma tarefa correspondente encontrada; confirme o registro manualmente.`);
    else adicionar(`Criar ${nome} (sem etapa e responsável até sua edição)`,{tipo:'criar_tarefa',dados:{nome,...dados}});
    if(data&&!concluida&&!candidatas.some(a=>a.prazo&&a.prazo!==data))avisos.push(`Agendamento proposto para ${dataLegivel(data)}${horario?' às '+horario:''}. Confira a data antes de confirmar.`);
  }
  for(const nome of ['ART','RRT'] as const){
    const token=nome.toLowerCase(),trechos=texto.split(/[.!?\n]/).map(normalizarNome).filter(t=>new RegExp(`\\b${token}\\b`).test(t));
    const realizada=trechos.some(t=>!new RegExp(`\\bnao\\b[^.]*\\b${token}\\b|\\b${token}\\b[^.]*nao\\b`).test(t)&&(new RegExp(`\\b(?:emiti|fiz) (?:a |o )?${token}\\b|\\b${token} (?:ja )?(?:emitida|emitido)\\b`).test(t)));
    const intencao=trechos.some(t=>new RegExp(`\\b(?:vou|preciso|irei|devo) (?:emitir|fazer) (?:a |o )?${token}\\b`).test(t));
    if(realizada&&intencao){avisos.push(`${nome}: há intenção futura e emissão informada. Confirme a situação antes de atualizar.`);continue;}
    if(!realizada){if(intencao)semAlteracoes.push(`Emissão de ${nome} — continua pendente; a intenção de emitir não confirma emissão.`);continue;}
    const candidatas=contexto.documentos.filter(d=>normalizarNome(d.nome).split(' ').includes(token));
    if(candidatas.length===1&&candidatas[0].estado_documental==='emitido')semAlteracoes.push(`${nome} — já marcado como emitido${candidatas[0].possui_arquivo===1?'':'; upload pendente'}.`);
    else if(candidatas.length)adicionar(`${nome}: marcar como emitido; arquivo permanece independente`,{tipo:'documento',id:candidatas.length===1?candidatas[0].id:0,dados:{estado_documental:'emitido'}},candidatas);
    else adicionar(`${nome}: registrar documento esperado emitido, sem arquivo`,{tipo:'criar_documento',dados:{nome,categoria:'art_rrt',estado_documental:'emitido'}});
    const tarefas=contexto.tarefas.filter(a=>new RegExp(`\\b(?:emitir(?: a)?|emissao(?: d[ae])?) ${token}\\b`).test(normalizarNome(a.nome))&&a.status!=='concluida');
    if(tarefas.length)adicionar(`Concluir tarefa de emissão de ${nome}`,{tipo:'tarefa',id:tarefas.length===1?tarefas[0].id:0,dados:{status:'concluida'}},tarefas);
  }
  if(/esperar \d+ dias/.test(t)) avisos.push('Espera solicitada: prazo e ação precisam ser definidos na revisão; execução e prazos existentes foram preservados.');
  if (!sugestoes.length&&!semAlteracoes.length) avisos.push('Nenhuma alteração inequívoca identificada. Edite os campos do projeto ou acrescente contexto.');
  return { sugestoes, avisos, semAlteracoes };
}

export function dataLegivel(iso:string){return iso.split('-').reverse().join('/');}
export function revisarDataTarefa(s:SugestaoAssistente,t:ContextoAssistente['tarefas'][number],expressao=''):Partial<SugestaoAssistente>{
  if(s.operacao.tipo!=='tarefa'||!s.dataInformada||!t.prazo||s.dataInformada===t.prazo)return {conflitoData:undefined};
  const dados={...s.operacao.dados};delete dados.prazo;
  return {operacao:{...s.operacao,dados},conflitoData:{cadastrada:t.prazo,informada:s.dataInformada,hora:t.descricao?.match(/Horário:\s*(\d{2}:\d{2})/i)?.[1]||'',expressao,decisao:null}};
}

import { condicionadaAoAceite, identificarFase, normalizarNome } from '../../shared/operacao-voia';
import type { Rascunho, EtapaSugerida, DocumentoEsperado } from './novo-trabalho';

export function sugerirPlano(r: Rascunho, texto: string): Rascunho {
  const fase = r.projeto.fase_comercial ?? identificarFase(texto);
  const aguardando = condicionadaAoAceite(fase);
  const acoes = r.acoes.map(a => ({ ...a, etapaChave: null as string | null, status: aguardando ? 'aguardando' as const : 'pendente' as const, responsavel_id: null as number | null }));
  const etapas: EtapaSugerida[] = [];
  const explicitas = Array.from(texto.matchAll(/^\s*(?:Etapa|Fase)\s*(\d+)?\s*[:—-]\s*([^\n\r]+)/gim));
  for (const [i, match] of explicitas.entries()) etapas.push({ chave: `etapa-${i}`, nome: match[2].trim(), ordem: i + 1, inicio: null, fim: null });
  // Tarefas explicitamente listadas sob uma etapa, inclusive serviços que não
  // correspondam às heurísticas de vistoria/ART do cadastro anterior.
  let etapa: string | null = null;
  for (const linha of texto.split(/\r?\n/)) {
    const cabecalho = linha.match(/^\s*(?:Etapa|Fase)\s*\d*\s*[:—-]\s*(.+)/i);
    if (cabecalho) etapa = etapas.find(e => normalizarNome(e.nome) === normalizarNome(cabecalho[1]))?.chave || null;
    const tarefa = linha.match(/^\s*(?:[-•]\s*)?Tarefa\s*:\s*(.+)/i);
    if (tarefa) {
      const existente = acoes.find(a => normalizarNome(a.nome) === normalizarNome(tarefa[1]));
      if (existente) existente.etapaChave = etapa;
      else acoes.push({ nome: tarefa[1].trim(), prazo: null, hora: '', descricao: '', etapaChave: etapa, status: aguardando ? 'aguardando' : 'pendente', responsavel_id: null });
    }
  }
  const sequencia = /\binicial\b|\bfinal\b|\bapós\b|\bdepois\b|\betapa\b/i.test(texto);
  if (!etapas.length && acoes.length > 1 && sequencia) {
    for (const a of acoes) {
      const grupo = /^follow-up/i.test(a.nome) ? 'Acompanhamento' : /emitir (ART|RRT)/i.test(a.nome) ? 'Responsabilidade técnica' : /final|conclusão/i.test(a.nome) ? 'Finalização' : a.nome.replace(/^(?:realizar|emitir|elaborar|preparar|agendar|entregar)\s+/i, '');
      let e = etapas.find(e => normalizarNome(e.nome) === normalizarNome(grupo));
      if (!e) { e = { chave: `etapa-${etapas.length}`, nome: grupo[0].toUpperCase() + grupo.slice(1), ordem: etapas.length + 1, inicio: null, fim: null }; etapas.push(e); }
      a.etapaChave = e.chave;
    }
  } else {
    for (const a of acoes.filter(a => !a.etapaChave)) {
      const candidatas = etapas.filter(e => normalizarNome(a.nome).includes(normalizarNome(e.nome)));
      if (candidatas.length === 1) a.etapaChave = candidatas[0].chave;
    }
  }
  for (const e of etapas) {
    const datas = acoes.filter(a => a.etapaChave === e.chave).flatMap(a => a.prazo ? [a.prazo] : []).sort();
    e.inicio = datas[0] || null; e.fim = datas[datas.length - 1] || null;
  }
  const documentos: DocumentoEsperado[] = [];
  const regras = [
    { re: /(?:emitir|emissão\s+(?:de|da))\s+(ART|RRT)\b/i, nome: 'ART/RRT', categoria: 'art_rrt', emissao: true },
    { re: /termo de conclusão/i, nome: 'Termo de conclusão', categoria: 'aprovacao', emissao: false },
    { re: /registro fotográfico/i, nome: 'Registro fotográfico', categoria: 'levantamento', emissao: false },
    { re: /memorial(?: descritivo)?/i, nome: 'Memorial', categoria: 'projeto', emissao: false },
    { re: /matrícula/i, nome: 'Matrícula', categoria: 'documento_cliente', emissao: false },
    { re: /(?:elaborar|produzir|emitir|entregar)\s+(?:um\s+)?relatório/i, nome: 'Relatório', categoria: 'relatorio', emissao: false },
    { re: /(?:assinar|elaborar|receber)\s+(?:o\s+)?contrato/i, nome: 'Contrato', categoria: 'contrato', emissao: false },
  ];
  for (const regra of regras) {
    const match = texto.match(regra.re); if (!match) continue;
    const linha=texto.slice(0,match.index).split(/[.\n]/).pop() || '';
    if (/\bsem\b|\bnão\b/i.test(linha)) continue;
    const nome = regra.categoria === 'art_rrt' ? match[1].toUpperCase() : regra.nome;
    const associada = etapas.find(e => regra.categoria === 'art_rrt' ? /responsabilidade|ART|RRT/i.test(e.nome) : regra.nome === 'Termo de conclusão' ? /final/i.test(e.nome) : normalizarNome(e.nome).includes(normalizarNome(nome)));
    documentos.push({ nome, categoria: regra.categoria, estado: aguardando || regra.nome === 'Termo de conclusão' ? 'aguardando_etapa' : regra.emissao ? 'pendente_emissao' : 'pendente', prazo: null, etapaChave: associada?.chave || null });
  }
  return { ...r, projeto: { ...r.projeto, fase_comercial: fase, status: fase === 'em_andamento' ? 'em_andamento' : fase === 'concluida' ? 'concluido' : fase === 'cancelada' ? 'cancelado' : aguardando ? 'prospeccao' : 'planejamento' }, acoes, etapas, documentosEsperados: documentos };
}

export type ModeloPlano = { id:number; nome:string; ordem:number; ativa:number; tarefas:{nome:string;descricao:string|null;ativa:number}[] };
export function incorporarModelo(r:Rascunho,tipoId:number,modelo:ModeloPlano[]):Rascunho {
  const etapas=[...(r.etapas||[])],acoes=r.acoes.map(a=>({...a}));
  for(const m of modelo.filter(m=>m.ativa===1).sort((a,b)=>a.ordem-b.ordem)) {
    let e=etapas.find(e=>normalizarNome(e.nome)===normalizarNome(m.nome));
    if(!e){e={chave:`modelo-${tipoId}-${m.id}`,nome:m.nome,ordem:etapas.length+1,inicio:null,fim:null};etapas.push(e);}
    for(const t of m.tarefas.filter(t=>t.ativa===1)) {
      const existente=acoes.find(a=>normalizarNome(a.nome)===normalizarNome(t.nome));
      if(existente){if(!existente.etapaChave)existente.etapaChave=e.chave;continue;}
      acoes.push({nome:t.nome,descricao:t.descricao||'',hora:'',prazo:null,etapaChave:e.chave,responsavel_id:null,status:condicionadaAoAceite(r.projeto.fase_comercial)?'aguardando':'pendente'});
    }
  }
  return {...r,etapas,acoes,projeto:{...r.projeto,tipo_servico_ids:[...new Set([...(r.projeto.tipo_servico_ids||[]),tipoId])]}};
}

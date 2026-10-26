export const FASES_COMERCIAIS = ['levantamento', 'proposta_em_elaboracao', 'proposta_enviada', 'aguardando_retorno', 'aprovada', 'perdida', 'preparacao', 'em_andamento', 'concluida', 'cancelada'] as const;
export type FaseComercial = typeof FASES_COMERCIAIS[number];
export const FASE_COMERCIAL_LABEL: Record<FaseComercial, string> = { levantamento: 'Em levantamento', proposta_em_elaboracao: 'Proposta em elaboração', proposta_enviada: 'Proposta enviada', aguardando_retorno: 'Aguardando retorno', aprovada: 'Aprovada', perdida: 'Não aprovada / Perdida', preparacao: 'Em preparação', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };
export const ESTADOS_DOCUMENTO = ['pendente', 'pendente_emissao', 'aguardando_etapa', 'emitido', 'recebido', 'anexado', 'nao_aplicavel'] as const;
export type EstadoDocumento = typeof ESTADOS_DOCUMENTO[number];
export const ESTADO_DOCUMENTO_LABEL: Record<EstadoDocumento, string> = { pendente: 'Pendente', pendente_emissao: 'Pendente de emissão', aguardando_etapa: 'Aguardando etapa', emitido: 'Emitido', recebido: 'Recebido', anexado: 'Anexado', nao_aplicavel: 'Não aplicável' };
export const normalizarNome = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function identificarFase(texto: string): FaseComercial | null {
  const t = normalizarNome(texto);
  if (/nao (?:vai fazer|aprovou|aceitou)|proposta (?:recusada|nao aprovada)|cliente desistiu/.test(t)) return 'perdida';
  if (/cancel(?:ou|ada|ado) (?:a proposta|o trabalho|o servico)|trabalho cancelado/.test(t)) return 'cancelada';
  if (/servico concluido|trabalho concluido|finalizamos o servico/.test(t)) return 'concluida';
  if (/iniciamos (?:a execucao|o servico)|servico em andamento/.test(t)) return 'em_andamento';
  if (/cliente (?:aprovou|fechou|aceitou)|(?:fechou|aprovou) (?:a |essa |esta |a seguinte )?proposta|contrato assinado|termo de aceite assinado/.test(t)) return 'aprovada';
  if (/preparando (?:o servico|a execucao)/.test(t)) return 'preparacao';
  if (/aguardando (?:retorno|resposta|aceite)/.test(t)) return 'aguardando_retorno';
  if (/enviei .*proposta|proposta enviada|enviamos .*proposta/.test(t)) return 'proposta_enviada';
  if (/elaborando .*proposta|orcamento em elaboracao/.test(t)) return 'proposta_em_elaboracao';
  if (/em levantamento/.test(t)) return 'levantamento';
  return null;
}
export function condicionadaAoAceite(fase: FaseComercial | null | undefined) {
  return !!fase && ['levantamento', 'proposta_em_elaboracao', 'proposta_enviada', 'aguardando_retorno', 'perdida', 'cancelada'].includes(fase);
}
export function dataValida(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime()) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s; }

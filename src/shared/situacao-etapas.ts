// Ausência de etapa atual não comprova conclusão. Exige contagem positiva
// e todas as etapas efetivamente concluídas, também no portal do cliente.
export function mensagemEtapas(total: number | undefined, concluidas: number | undefined): string {
  if (total === 0) return 'Sem etapa definida.';
  if (total !== undefined && total > 0 && concluidas === total) return 'Todas as etapas concluídas.';
  return 'Nenhuma etapa em andamento.';
}

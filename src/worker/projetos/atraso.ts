/**
 * Regras de atraso, centralizadas — nunca um status persistido, sempre
 * calculado em SQL a partir de status + prazo, para Dashboard e Workspace
 * usarem exatamente a mesma régua.
 *
 * Tarefa atrasada: não concluída/cancelada, possui prazo, prazo < hoje.
 * Etapa atrasada: não concluída, e (prazo previsto vencido OU alguma
 * tarefa dela está atrasada).
 * Projeto atrasado: prazo do projeto vencido (regra já existente) OU
 * alguma etapa seguindo a régua acima.
 *
 * As funções recebem o alias SQL da tabela para poderem ser embutidas em
 * queries diferentes (lista de projetos, detalhe do projeto, dashboard)
 * sem duplicar a lógica de cada regra.
 */

export function sqlTarefaAtrasada(aliasTarefa: string): string {
	return `(${aliasTarefa}.status NOT IN ('concluida', 'cancelada') AND ${aliasTarefa}.prazo IS NOT NULL AND ${aliasTarefa}.prazo < date('now'))`;
}

export function sqlEtapaAtrasada(aliasEtapa: string): string {
	return `(
		${aliasEtapa}.status <> 'concluida'
		AND (
			(${aliasEtapa}.data_fim_prevista IS NOT NULL AND ${aliasEtapa}.data_fim_prevista < date('now'))
			OR EXISTS (
				SELECT 1 FROM projeto_tarefas pt_atraso
				WHERE pt_atraso.etapa_id = ${aliasEtapa}.id AND ${sqlTarefaAtrasada("pt_atraso")}
			)
		)
	)`;
}

/** Projeto atrasado: prazo do próprio projeto vencido OU alguma etapa/tarefa dele atrasada. */
export function sqlProjetoAtrasado(aliasProjeto: string): string {
	return `(
		(${aliasProjeto}.prazo_previsto IS NOT NULL AND ${aliasProjeto}.prazo_previsto < date('now') AND ${aliasProjeto}.status NOT IN ('concluido', 'cancelado'))
		OR EXISTS (
			SELECT 1 FROM projeto_etapas pe_atraso
			WHERE pe_atraso.projeto_id = ${aliasProjeto}.id AND ${sqlEtapaAtrasada("pe_atraso")}
		)
	)`;
}

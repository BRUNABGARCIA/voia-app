/**
 * Fonte única da regra de progresso do projeto. Projeto sem etapas/tarefas
 * = 0%. Todo lugar que precisa desse número (rotas de projetos, dashboard,
 * frontend, Portal) deve usar projetos.progresso, mantido em sincronia por
 * sincronizarProgresso() sempre que uma etapa OU tarefa é
 * criada/editada/excluída — nunca recalcular essa fórmula de novo em
 * outro lugar.
 */
export function calcularProgresso(total: number, concluidas: number): number {
	if (total === 0) return 0;
	return Math.round((concluidas / total) * 100);
}

interface ContagemEtapas {
	total: number;
	concluidas: number;
}

export async function contarEtapas(db: D1Database, projetoId: number): Promise<ContagemEtapas> {
	const row = await db
		.prepare(
			"SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) AS concluidas FROM projeto_etapas WHERE projeto_id = ?",
		)
		.bind(projetoId)
		.first<{ total: number; concluidas: number | null }>();

	return { total: row?.total ?? 0, concluidas: row?.concluidas ?? 0 };
}

interface ContagemTarefas {
	total: number;
	concluidas: number;
}

/** Tarefas canceladas nunca entram no denominador (não contam como "válidas"). */
export async function contarTarefas(db: D1Database, projetoId: number): Promise<ContagemTarefas> {
	const row = await db
		.prepare(
			`SELECT
				SUM(CASE WHEN status <> 'cancelada' THEN 1 ELSE 0 END) AS total,
				SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) AS concluidas
			 FROM projeto_tarefas WHERE projeto_id = ?`,
		)
		.bind(projetoId)
		.first<{ total: number | null; concluidas: number | null }>();

	return { total: row?.total ?? 0, concluidas: row?.concluidas ?? 0 };
}

interface ProgressoAtual {
	progresso: number;
	baseadoEm: "tarefas" | "etapas";
	totalEtapas: number;
	etapasConcluidas: number;
	totalTarefas: number;
	tarefasConcluidas: number;
}

/**
 * Lê a contagem de etapas E de tarefas e decide, com a mesma regra de
 * sincronizarProgresso, qual delas está por trás do percentual — usada
 * pelas rotas de leitura (GET) para nunca recalcular a fórmula de novo
 * localmente (ex.: GET /:id/etapas mostrando "X de Y" na tela).
 */
export async function obterProgressoAtual(db: D1Database, projetoId: number): Promise<ProgressoAtual> {
	const [etapas, tarefas] = await Promise.all([contarEtapas(db, projetoId), contarTarefas(db, projetoId)]);

	if (tarefas.total > 0) {
		return {
			progresso: calcularProgresso(tarefas.total, tarefas.concluidas),
			baseadoEm: "tarefas",
			totalEtapas: etapas.total,
			etapasConcluidas: etapas.concluidas,
			totalTarefas: tarefas.total,
			tarefasConcluidas: tarefas.concluidas,
		};
	}

	return {
		progresso: calcularProgresso(etapas.total, etapas.concluidas),
		baseadoEm: "etapas",
		totalEtapas: etapas.total,
		etapasConcluidas: etapas.concluidas,
		totalTarefas: tarefas.total,
		tarefasConcluidas: tarefas.concluidas,
	};
}

/**
 * Recalcula e grava projetos.progresso. Regra: se o projeto tem alguma
 * tarefa (válida, não cancelada), o progresso vem das tarefas; senão cai
 * de volta para a proporção de etapas concluídas (comportamento anterior,
 * preservado para projetos sem tarefas). Retorna o valor gravado.
 */
export async function sincronizarProgresso(db: D1Database, projetoId: number): Promise<number> {
	const { progresso } = await obterProgressoAtual(db, projetoId);

	await db.prepare("UPDATE projetos SET progresso = ? WHERE id = ?").bind(progresso, projetoId).run();

	return progresso;
}

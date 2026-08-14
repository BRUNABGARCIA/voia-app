/**
 * Fonte única da regra de progresso do projeto: proporção de etapas com
 * status "concluida" sobre o total de etapas. Projeto sem etapas = 0%.
 * Todo lugar que precisa desse número (rotas de projetos, dashboard,
 * frontend) deve usar projetos.progresso, mantido em sincronia por
 * sincronizarProgresso() sempre que uma etapa é criada/editada/excluída —
 * nunca recalcular essa fórmula de novo em outro lugar.
 */
export function calcularProgresso(totalEtapas: number, etapasConcluidas: number): number {
	if (totalEtapas === 0) return 0;
	return Math.round((etapasConcluidas / totalEtapas) * 100);
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

/** Recalcula e grava projetos.progresso a partir das etapas atuais. Retorna o valor gravado. */
export async function sincronizarProgresso(db: D1Database, projetoId: number): Promise<number> {
	const { total, concluidas } = await contarEtapas(db, projetoId);
	const progresso = calcularProgresso(total, concluidas);

	await db.prepare("UPDATE projetos SET progresso = ? WHERE id = ?").bind(progresso, projetoId).run();

	return progresso;
}

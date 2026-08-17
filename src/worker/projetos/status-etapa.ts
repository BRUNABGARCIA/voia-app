/**
 * Deriva e persiste o status de uma etapa a partir do andamento das suas
 * próprias tarefas — fonte única desta regra, chamada sempre que uma
 * tarefa é criada, tem o status alterado, ou é excluída (routes.ts).
 *
 * Regra: nenhuma tarefa com atividade (todas "pendente") => "pendente";
 * todas as tarefas válidas concluídas => "concluida"; qualquer outra
 * combinação (alguma iniciada/aguardando/concluída, mas não todas)
 * => "em_andamento". Tarefas canceladas nunca entram na conta, mesma
 * régua do denominador do progresso (progresso.ts).
 *
 * Etapas sem nenhuma tarefa não são tocadas — o status delas continua
 * inteiramente manual (select na tela Etapas e Tarefas / EtapaModal),
 * como já era antes desta função existir.
 */

export type TransicaoStatusEtapa = "iniciada" | "concluida" | "reaberta";

interface ResultadoSincronizacao {
	statusAnterior: string;
	statusNovo: string;
	transicao: TransicaoStatusEtapa;
}

export async function sincronizarStatusEtapa(db: D1Database, etapaId: number): Promise<ResultadoSincronizacao | null> {
	const etapa = await db.prepare("SELECT status, data_inicio_real FROM projeto_etapas WHERE id = ?").bind(etapaId).first<{
		status: string;
		data_inicio_real: string | null;
	}>();
	if (!etapa) return null;

	const contagem = await db
		.prepare(
			`SELECT
				SUM(CASE WHEN status <> 'cancelada' THEN 1 ELSE 0 END) AS total,
				SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) AS concluidas,
				SUM(CASE WHEN status NOT IN ('pendente', 'cancelada') THEN 1 ELSE 0 END) AS comAtividade
			 FROM projeto_tarefas WHERE etapa_id = ?`,
		)
		.bind(etapaId)
		.first<{ total: number | null; concluidas: number | null; comAtividade: number | null }>();

	const total = contagem?.total ?? 0;
	if (total === 0) return null; // sem tarefas: status continua manual

	const concluidas = contagem?.concluidas ?? 0;
	const comAtividade = contagem?.comAtividade ?? 0;

	let statusDerivado: "pendente" | "em_andamento" | "concluida";
	if (concluidas === total) statusDerivado = "concluida";
	else if (concluidas > 0 || comAtividade > 0) statusDerivado = "em_andamento";
	else statusDerivado = "pendente";

	if (statusDerivado === etapa.status) return null;

	const hoje = new Date().toISOString().slice(0, 10);
	const dataConclusao = statusDerivado === "concluida" ? hoje : null;
	const dataInicioReal = statusDerivado !== "pendente" ? (etapa.data_inicio_real ?? hoje) : etapa.data_inicio_real;

	await db
		.prepare(
			"UPDATE projeto_etapas SET status = ?, data_conclusao = ?, data_inicio_real = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
		)
		.bind(statusDerivado, dataConclusao, dataInicioReal, etapaId)
		.run();

	let transicao: TransicaoStatusEtapa;
	if (statusDerivado === "concluida") transicao = "concluida";
	else if (etapa.status === "concluida") transicao = "reaberta";
	else transicao = "iniciada";

	return { statusAnterior: etapa.status, statusNovo: statusDerivado, transicao };
}

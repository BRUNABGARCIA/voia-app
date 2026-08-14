import { adicionarDias, hojeIso } from "./prazos";
import { sincronizarProgresso } from "./progresso";

interface EtapaModeloRow {
	id: number;
	tipo_servico_id: number;
	nome: string;
	descricao: string | null;
	ordem: number;
	prazo_dias: number | null;
	peso: number;
	visivel_cliente: number;
}

interface TarefaModeloRow {
	id: number;
	modelo_etapa_id: number;
	nome: string;
	descricao: string | null;
	ordem: number;
	prazo_dias: number | null;
	prioridade_padrao: string;
	responsavel_padrao_id: number | null;
	visivel_cliente: number;
}

/** Etapas (ativas) de um conjunto de tipos de serviço, agrupadas por tipo. */
async function buscarEtapasModeloPorTipo(db: D1Database, tipoServicoIds: number[]): Promise<Map<number, EtapaModeloRow[]>> {
	const placeholders = tipoServicoIds.map(() => "?").join(", ");
	const { results } = await db
		.prepare(
			`SELECT id, tipo_servico_id, nome, descricao, ordem, prazo_dias, peso, visivel_cliente
			 FROM tipo_servico_etapas_modelo
			 WHERE tipo_servico_id IN (${placeholders}) AND ativa = 1
			 ORDER BY tipo_servico_id, ordem, id`,
		)
		.bind(...tipoServicoIds)
		.all<EtapaModeloRow>();

	const porTipo = new Map<number, EtapaModeloRow[]>();
	for (const row of results) {
		const lista = porTipo.get(row.tipo_servico_id) ?? [];
		lista.push(row);
		porTipo.set(row.tipo_servico_id, lista);
	}
	return porTipo;
}

/** Tarefas (ativas) de um conjunto de etapas-modelo, agrupadas por etapa-modelo. */
async function buscarTarefasModeloPorEtapa(db: D1Database, modeloEtapaIds: number[]): Promise<Map<number, TarefaModeloRow[]>> {
	if (modeloEtapaIds.length === 0) return new Map();

	const placeholders = modeloEtapaIds.map(() => "?").join(", ");
	const { results } = await db
		.prepare(
			`SELECT id, modelo_etapa_id, nome, descricao, ordem, prazo_dias, prioridade_padrao, responsavel_padrao_id, visivel_cliente
			 FROM tipo_servico_modelo_tarefa
			 WHERE modelo_etapa_id IN (${placeholders}) AND ativa = 1
			 ORDER BY modelo_etapa_id, ordem, id`,
		)
		.bind(...modeloEtapaIds)
		.all<TarefaModeloRow>();

	const porEtapa = new Map<number, TarefaModeloRow[]>();
	for (const row of results) {
		const lista = porEtapa.get(row.modelo_etapa_id) ?? [];
		lista.push(row);
		porEtapa.set(row.modelo_etapa_id, lista);
	}
	return porEtapa;
}

/**
 * Copia as etapas (e as tarefas de cada etapa) de UM tipo de serviço para
 * projeto_etapas/projeto_tarefas, encadeando os prazos a partir de
 * `cursorInicial` (dias corridos). Retorna o cursor após a última etapa
 * gerada, para permitir encadear vários tipos em sequência (ver
 * gerarEtapasIniciais). Tarefas usam como referência o início previsto da
 * própria etapa (nunca a etapa anterior), conforme pedido.
 *
 * Um tipo sem modelo (ou só com etapas/tarefas inativas) não gera nada —
 * não é erro, `ordem`/`cursor` simplesmente não avançam.
 */
async function gerarEstruturaTipo(
	db: D1Database,
	projetoId: number,
	tipoServicoId: number,
	etapasModelo: EtapaModeloRow[],
	tarefasPorEtapa: Map<number, TarefaModeloRow[]>,
	cursorInicial: string,
	ordemInicial: number,
): Promise<{ cursor: string; ordem: number }> {
	let cursor = cursorInicial;
	let ordem = ordemInicial;

	for (const modelo of etapasModelo) {
		const dataInicioPrevista = cursor;
		const dataFimPrevista = modelo.prazo_dias != null ? adicionarDias(cursor, modelo.prazo_dias) : null;

		const etapaResultado = await db
			.prepare(
				`INSERT INTO projeto_etapas (
					projeto_id, nome, descricao, ordem, status,
					tipo_servico_id, modelo_etapa_id, peso, visivel_cliente,
					data_inicio_prevista, data_fim_prevista
				) VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)
				RETURNING id`,
			)
			.bind(
				projetoId,
				modelo.nome,
				modelo.descricao,
				ordem,
				tipoServicoId,
				modelo.id,
				modelo.peso,
				modelo.visivel_cliente,
				dataInicioPrevista,
				dataFimPrevista,
			)
			.first<{ id: number }>();

		const novaEtapaId = etapaResultado!.id;
		ordem += 1;
		cursor = dataFimPrevista ?? cursor;

		const tarefasModelo = tarefasPorEtapa.get(modelo.id) ?? [];
		let ordemTarefa = 0;
		for (const tarefa of tarefasModelo) {
			const prazoTarefa = tarefa.prazo_dias != null ? adicionarDias(dataInicioPrevista, tarefa.prazo_dias) : null;

			await db
				.prepare(
					`INSERT INTO projeto_tarefas (
						projeto_id, etapa_id, nome, descricao, ordem, status, prioridade,
						responsavel_id, data_inicio, prazo, visivel_cliente, origem_modelo_id
					) VALUES (?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					projetoId,
					novaEtapaId,
					tarefa.nome,
					tarefa.descricao,
					ordemTarefa,
					tarefa.prioridade_padrao,
					tarefa.responsavel_padrao_id,
					dataInicioPrevista,
					prazoTarefa,
					tarefa.visivel_cliente,
					tarefa.id,
				)
				.run();

			ordemTarefa += 1;
		}
	}

	return { cursor, ordem };
}

/**
 * Gera as etapas (e tarefas) iniciais do projeto a partir dos modelos dos
 * tipos de serviço selecionados na criação. Regra determinística de
 * ordenação: tipos de serviço processados em ordem crescente de id
 * (independente da ordem em que foram marcados no formulário), e dentro de
 * cada tipo as etapas seguem a ordem do modelo — a "ordem" final é
 * contínua ao longo de todos os tipos, nessa sequência.
 *
 * As etapas/tarefas geradas são CÓPIAS independentes: preservam
 * tipo_servico_id/modelo_etapa_id (e origem_modelo_id, para tarefa) só
 * como referência de origem (indicadores futuros e para
 * adicionarEstruturaTipoServico saber o que já foi gerado), nunca como
 * vínculo vivo — editar o modelo depois não afeta o projeto. Etapas de
 * tipos diferentes com nomes iguais NÃO são fundidas — cada uma preserva
 * sua origem separadamente.
 */
export async function gerarEtapasIniciais(
	db: D1Database,
	projetoId: number,
	tipoServicoIds: number[],
	dataInicioProjeto: string | null,
): Promise<void> {
	if (tipoServicoIds.length === 0) return;

	const idsOrdenados = [...new Set(tipoServicoIds)].sort((a, b) => a - b);
	const porTipo = await buscarEtapasModeloPorTipo(db, idsOrdenados);
	if (porTipo.size === 0) return;

	const todosModeloEtapaIds = [...porTipo.values()].flat().map((e) => e.id);
	const tarefasPorEtapa = await buscarTarefasModeloPorEtapa(db, todosModeloEtapaIds);

	let cursor = dataInicioProjeto ?? hojeIso();
	let ordem = 0;

	for (const tipoServicoId of idsOrdenados) {
		const etapasModelo = porTipo.get(tipoServicoId);
		if (!etapasModelo) continue;

		const resultado = await gerarEstruturaTipo(db, projetoId, tipoServicoId, etapasModelo, tarefasPorEtapa, cursor, ordem);
		cursor = resultado.cursor;
		ordem = resultado.ordem;
	}

	await sincronizarProgresso(db, projetoId);
}

/**
 * Adiciona a estrutura (etapas + tarefas) de UM tipo de serviço a um
 * projeto já existente ("Adicionar estrutura de um Tipo de Serviço").
 * Idempotente por origem: se o projeto já tem alguma etapa com este
 * tipo_servico_id, recusa (evita duplicar ao clicar duas vezes ou reabrir
 * a ação). Não reencadeia com as etapas já existentes de outros tipos —
 * começa do início do projeto (ou hoje), mesma regra da geração inicial,
 * já que é uma estrutura nova sendo anexada, não uma continuação.
 */
export async function adicionarEstruturaTipoServico(
	db: D1Database,
	projetoId: number,
	tipoServicoId: number,
	dataInicioProjeto: string | null,
): Promise<{ ok: true; etapasGeradas: number } | { ok: false; error: string }> {
	const jaGerado = await db
		.prepare("SELECT 1 FROM projeto_etapas WHERE projeto_id = ? AND tipo_servico_id = ?")
		.bind(projetoId, tipoServicoId)
		.first();
	if (jaGerado) {
		return { ok: false, error: "a estrutura deste tipo de serviço já foi gerada neste projeto" };
	}

	const porTipo = await buscarEtapasModeloPorTipo(db, [tipoServicoId]);
	const etapasModelo = porTipo.get(tipoServicoId) ?? [];
	if (etapasModelo.length === 0) {
		return { ok: false, error: "este tipo de serviço não tem um modelo de processo configurado" };
	}

	const tarefasPorEtapa = await buscarTarefasModeloPorEtapa(
		db,
		etapasModelo.map((e) => e.id),
	);

	const maxOrdem = await db
		.prepare("SELECT COALESCE(MAX(ordem), -1) AS maximo FROM projeto_etapas WHERE projeto_id = ?")
		.bind(projetoId)
		.first<{ maximo: number }>();

	await gerarEstruturaTipo(
		db,
		projetoId,
		tipoServicoId,
		etapasModelo,
		tarefasPorEtapa,
		dataInicioProjeto ?? hojeIso(),
		(maxOrdem?.maximo ?? -1) + 1,
	);

	await sincronizarProgresso(db, projetoId);

	return { ok: true, etapasGeradas: etapasModelo.length };
}

/**
 * Prévia do que "Adicionar estrutura de um Tipo de Serviço" geraria, sem
 * gravar nada — mostrada antes de confirmar. Tipos já gerados (mesma regra
 * de adicionarEstruturaTipoServico) não entram na lista de disponíveis.
 */
export async function tiposServicoDisponiveisParaGerar(
	db: D1Database,
	projetoId: number,
): Promise<{ tipoServicoId: number; nome: string; totalEtapas: number; totalTarefas: number }[]> {
	const { results: vinculados } = await db
		.prepare(
			`SELECT ts.id, ts.nome FROM projeto_tipos_servico pts
			 JOIN tipos_servico ts ON ts.id = pts.tipo_servico_id
			 WHERE pts.projeto_id = ?`,
		)
		.bind(projetoId)
		.all<{ id: number; nome: string }>();

	if (vinculados.length === 0) return [];

	const { results: jaGerados } = await db
		.prepare("SELECT DISTINCT tipo_servico_id FROM projeto_etapas WHERE projeto_id = ? AND tipo_servico_id IS NOT NULL")
		.bind(projetoId)
		.all<{ tipo_servico_id: number }>();
	const geradosSet = new Set(jaGerados.map((r) => r.tipo_servico_id));

	const pendentes = vinculados.filter((t) => !geradosSet.has(t.id));
	if (pendentes.length === 0) return [];

	const porTipo = await buscarEtapasModeloPorTipo(
		db,
		pendentes.map((t) => t.id),
	);

	const resultado: { tipoServicoId: number; nome: string; totalEtapas: number; totalTarefas: number }[] = [];
	for (const tipo of pendentes) {
		const etapasModelo = porTipo.get(tipo.id) ?? [];
		if (etapasModelo.length === 0) continue;

		const tarefasPorEtapa = await buscarTarefasModeloPorEtapa(
			db,
			etapasModelo.map((e) => e.id),
		);
		const totalTarefas = [...tarefasPorEtapa.values()].reduce((soma, lista) => soma + lista.length, 0);

		resultado.push({ tipoServicoId: tipo.id, nome: tipo.nome, totalEtapas: etapasModelo.length, totalTarefas });
	}

	return resultado;
}

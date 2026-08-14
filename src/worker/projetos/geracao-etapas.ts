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

/**
 * Gera as etapas iniciais do projeto a partir dos modelos dos tipos de
 * serviço selecionados (Configurações > Tipos de Serviço). Regra
 * determinística de ordenação: os tipos de serviço são processados em
 * ordem crescente de id (independente da ordem em que foram marcados no
 * formulário), e dentro de cada tipo as etapas seguem a ordem do modelo —
 * a "ordem" final da etapa do projeto é contínua ao longo de todos os
 * tipos, nessa sequência.
 *
 * Um tipo de serviço sem modelo configurado simplesmente não gera etapas
 * — não é tratado como erro.
 *
 * As etapas geradas são CÓPIAS independentes: preservam tipo_servico_id e
 * modelo_etapa_id só como referência de origem (indicadores futuros),
 * nunca como vínculo vivo — editar o modelo depois não afeta o projeto.
 *
 * Prazos previstos (dias corridos, ver prazos.ts): a primeira etapa
 * começa em dataInicioProjeto (ou hoje, se o projeto não tiver data de
 * início definida — regra segura documentada aqui: sem uma data real para
 * ancorar o cronograma, hoje é a única base disponível no momento da
 * criação). As etapas seguintes começam onde a anterior termina. Uma
 * etapa sem prazo_dias no modelo não empurra a data — a próxima etapa
 * começa na mesma data prevista de início dela.
 */
export async function gerarEtapasIniciais(
	db: D1Database,
	projetoId: number,
	tipoServicoIds: number[],
	dataInicioProjeto: string | null,
): Promise<void> {
	if (tipoServicoIds.length === 0) return;

	const idsOrdenados = [...new Set(tipoServicoIds)].sort((a, b) => a - b);

	const placeholders = idsOrdenados.map(() => "?").join(", ");
	const { results } = await db
		.prepare(
			`SELECT id, tipo_servico_id, nome, descricao, ordem, prazo_dias, peso, visivel_cliente
			 FROM tipo_servico_etapas_modelo
			 WHERE tipo_servico_id IN (${placeholders})
			 ORDER BY tipo_servico_id, ordem, id`,
		)
		.bind(...idsOrdenados)
		.all<EtapaModeloRow>();

	if (results.length === 0) return;

	// Reordena em memória seguindo estritamente a ordem de idsOrdenados
	// (o SQL acima já ordena por tipo_servico_id, mas isso reforça a regra
	// determinística de forma explícita e independente da collation do SQLite).
	const porTipo = new Map<number, EtapaModeloRow[]>();
	for (const row of results) {
		const lista = porTipo.get(row.tipo_servico_id) ?? [];
		lista.push(row);
		porTipo.set(row.tipo_servico_id, lista);
	}

	let cursor = dataInicioProjeto ?? hojeIso();
	let ordem = 0;

	for (const tipoServicoId of idsOrdenados) {
		const modelos = porTipo.get(tipoServicoId);
		if (!modelos) continue;

		for (const modelo of modelos) {
			const dataInicioPrevista = cursor;
			const dataFimPrevista = modelo.prazo_dias != null ? adicionarDias(cursor, modelo.prazo_dias) : null;

			await db
				.prepare(
					`INSERT INTO projeto_etapas (
						projeto_id, nome, descricao, ordem, status,
						tipo_servico_id, modelo_etapa_id, peso, visivel_cliente,
						data_inicio_prevista, data_fim_prevista
					) VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)`,
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
				.run();

			ordem += 1;
			cursor = dataFimPrevista ?? cursor;
		}
	}

	await sincronizarProgresso(db, projetoId);
}

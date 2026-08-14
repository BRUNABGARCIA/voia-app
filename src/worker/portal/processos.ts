// Consultas do Portal do Cliente. Todo SELECT aqui lista explicitamente as
// colunas retornadas — nunca "SELECT p.*" — porque a resposta destas
// consultas vai direto para fora do sistema (API externa). Nenhum campo
// administrativo (observações internas, valores contratados, endereço da
// obra, dados de equipe) é buscado por estas funções.

export interface ProcessoResumo {
	id: number;
	codigo: string | null;
	nome: string;
	status: string;
	progresso: number;
	prazoPrevisto: string | null;
}

export interface EtapaPublica {
	id: number;
	nome: string;
	descricao: string | null;
	ordem: number;
	status: string;
	dataInicioPrevista: string | null;
	dataFimPrevista: string | null;
	dataConclusao: string | null;
	atrasada: boolean;
}

export interface AtualizacaoPublica {
	id: number;
	titulo: string;
	descricao: string | null;
	tipo: string;
	criadoEm: string;
}

/** Lista os projetos que o contato tem autorização explícita para ver. */
export async function listarProcessosAutorizados(db: D1Database, contatoId: number): Promise<ProcessoResumo[]> {
	const { results } = await db
		.prepare(
			`SELECT p.id, p.codigo, p.nome, p.status, p.progresso, p.prazo_previsto AS prazoPrevisto
			 FROM cliente_contato_processos ccp
			 JOIN projetos p ON p.id = ccp.projeto_id
			 WHERE ccp.contato_id = ?
			 ORDER BY p.criado_em DESC`,
		)
		.bind(contatoId)
		.all<{ id: number; codigo: string | null; nome: string; status: string; progresso: number; prazoPrevisto: string | null }>();

	return results.map((r) => ({ ...r }));
}

/**
 * Verifica se o contato está autorizado para o projeto informado. Nunca
 * confia em nenhum outro dado do request para decidir isso — só a sessão
 * resolvida (contatoId) e o :id da URL, cruzados nesta query.
 */
export async function estaAutorizado(db: D1Database, contatoId: number, projetoId: number): Promise<boolean> {
	const row = await db
		.prepare("SELECT 1 FROM cliente_contato_processos WHERE contato_id = ? AND projeto_id = ?")
		.bind(contatoId, projetoId)
		.first();
	return row !== null;
}

export async function buscarTiposServico(db: D1Database, projetoId: number): Promise<{ id: number; nome: string }[]> {
	const { results } = await db
		.prepare(
			`SELECT ts.id, ts.nome FROM projeto_tipos_servico pts
			 JOIN tipos_servico ts ON ts.id = pts.tipo_servico_id
			 WHERE pts.projeto_id = ?
			 ORDER BY ts.nome`,
		)
		.bind(projetoId)
		.all<{ id: number; nome: string }>();
	return results;
}

export async function buscarEtapasPublicas(db: D1Database, projetoId: number): Promise<EtapaPublica[]> {
	const { results } = await db
		.prepare(
			`SELECT id, nome, descricao, ordem, status,
			        data_inicio_prevista AS dataInicioPrevista, data_fim_prevista AS dataFimPrevista,
			        data_conclusao AS dataConclusao,
			        (data_fim_prevista IS NOT NULL AND data_fim_prevista < date('now') AND status <> 'concluida') AS atrasada
			 FROM projeto_etapas
			 WHERE projeto_id = ? AND visivel_cliente = 1
			 ORDER BY ordem, id`,
		)
		.bind(projetoId)
		.all<EtapaPublica>();

	return results.map((e) => ({ ...e, atrasada: Boolean(e.atrasada) }));
}

/** Etapa atual = primeira etapa visível não concluída, na ordem. Próxima = a seguinte a ela. */
export function etapaAtualEProxima(etapas: EtapaPublica[]): { atual: EtapaPublica | null; proxima: EtapaPublica | null } {
	const idx = etapas.findIndex((e) => e.status !== "concluida");
	if (idx === -1) return { atual: null, proxima: null };
	return { atual: etapas[idx], proxima: etapas[idx + 1] ?? null };
}

export async function buscarAtualizacoesPublicas(db: D1Database, projetoId: number): Promise<AtualizacaoPublica[]> {
	const { results } = await db
		.prepare(
			`SELECT id, titulo, descricao, tipo, criado_em AS criadoEm
			 FROM projeto_atualizacoes
			 WHERE projeto_id = ? AND visivel_cliente = 1
			 ORDER BY criado_em DESC, id DESC`,
		)
		.bind(projetoId)
		.all<AtualizacaoPublica>();
	return results;
}

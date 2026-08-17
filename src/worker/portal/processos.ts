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

export interface TarefaPublica {
	id: number;
	nome: string;
	descricao: string | null;
	status: string;
	prazo: string | null;
	dataConclusao: string | null;
	atrasada: boolean;
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
	tarefas: TarefaPublica[];
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
		.all<Omit<EtapaPublica, "tarefas">>();

	const etapas = results.map((e) => ({ ...e, atrasada: Boolean(e.atrasada), tarefas: [] as TarefaPublica[] }));
	if (etapas.length === 0) return etapas;

	// Tarefas de todas as etapas visíveis em uma única query (evita N+1),
	// só as com visivel_cliente = 1 — o mesmo filtro de segurança das etapas.
	const placeholders = etapas.map(() => "?").join(", ");
	const { results: tarefas } = await db
		.prepare(
			`SELECT id, etapa_id AS etapaId, nome, descricao, status, prazo,
			        data_conclusao AS dataConclusao,
			        (status NOT IN ('concluida', 'cancelada') AND prazo IS NOT NULL AND prazo < date('now')) AS atrasada
			 FROM projeto_tarefas
			 WHERE etapa_id IN (${placeholders}) AND visivel_cliente = 1
			 ORDER BY ordem, id`,
		)
		.bind(...etapas.map((e) => e.id))
		.all<TarefaPublica & { etapaId: number }>();

	const porEtapa = new Map<number, TarefaPublica[]>();
	for (const { etapaId, ...tarefa } of tarefas) {
		const lista = porEtapa.get(etapaId) ?? [];
		lista.push({ ...tarefa, atrasada: Boolean(tarefa.atrasada) });
		porEtapa.set(etapaId, lista);
	}

	return etapas.map((etapa) => ({ ...etapa, tarefas: porEtapa.get(etapa.id) ?? [] }));
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

export interface DocumentoPublico {
	id: number;
	nome: string;
	categoria: string;
	descricao: string | null;
	criadoEm: string;
	mimeType: string | null;
	tamanhoBytes: number | null;
	possuiArquivo: boolean;
}

// Nunca inclui storage_key (chave interna do armazenamento) nem autor_id —
// mesma régua desta camada de nunca vazar coluna administrativa para fora.
// "possuiArquivo" é só um booleano derivado (storage_key IS NOT NULL) para
// a interface decidir se mostra o botão Baixar — o valor da chave em si
// nunca sai daqui; o download real é servido por uma rota separada que
// resolve a storage_key sozinha no backend a partir do id do documento.
export async function buscarDocumentosPublicos(db: D1Database, projetoId: number): Promise<DocumentoPublico[]> {
	const { results } = await db
		.prepare(
			`SELECT id, nome, categoria, descricao, criado_em AS criadoEm,
			        mime_type AS mimeType, tamanho_bytes AS tamanhoBytes,
			        (storage_key IS NOT NULL) AS possuiArquivo
			 FROM projeto_documentos
			 WHERE projeto_id = ? AND visivel_cliente = 1
			 ORDER BY criado_em DESC, id DESC`,
		)
		.bind(projetoId)
		.all<DocumentoPublico>();
	return results.map((r) => ({ ...r, possuiArquivo: Boolean(r.possuiArquivo) }));
}

/**
 * Verifica se o documento é baixável por este contato: precisa pertencer
 * ao projeto para o qual o contato já foi autorizado (checado por quem
 * chama, via estaAutorizado), estar marcado visivel_cliente=1, E ter um
 * arquivo de fato anexado. Nunca é suficiente só o :documentoId da URL —
 * projetoId também precisa bater, senão devolve null (404 para quem chama).
 */
export async function buscarDocumentoBaixavel(
	db: D1Database,
	projetoId: number,
	documentoId: number,
): Promise<{ storageKey: string; nomeArquivoOriginal: string | null; nome: string; mimeType: string | null } | null> {
	const row = await db
		.prepare(
			`SELECT storage_key AS storageKey, nome_arquivo_original AS nomeArquivoOriginal, nome, mime_type AS mimeType
			 FROM projeto_documentos
			 WHERE id = ? AND projeto_id = ? AND visivel_cliente = 1 AND storage_key IS NOT NULL`,
		)
		.bind(documentoId, projetoId)
		.first<{ storageKey: string; nomeArquivoOriginal: string | null; nome: string; mimeType: string | null }>();
	return row ?? null;
}

import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole, withSession, type AuthEnv } from "../auth/middleware";
import { sincronizarProgresso, obterProgressoAtual } from "./progresso";
import { gerarEtapasIniciais, adicionarEstruturaTipoServico, tiposServicoDisponiveisParaGerar } from "./geracao-etapas";
import { sqlEtapaAtrasada, sqlProjetoAtrasado, sqlTarefaAtrasada } from "./atraso";
import { registrarEvento } from "./historico";

const STATUS = [
	"prospeccao",
	"planejamento",
	"em_andamento",
	"aguardando_cliente",
	"aguardando_terceiro",
	"pausado",
	"concluido",
	"cancelado",
] as const;
const PRIORIDADES = ["baixa", "normal", "alta", "urgente"] as const;
const FUNCOES_MEMBRO = ["responsavel", "projetista", "fiscal", "orcamentista", "colaborador"] as const;

const textoOpcional = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.nullable()
		.transform((v) => (v ? v : null));

const camposProjeto = {
	cliente_id: z.number().int().positive(),
	nome: z.string().trim().min(1).max(200),
	descricao: textoOpcional(2000),
	status: z.enum(STATUS).optional(),
	prioridade: z.enum(PRIORIDADES).optional(),
	valor_contratado: z.number().int().nonnegative().optional().nullable(),
	data_inicio: textoOpcional(10),
	prazo_previsto: textoOpcional(10),
	cep: textoOpcional(10),
	logradouro: textoOpcional(200),
	numero: textoOpcional(20),
	complemento: textoOpcional(100),
	bairro: textoOpcional(100),
	cidade: textoOpcional(100),
	estado: textoOpcional(2),
	gerente_id: z.number().int().positive().optional().nullable(),
	observacoes: textoOpcional(2000),
	tipo_servico_ids: z.array(z.number().int().positive()).optional(),
};

const criarProjetoSchema = z.object(camposProjeto);

const patchProjetoSchema = z
	.object(camposProjeto)
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const membroSchema = z.object({
	usuario_id: z.number().int().positive(),
	funcao: z.enum(FUNCOES_MEMBRO).optional().default("colaborador"),
});

const TIPO_ATUALIZACAO = ["geral", "protocolo", "pendencia", "aprovacao", "etapa", "sistema"] as const;

const criarAtualizacaoSchema = z.object({
	titulo: z.string().trim().min(1).max(200),
	descricao: textoOpcional(2000),
	tipo: z.enum(TIPO_ATUALIZACAO).optional(),
	etapa_id: z.number().int().positive().optional().nullable(),
	visivel_cliente: z.boolean().optional(),
});

const patchMembroSchema = z.object({ funcao: z.enum(FUNCOES_MEMBRO) });

const STATUS_ETAPA = ["pendente", "em_andamento", "concluida"] as const;

const camposEtapa = {
	nome: z.string().trim().min(1).max(200),
	descricao: textoOpcional(2000),
	ordem: z.number().int().min(0).optional(),
	status: z.enum(STATUS_ETAPA).optional(),
	data_inicio_prevista: textoOpcional(10),
	data_fim_prevista: textoOpcional(10),
	data_inicio_real: textoOpcional(10),
	observacao_interna: textoOpcional(2000),
	visivel_cliente: z.boolean().optional(),
};

const criarEtapaSchema = z.object(camposEtapa);

const patchEtapaSchema = z
	.object(camposEtapa)
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

// "atrasada" é sempre derivada (nunca um status persistido): prazo previsto
// vencido, OU alguma tarefa dela atrasada (worker/projetos/atraso.ts —
// mesma regra usada no Dashboard). Calculada em SQL com date('now') para
// não depender do relógio local do worker. tarefas_total exclui canceladas
// (mesma régua do denominador do progresso).
const SELECT_ETAPA = `
	SELECT id, projeto_id, nome, descricao, ordem, status,
	       data_inicio_prevista, data_fim_prevista, data_inicio_real, data_conclusao,
	       observacao_interna, visivel_cliente, peso, tipo_servico_id, modelo_etapa_id,
	       criado_em, atualizado_em,
	       ${sqlEtapaAtrasada("projeto_etapas")} AS atrasada,
	       (SELECT COUNT(*) FROM projeto_tarefas pt WHERE pt.etapa_id = projeto_etapas.id AND pt.status <> 'cancelada') AS tarefas_total,
	       (SELECT COUNT(*) FROM projeto_tarefas pt WHERE pt.etapa_id = projeto_etapas.id AND pt.status = 'concluida') AS tarefas_concluidas
	FROM projeto_etapas
`;

const STATUS_TAREFA = ["pendente", "em_andamento", "aguardando", "concluida", "cancelada"] as const;

const camposTarefa = {
	nome: z.string().trim().min(1).max(200),
	descricao: textoOpcional(2000),
	ordem: z.number().int().min(0).optional(),
	status: z.enum(STATUS_TAREFA).optional(),
	prioridade: z.enum(PRIORIDADES).optional(),
	responsavel_id: z.number().int().positive().optional().nullable(),
	data_inicio: textoOpcional(10),
	prazo: textoOpcional(10),
	visivel_cliente: z.boolean().optional(),
};

const criarTarefaSchema = z.object(camposTarefa);

const patchTarefaSchema = z
	.object(camposTarefa)
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const SELECT_TAREFA = `
	SELECT t.id, t.projeto_id, t.etapa_id, t.nome, t.descricao, t.ordem, t.status, t.prioridade,
	       t.responsavel_id, u.nome AS responsavel_nome, t.data_inicio, t.prazo, t.data_conclusao,
	       t.visivel_cliente, t.origem_modelo_id, t.criado_em, t.atualizado_em,
	       ${sqlTarefaAtrasada("t")} AS atrasada
	FROM projeto_tarefas t
	LEFT JOIN usuarios u ON u.id = t.responsavel_id
`;

const gerarEstruturaSchema = z.object({ tipo_servico_id: z.number().int().positive() });

/**
 * Gera o código PRJ-{ANO}-{sequencial}, reiniciado a cada ano. Um único
 * statement atômico (INSERT ... ON CONFLICT DO UPDATE ... RETURNING)
 * evita a corrida de "ler o próximo número" e "gravar" em dois passos.
 */
async function gerarCodigoProjeto(db: D1Database): Promise<string> {
	const ano = new Date().getFullYear();
	const chave = `projeto_${ano}`;

	const row = await db
		.prepare(
			"INSERT INTO contadores (chave, valor) VALUES (?, 1) ON CONFLICT (chave) DO UPDATE SET valor = valor + 1 RETURNING valor",
		)
		.bind(chave)
		.first<{ valor: number }>();

	const sequencial = String(row!.valor).padStart(4, "0");
	return `PRJ-${ano}-${sequencial}`;
}

// "atrasado" combina a regra já existente (prazo do projeto vencido) com a
// nova (alguma etapa/tarefa do projeto atrasada) — mesmo fragmento SQL
// usado no Dashboard, para as duas telas nunca divergirem.
const SELECT_LISTA = `
	SELECT p.id, p.codigo, p.nome, p.status, p.prioridade, p.progresso, p.valor_contratado,
	       p.data_inicio, p.prazo_previsto, p.criado_em, p.atualizado_em,
	       p.cliente_id, c.nome AS cliente_nome,
	       p.gerente_id, u.nome AS gerente_nome,
	       ${sqlProjetoAtrasado("p")} AS atrasado
	FROM projetos p
	JOIN clientes c ON c.id = p.cliente_id
	LEFT JOIN usuarios u ON u.id = p.gerente_id
`;

const projetos = new Hono<AuthEnv>();

// Catálogo de tipos de serviço — lista somente-leitura para alimentar
// seletores em Clientes/Projetos. Sem tela de administração ainda; o
// catálogo é mantido via migration por enquanto.
projetos.get("/tipos-servico", withSession, requireAuth, async (c) => {
	const { results } = await c.env.DB.prepare("SELECT id, nome FROM tipos_servico WHERE ativo = 1 ORDER BY nome").all();
	return c.json({ tiposServico: results });
});

// Visualizar projetos é permitido a qualquer usuário autenticado
// (inclusive "visualizador" e "colaborador"). Criar/gerenciar equipe e
// cancelar exigem perfis mais altos, aplicados individualmente abaixo.
projetos.get("/", withSession, requireAuth, async (c) => {
	const status = c.req.query("status");
	const prioridade = c.req.query("prioridade");
	const clienteId = c.req.query("cliente_id");
	const responsavelId = c.req.query("responsavel_id");
	const q = c.req.query("q")?.trim();

	const condicoes: string[] = [];
	const valores: unknown[] = [];

	if (status && (STATUS as readonly string[]).includes(status)) {
		condicoes.push("p.status = ?");
		valores.push(status);
	}
	if (prioridade && (PRIORIDADES as readonly string[]).includes(prioridade)) {
		condicoes.push("p.prioridade = ?");
		valores.push(prioridade);
	}
	if (clienteId && Number.isInteger(Number(clienteId))) {
		condicoes.push("p.cliente_id = ?");
		valores.push(Number(clienteId));
	}
	if (responsavelId && Number.isInteger(Number(responsavelId))) {
		condicoes.push("p.gerente_id = ?");
		valores.push(Number(responsavelId));
	}
	if (q) {
		condicoes.push("(p.nome LIKE ? OR p.codigo LIKE ?)");
		const termo = `%${q}%`;
		valores.push(termo, termo);
	}

	const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
	const { results } = await c.env.DB.prepare(`${SELECT_LISTA} ${where} ORDER BY p.criado_em DESC`)
		.bind(...valores)
		.all();

	return c.json({ projetos: results });
});

projetos.get("/:id", withSession, requireAuth, async (c) => {
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const projeto = await c.env.DB.prepare(
		`SELECT p.*, c.nome AS cliente_nome, u.nome AS gerente_nome, ${sqlProjetoAtrasado("p")} AS atrasado
		 FROM projetos p
		 JOIN clientes c ON c.id = p.cliente_id
		 LEFT JOIN usuarios u ON u.id = p.gerente_id
		 WHERE p.id = ?`,
	)
		.bind(id)
		.first();
	if (!projeto) {
		return c.json({ error: "projeto não encontrado" }, 404);
	}

	const { results: tiposServico } = await c.env.DB.prepare(
		`SELECT ts.id, ts.nome FROM projeto_tipos_servico pts
		 JOIN tipos_servico ts ON ts.id = pts.tipo_servico_id
		 WHERE pts.projeto_id = ?
		 ORDER BY ts.nome`,
	)
		.bind(id)
		.all();

	const { results: membros } = await c.env.DB.prepare(
		`SELECT pm.usuario_id, pm.funcao, pm.adicionado_em, u.nome, u.email
		 FROM projeto_membros pm
		 JOIN usuarios u ON u.id = pm.usuario_id
		 WHERE pm.projeto_id = ?
		 ORDER BY u.nome`,
	)
		.bind(id)
		.all();

	return c.json({ projeto, tiposServico, membros });
});

projetos.post("/", withSession, requireAuth, requireRole("administrador", "gestor"), async (c) => {
	const body = await c.req.json().catch(() => null);
	const parsed = criarProjetoSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}
	const dados = parsed.data;

	const cliente = await c.env.DB.prepare("SELECT id FROM clientes WHERE id = ?").bind(dados.cliente_id).first();
	if (!cliente) {
		return c.json({ error: "cliente não encontrado" }, 400);
	}

	const atual = c.get("user")!;
	const codigo = await gerarCodigoProjeto(c.env.DB);

	let novoId: number;
	try {
		const resultado = await c.env.DB.prepare(
			`INSERT INTO projetos (
				cliente_id, codigo, nome, descricao, status, prioridade,
				valor_contratado, data_inicio, prazo_previsto,
				cep, logradouro, numero, complemento, bairro, cidade, estado,
				gerente_id, criado_por_id, observacoes
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			RETURNING id`,
		)
			.bind(
				dados.cliente_id,
				codigo,
				dados.nome,
				dados.descricao,
				dados.status ?? "planejamento",
				dados.prioridade ?? "normal",
				dados.valor_contratado ?? null,
				dados.data_inicio,
				dados.prazo_previsto,
				dados.cep,
				dados.logradouro,
				dados.numero,
				dados.complemento,
				dados.bairro,
				dados.cidade,
				dados.estado,
				dados.gerente_id ?? null,
				atual.id,
				dados.observacoes,
			)
			.first<{ id: number }>();
		if (!resultado) throw new Error("insert sem retorno");
		novoId = resultado.id;
	} catch {
		return c.json({ error: "não foi possível criar o projeto" }, 500);
	}

	if (dados.tipo_servico_ids && dados.tipo_servico_ids.length > 0) {
		for (const tipoServicoId of dados.tipo_servico_ids) {
			await c.env.DB.prepare("INSERT OR IGNORE INTO projeto_tipos_servico (projeto_id, tipo_servico_id) VALUES (?, ?)")
				.bind(novoId, tipoServicoId)
				.run();
		}

		// Copia as etapas dos modelos dos tipos de serviço selecionados para
		// projeto_etapas — cópias independentes, o template original nunca é
		// alterado. Tipo sem modelo configurado não gera etapas (não é erro).
		await gerarEtapasIniciais(c.env.DB, novoId, dados.tipo_servico_ids, dados.data_inicio ?? null);
	}

	const criado = await c.env.DB.prepare(
		`SELECT p.*, c.nome AS cliente_nome, u.nome AS gerente_nome, ${sqlProjetoAtrasado("p")} AS atrasado
		 FROM projetos p
		 JOIN clientes c ON c.id = p.cliente_id
		 LEFT JOIN usuarios u ON u.id = p.gerente_id
		 WHERE p.id = ?`,
	)
		.bind(novoId)
		.first();

	return c.json({ projeto: criado }, 201);
});

projetos.patch("/:id", withSession, requireAuth, requireRole("administrador", "gestor", "colaborador"), async (c) => {
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const existente = await c.env.DB.prepare("SELECT id, status FROM projetos WHERE id = ?")
		.bind(id)
		.first<{ id: number; status: string }>();
	if (!existente) {
		return c.json({ error: "projeto não encontrado" }, 404);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = patchProjetoSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}

	const atual = c.get("user")!;

	// Cancelar/arquivar um projeto é uma ação administrativa: colaborador
	// pode editar os dados operacionais do projeto, mas não esta transição.
	if (parsed.data.status === "cancelado" && atual.perfil === "colaborador") {
		return c.json({ error: "apenas administrador ou gestor pode cancelar um projeto" }, 403);
	}

	if (parsed.data.cliente_id !== undefined) {
		const cliente = await c.env.DB.prepare("SELECT id FROM clientes WHERE id = ?").bind(parsed.data.cliente_id).first();
		if (!cliente) {
			return c.json({ error: "cliente não encontrado" }, 400);
		}
	}

	const { tipo_servico_ids: tipoServicoIds, ...dadosProjeto } = parsed.data;

	if (Object.keys(dadosProjeto).length > 0) {
		const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
		const valores: unknown[] = [];
		for (const [campo, valor] of Object.entries(dadosProjeto)) {
			campos.push(`${campo} = ?`);
			valores.push(valor);
		}

		await c.env.DB.prepare(`UPDATE projetos SET ${campos.join(", ")} WHERE id = ?`)
			.bind(...valores, id)
			.run();
	}

	if (tipoServicoIds !== undefined) {
		await c.env.DB.prepare("DELETE FROM projeto_tipos_servico WHERE projeto_id = ?").bind(id).run();
		for (const tipoServicoId of tipoServicoIds) {
			await c.env.DB.prepare("INSERT OR IGNORE INTO projeto_tipos_servico (projeto_id, tipo_servico_id) VALUES (?, ?)")
				.bind(id, tipoServicoId)
				.run();
		}
	}

	if (parsed.data.status !== undefined && parsed.data.status !== existente.status) {
		await registrarEvento(c.env.DB, {
			projetoId: id,
			tipo: "sistema",
			tipoEvento: "status_projeto_alterado",
			entidadeTipo: "projeto",
			entidadeId: id,
			titulo: `Status do projeto alterado para "${parsed.data.status}"`,
			usuarioId: atual.id,
			visivelCliente: false,
		});
	}

	const atualizado = await c.env.DB.prepare(
		`SELECT p.*, c.nome AS cliente_nome, u.nome AS gerente_nome, ${sqlProjetoAtrasado("p")} AS atrasado
		 FROM projetos p
		 JOIN clientes c ON c.id = p.cliente_id
		 LEFT JOIN usuarios u ON u.id = p.gerente_id
		 WHERE p.id = ?`,
	)
		.bind(id)
		.first();

	return c.json({ projeto: atualizado });
});

projetos.get("/:id/membros", withSession, requireAuth, async (c) => {
	const projetoId = Number(c.req.param("id"));
	if (!Number.isInteger(projetoId) || projetoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const { results } = await c.env.DB.prepare(
		`SELECT pm.usuario_id, pm.funcao, pm.adicionado_em, u.nome, u.email
		 FROM projeto_membros pm
		 JOIN usuarios u ON u.id = pm.usuario_id
		 WHERE pm.projeto_id = ?
		 ORDER BY u.nome`,
	)
		.bind(projetoId)
		.all();

	return c.json({ membros: results });
});

projetos.post("/:id/membros", withSession, requireAuth, requireRole("administrador", "gestor"), async (c) => {
	const projetoId = Number(c.req.param("id"));
	if (!Number.isInteger(projetoId) || projetoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const projeto = await c.env.DB.prepare("SELECT id FROM projetos WHERE id = ?").bind(projetoId).first();
	if (!projeto) {
		return c.json({ error: "projeto não encontrado" }, 404);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = membroSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}

	const usuario = await c.env.DB.prepare("SELECT id FROM usuarios WHERE id = ?").bind(parsed.data.usuario_id).first();
	if (!usuario) {
		return c.json({ error: "usuário não encontrado" }, 400);
	}

	try {
		await c.env.DB.prepare("INSERT INTO projeto_membros (projeto_id, usuario_id, funcao) VALUES (?, ?, ?)")
			.bind(projetoId, parsed.data.usuario_id, parsed.data.funcao)
			.run();
	} catch {
		return c.json({ error: "usuário já é membro deste projeto" }, 409);
	}

	const { results } = await c.env.DB.prepare(
		`SELECT pm.usuario_id, pm.funcao, pm.adicionado_em, u.nome, u.email
		 FROM projeto_membros pm
		 JOIN usuarios u ON u.id = pm.usuario_id
		 WHERE pm.projeto_id = ?
		 ORDER BY u.nome`,
	)
		.bind(projetoId)
		.all();

	return c.json({ membros: results }, 201);
});

projetos.patch("/:id/membros/:usuarioId", withSession, requireAuth, requireRole("administrador", "gestor"), async (c) => {
	const projetoId = Number(c.req.param("id"));
	const usuarioId = Number(c.req.param("usuarioId"));
	if (!Number.isInteger(projetoId) || !Number.isInteger(usuarioId)) {
		return c.json({ error: "id inválido" }, 400);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = patchMembroSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}

	const resultado = await c.env.DB.prepare(
		"UPDATE projeto_membros SET funcao = ? WHERE projeto_id = ? AND usuario_id = ?",
	)
		.bind(parsed.data.funcao, projetoId, usuarioId)
		.run();

	if (resultado.meta.changes === 0) {
		return c.json({ error: "membro não encontrado neste projeto" }, 404);
	}

	return c.json({ ok: true });
});

projetos.delete("/:id/membros/:usuarioId", withSession, requireAuth, requireRole("administrador", "gestor"), async (c) => {
	const projetoId = Number(c.req.param("id"));
	const usuarioId = Number(c.req.param("usuarioId"));
	if (!Number.isInteger(projetoId) || !Number.isInteger(usuarioId)) {
		return c.json({ error: "id inválido" }, 400);
	}

	const resultado = await c.env.DB.prepare("DELETE FROM projeto_membros WHERE projeto_id = ? AND usuario_id = ?")
		.bind(projetoId, usuarioId)
		.run();

	if (resultado.meta.changes === 0) {
		return c.json({ error: "membro não encontrado neste projeto" }, 404);
	}

	return c.json({ ok: true });
});

// Etapas do projeto — o progresso do projeto é sempre derivado delas
// (progresso.ts), nunca informado manualmente. Ver/criar/editar segue a
// mesma régua de "editar projeto" (colaborador incluso); excluir é mais
// restrito (administrador/gestor), mesma régua de "gerenciar equipe" e
// "cancelar" — ações que alteram a estrutura do projeto, não só o dia a
// dia operacional.
projetos.get("/:id/etapas", withSession, requireAuth, async (c) => {
	const projetoId = Number(c.req.param("id"));
	if (!Number.isInteger(projetoId) || projetoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const { results } = await c.env.DB.prepare(`${SELECT_ETAPA} WHERE projeto_id = ? ORDER BY ordem, id`)
		.bind(projetoId)
		.all();

	const progressoAtual = await obterProgressoAtual(c.env.DB, projetoId);

	return c.json({ etapas: results, ...progressoAtual });
});

projetos.post("/:id/etapas", withSession, requireAuth, requireRole("administrador", "gestor", "colaborador"), async (c) => {
	const projetoId = Number(c.req.param("id"));
	if (!Number.isInteger(projetoId) || projetoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const projeto = await c.env.DB.prepare("SELECT id FROM projetos WHERE id = ?").bind(projetoId).first();
	if (!projeto) {
		return c.json({ error: "projeto não encontrado" }, 404);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = criarEtapaSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}
	const dados = parsed.data;

	let ordem = dados.ordem;
	if (ordem === undefined) {
		const maxOrdem = await c.env.DB.prepare(
			"SELECT COALESCE(MAX(ordem), -1) AS maximo FROM projeto_etapas WHERE projeto_id = ?",
		)
			.bind(projetoId)
			.first<{ maximo: number }>();
		ordem = (maxOrdem?.maximo ?? -1) + 1;
	}

	const status = dados.status ?? "pendente";
	const dataConclusao = status === "concluida" ? new Date().toISOString().slice(0, 10) : null;
	const visivelCliente = dados.visivel_cliente === undefined ? 1 : dados.visivel_cliente ? 1 : 0;

	const resultado = await c.env.DB.prepare(
		`INSERT INTO projeto_etapas (
			projeto_id, nome, descricao, ordem, status,
			data_inicio_prevista, data_fim_prevista, data_inicio_real, data_conclusao,
			observacao_interna, visivel_cliente
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 RETURNING id`,
	)
		.bind(
			projetoId,
			dados.nome,
			dados.descricao,
			ordem,
			status,
			dados.data_inicio_prevista,
			dados.data_fim_prevista,
			dados.data_inicio_real,
			dataConclusao,
			dados.observacao_interna,
			visivelCliente,
		)
		.first<{ id: number }>();

	const progresso = await sincronizarProgresso(c.env.DB, projetoId);

	await registrarEvento(c.env.DB, {
		projetoId,
		tipo: "etapa",
		tipoEvento: "etapa_criada",
		entidadeTipo: "etapa",
		entidadeId: resultado!.id,
		titulo: `Etapa "${dados.nome}" criada`,
		usuarioId: c.get("user")!.id,
		visivelCliente: false,
	});

	const etapa = await c.env.DB.prepare(`${SELECT_ETAPA} WHERE id = ?`).bind(resultado!.id).first();

	return c.json({ etapa, progresso }, 201);
});

projetos.patch(
	"/:id/etapas/:etapaId",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor", "colaborador"),
	async (c) => {
		const projetoId = Number(c.req.param("id"));
		const etapaId = Number(c.req.param("etapaId"));
		if (!Number.isInteger(projetoId) || !Number.isInteger(etapaId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const existente = await c.env.DB.prepare(
			"SELECT nome, status, data_fim_prevista FROM projeto_etapas WHERE id = ? AND projeto_id = ?",
		)
			.bind(etapaId, projetoId)
			.first<{ nome: string; status: string; data_fim_prevista: string | null }>();
		if (!existente) {
			return c.json({ error: "etapa não encontrada" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = patchEtapaSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}
		const dados: Record<string, unknown> = { ...parsed.data };

		if (typeof dados.visivel_cliente === "boolean") {
			dados.visivel_cliente = dados.visivel_cliente ? 1 : 0;
		}

		// data_conclusao é derivada da transição de status — nunca informada
		// diretamente pelo cliente (não está no schema de entrada).
		let eventoStatus: "etapa_concluida" | "etapa_reaberta" | null = null;
		if (typeof dados.status === "string") {
			if (dados.status === "concluida" && existente.status !== "concluida") {
				dados.data_conclusao = new Date().toISOString().slice(0, 10);
				eventoStatus = "etapa_concluida";
			} else if (dados.status !== "concluida" && existente.status === "concluida") {
				dados.data_conclusao = null;
				eventoStatus = "etapa_reaberta";
			}
		}
		const prazoAlterado =
			typeof dados.data_fim_prevista !== "undefined" && dados.data_fim_prevista !== existente.data_fim_prevista;

		const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
		const valores: unknown[] = [];
		for (const [campo, valor] of Object.entries(dados)) {
			campos.push(`${campo} = ?`);
			valores.push(valor);
		}

		await c.env.DB.prepare(`UPDATE projeto_etapas SET ${campos.join(", ")} WHERE id = ?`)
			.bind(...valores, etapaId)
			.run();

		const progresso = await sincronizarProgresso(c.env.DB, projetoId);

		const atual = c.get("user")!;
		if (eventoStatus === "etapa_concluida") {
			await registrarEvento(c.env.DB, {
				projetoId,
				tipo: "etapa",
				tipoEvento: "etapa_concluida",
				entidadeTipo: "etapa",
				entidadeId: etapaId,
				etapaId,
				titulo: `Etapa "${existente.nome}" concluída`,
				usuarioId: atual.id,
				visivelCliente: true,
			});
		} else if (eventoStatus === "etapa_reaberta") {
			await registrarEvento(c.env.DB, {
				projetoId,
				tipo: "etapa",
				tipoEvento: "etapa_reaberta",
				entidadeTipo: "etapa",
				entidadeId: etapaId,
				etapaId,
				titulo: `Etapa "${existente.nome}" reaberta`,
				usuarioId: atual.id,
				visivelCliente: false,
			});
		}
		if (prazoAlterado) {
			await registrarEvento(c.env.DB, {
				projetoId,
				tipo: "sistema",
				tipoEvento: "prazo_alterado",
				entidadeTipo: "etapa",
				entidadeId: etapaId,
				etapaId,
				titulo: `Prazo da etapa "${existente.nome}" alterado`,
				usuarioId: atual.id,
				visivelCliente: false,
			});
		}

		const etapa = await c.env.DB.prepare(`${SELECT_ETAPA} WHERE id = ?`).bind(etapaId).first();

		return c.json({ etapa, progresso });
	},
);

projetos.delete(
	"/:id/etapas/:etapaId",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const projetoId = Number(c.req.param("id"));
		const etapaId = Number(c.req.param("etapaId"));
		if (!Number.isInteger(projetoId) || !Number.isInteger(etapaId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const resultado = await c.env.DB.prepare("DELETE FROM projeto_etapas WHERE id = ? AND projeto_id = ?")
			.bind(etapaId, projetoId)
			.run();

		if (resultado.meta.changes === 0) {
			return c.json({ error: "etapa não encontrada" }, 404);
		}

		const progresso = await sincronizarProgresso(c.env.DB, projetoId);

		return c.json({ ok: true, progresso });
	},
);

// Histórico de andamento (timeline interna do projeto). Visualizar segue a
// mesma régua de "ver o projeto" (qualquer autenticado) — a distinção
// interno/visível-ao-cliente é só um campo retornado, não um filtro de
// quem pode VER a lista completa aqui dentro (o filtro real acontece do
// lado do Portal do Cliente, em worker/portal, que só usa
// visivel_cliente = 1). Criar segue a régua de "editar projeto".
projetos.get("/:id/atualizacoes", withSession, requireAuth, async (c) => {
	const projetoId = Number(c.req.param("id"));
	if (!Number.isInteger(projetoId) || projetoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const { results } = await c.env.DB.prepare(
		`SELECT a.id, a.projeto_id, a.etapa_id, a.titulo, a.descricao, a.tipo, a.visivel_cliente, a.criado_em,
		        u.nome AS criado_por_nome, e.nome AS etapa_nome
		 FROM projeto_atualizacoes a
		 JOIN usuarios u ON u.id = a.criado_por_id
		 LEFT JOIN projeto_etapas e ON e.id = a.etapa_id
		 WHERE a.projeto_id = ?
		 ORDER BY a.criado_em DESC, a.id DESC`,
	)
		.bind(projetoId)
		.all();

	return c.json({ atualizacoes: results });
});

projetos.post(
	"/:id/atualizacoes",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor", "colaborador"),
	async (c) => {
		const projetoId = Number(c.req.param("id"));
		if (!Number.isInteger(projetoId) || projetoId <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const projeto = await c.env.DB.prepare("SELECT id FROM projetos WHERE id = ?").bind(projetoId).first();
		if (!projeto) {
			return c.json({ error: "projeto não encontrado" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = criarAtualizacaoSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}
		const dados = parsed.data;

		if (dados.etapa_id) {
			const etapa = await c.env.DB.prepare("SELECT id FROM projeto_etapas WHERE id = ? AND projeto_id = ?")
				.bind(dados.etapa_id, projetoId)
				.first();
			if (!etapa) {
				return c.json({ error: "etapa não encontrada neste projeto" }, 400);
			}
		}

		const atual = c.get("user")!;
		const resultado = await c.env.DB.prepare(
			`INSERT INTO projeto_atualizacoes (projeto_id, etapa_id, titulo, descricao, tipo, visivel_cliente, criado_por_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 RETURNING id`,
		)
			.bind(
				projetoId,
				dados.etapa_id ?? null,
				dados.titulo,
				dados.descricao,
				dados.tipo ?? "geral",
				dados.visivel_cliente ? 1 : 0,
				atual.id,
			)
			.first<{ id: number }>();

		const atualizacao = await c.env.DB.prepare(
			`SELECT a.id, a.projeto_id, a.etapa_id, a.titulo, a.descricao, a.tipo, a.visivel_cliente, a.criado_em,
			        u.nome AS criado_por_nome, e.nome AS etapa_nome
			 FROM projeto_atualizacoes a
			 JOIN usuarios u ON u.id = a.criado_por_id
			 LEFT JOIN projeto_etapas e ON e.id = a.etapa_id
			 WHERE a.id = ?`,
		)
			.bind(resultado!.id)
			.first();

		return c.json({ atualizacao }, 201);
	},
);

// Tarefas do projeto. Mesma régua de permissão das etapas: ver = qualquer
// autenticado; criar/editar/mudar status/responsável/prazo = administrador,
// gestor ou colaborador; excluir = administrador ou gestor (ação
// estrutural, não apenas operacional do dia a dia).
projetos.get("/:id/tarefas", withSession, requireAuth, async (c) => {
	const projetoId = Number(c.req.param("id"));
	if (!Number.isInteger(projetoId) || projetoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const { results } = await c.env.DB.prepare(`${SELECT_TAREFA} WHERE t.projeto_id = ? ORDER BY t.etapa_id, t.ordem, t.id`)
		.bind(projetoId)
		.all();

	return c.json({ tarefas: results });
});

projetos.post(
	"/:id/etapas/:etapaId/tarefas",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor", "colaborador"),
	async (c) => {
		const projetoId = Number(c.req.param("id"));
		const etapaId = Number(c.req.param("etapaId"));
		if (!Number.isInteger(projetoId) || !Number.isInteger(etapaId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const etapa = await c.env.DB.prepare("SELECT id, nome FROM projeto_etapas WHERE id = ? AND projeto_id = ?")
			.bind(etapaId, projetoId)
			.first<{ id: number; nome: string }>();
		if (!etapa) {
			return c.json({ error: "etapa não encontrada neste projeto" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = criarTarefaSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}
		const dados = parsed.data;

		if (dados.responsavel_id) {
			const usuario = await c.env.DB.prepare("SELECT id FROM usuarios WHERE id = ?").bind(dados.responsavel_id).first();
			if (!usuario) {
				return c.json({ error: "responsável não encontrado" }, 400);
			}
		}

		let ordem = dados.ordem;
		if (ordem === undefined) {
			const maxOrdem = await c.env.DB.prepare(
				"SELECT COALESCE(MAX(ordem), -1) AS maximo FROM projeto_tarefas WHERE etapa_id = ?",
			)
				.bind(etapaId)
				.first<{ maximo: number }>();
			ordem = (maxOrdem?.maximo ?? -1) + 1;
		}

		const status = dados.status ?? "pendente";
		const dataConclusao = status === "concluida" ? new Date().toISOString().slice(0, 10) : null;
		const visivelCliente = dados.visivel_cliente === undefined ? 1 : dados.visivel_cliente ? 1 : 0;

		const resultado = await c.env.DB.prepare(
			`INSERT INTO projeto_tarefas (
				projeto_id, etapa_id, nome, descricao, ordem, status, prioridade,
				responsavel_id, data_inicio, prazo, data_conclusao, visivel_cliente
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING id`,
		)
			.bind(
				projetoId,
				etapaId,
				dados.nome,
				dados.descricao,
				ordem,
				status,
				dados.prioridade ?? "normal",
				dados.responsavel_id ?? null,
				dados.data_inicio,
				dados.prazo,
				dataConclusao,
				visivelCliente,
			)
			.first<{ id: number }>();

		const progresso = await sincronizarProgresso(c.env.DB, projetoId);

		await registrarEvento(c.env.DB, {
			projetoId,
			tipo: "etapa",
			tipoEvento: "tarefa_criada",
			entidadeTipo: "tarefa",
			entidadeId: resultado!.id,
			etapaId,
			titulo: `Tarefa "${dados.nome}" criada em "${etapa.nome}"`,
			usuarioId: c.get("user")!.id,
			visivelCliente: false,
		});

		const tarefa = await c.env.DB.prepare(`${SELECT_TAREFA} WHERE t.id = ?`).bind(resultado!.id).first();

		return c.json({ tarefa, progresso }, 201);
	},
);

projetos.patch(
	"/:id/tarefas/:tarefaId",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor", "colaborador"),
	async (c) => {
		const projetoId = Number(c.req.param("id"));
		const tarefaId = Number(c.req.param("tarefaId"));
		if (!Number.isInteger(projetoId) || !Number.isInteger(tarefaId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const existente = await c.env.DB.prepare(
			"SELECT nome, status, prazo, responsavel_id, etapa_id FROM projeto_tarefas WHERE id = ? AND projeto_id = ?",
		)
			.bind(tarefaId, projetoId)
			.first<{ nome: string; status: string; prazo: string | null; responsavel_id: number | null; etapa_id: number }>();
		if (!existente) {
			return c.json({ error: "tarefa não encontrada" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = patchTarefaSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}

		if (parsed.data.responsavel_id) {
			const usuario = await c.env.DB.prepare("SELECT id FROM usuarios WHERE id = ?").bind(parsed.data.responsavel_id).first();
			if (!usuario) {
				return c.json({ error: "responsável não encontrado" }, 400);
			}
		}

		const dados: Record<string, unknown> = { ...parsed.data };
		if (typeof dados.visivel_cliente === "boolean") {
			dados.visivel_cliente = dados.visivel_cliente ? 1 : 0;
		}

		let eventoStatus: "tarefa_concluida" | "tarefa_reaberta" | null = null;
		if (typeof dados.status === "string") {
			if (dados.status === "concluida" && existente.status !== "concluida") {
				dados.data_conclusao = new Date().toISOString().slice(0, 10);
				eventoStatus = "tarefa_concluida";
			} else if (dados.status !== "concluida" && existente.status === "concluida") {
				dados.data_conclusao = null;
				eventoStatus = "tarefa_reaberta";
			}
		}
		const prazoAlterado = typeof dados.prazo !== "undefined" && dados.prazo !== existente.prazo;
		const responsavelAlterado =
			typeof dados.responsavel_id !== "undefined" && dados.responsavel_id !== existente.responsavel_id;

		const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
		const valores: unknown[] = [];
		for (const [campo, valor] of Object.entries(dados)) {
			campos.push(`${campo} = ?`);
			valores.push(valor);
		}

		await c.env.DB.prepare(`UPDATE projeto_tarefas SET ${campos.join(", ")} WHERE id = ?`)
			.bind(...valores, tarefaId)
			.run();

		const progresso = await sincronizarProgresso(c.env.DB, projetoId);

		const atual = c.get("user")!;
		const etapaId = existente.etapa_id;
		if (eventoStatus === "tarefa_concluida") {
			await registrarEvento(c.env.DB, {
				projetoId,
				tipo: "etapa",
				tipoEvento: "tarefa_concluida",
				entidadeTipo: "tarefa",
				entidadeId: tarefaId,
				etapaId,
				titulo: `Tarefa "${existente.nome}" concluída`,
				usuarioId: atual.id,
				visivelCliente: true,
			});
		} else if (eventoStatus === "tarefa_reaberta") {
			await registrarEvento(c.env.DB, {
				projetoId,
				tipo: "etapa",
				tipoEvento: "tarefa_reaberta",
				entidadeTipo: "tarefa",
				entidadeId: tarefaId,
				etapaId,
				titulo: `Tarefa "${existente.nome}" reaberta`,
				usuarioId: atual.id,
				visivelCliente: false,
			});
		}
		if (prazoAlterado) {
			await registrarEvento(c.env.DB, {
				projetoId,
				tipo: "sistema",
				tipoEvento: "prazo_alterado",
				entidadeTipo: "tarefa",
				entidadeId: tarefaId,
				etapaId,
				titulo: `Prazo da tarefa "${existente.nome}" alterado`,
				usuarioId: atual.id,
				visivelCliente: false,
			});
		}
		if (responsavelAlterado) {
			await registrarEvento(c.env.DB, {
				projetoId,
				tipo: "sistema",
				tipoEvento: "responsavel_alterado",
				entidadeTipo: "tarefa",
				entidadeId: tarefaId,
				etapaId,
				titulo: `Responsável da tarefa "${existente.nome}" alterado`,
				usuarioId: atual.id,
				visivelCliente: false,
			});
		}

		const tarefa = await c.env.DB.prepare(`${SELECT_TAREFA} WHERE t.id = ?`).bind(tarefaId).first();

		return c.json({ tarefa, progresso });
	},
);

projetos.delete(
	"/:id/tarefas/:tarefaId",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const projetoId = Number(c.req.param("id"));
		const tarefaId = Number(c.req.param("tarefaId"));
		if (!Number.isInteger(projetoId) || !Number.isInteger(tarefaId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const resultado = await c.env.DB.prepare("DELETE FROM projeto_tarefas WHERE id = ? AND projeto_id = ?")
			.bind(tarefaId, projetoId)
			.run();

		if (resultado.meta.changes === 0) {
			return c.json({ error: "tarefa não encontrada" }, 404);
		}

		const progresso = await sincronizarProgresso(c.env.DB, projetoId);

		return c.json({ ok: true, progresso });
	},
);

// "Adicionar estrutura de um Tipo de Serviço" — anexa etapas/tarefas de um
// tipo já vinculado ao projeto (mas ainda não gerado) depois da criação.
// Mesma régua de "criar etapa" (colaborador incluso).
projetos.get("/:id/tipos-servico-disponiveis", withSession, requireAuth, async (c) => {
	const projetoId = Number(c.req.param("id"));
	if (!Number.isInteger(projetoId) || projetoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const disponiveis = await tiposServicoDisponiveisParaGerar(c.env.DB, projetoId);

	return c.json({ tiposServicoDisponiveis: disponiveis });
});

projetos.post(
	"/:id/gerar-estrutura",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor", "colaborador"),
	async (c) => {
		const projetoId = Number(c.req.param("id"));
		if (!Number.isInteger(projetoId) || projetoId <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const projeto = await c.env.DB.prepare("SELECT id, data_inicio FROM projetos WHERE id = ?")
			.bind(projetoId)
			.first<{ id: number; data_inicio: string | null }>();
		if (!projeto) {
			return c.json({ error: "projeto não encontrado" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = gerarEstruturaSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}

		const vinculado = await c.env.DB.prepare(
			"SELECT 1 FROM projeto_tipos_servico WHERE projeto_id = ? AND tipo_servico_id = ?",
		)
			.bind(projetoId, parsed.data.tipo_servico_id)
			.first();
		if (!vinculado) {
			return c.json({ error: "este tipo de serviço não está vinculado ao projeto" }, 400);
		}

		const resultado = await adicionarEstruturaTipoServico(c.env.DB, projetoId, parsed.data.tipo_servico_id, projeto.data_inicio);
		if (!resultado.ok) {
			return c.json({ error: resultado.error }, 409);
		}

		const progresso = await sincronizarProgresso(c.env.DB, projetoId);
		const { results: etapas } = await c.env.DB.prepare(`${SELECT_ETAPA} WHERE projeto_id = ? ORDER BY ordem, id`)
			.bind(projetoId)
			.all();

		return c.json({ ok: true, etapasGeradas: resultado.etapasGeradas, progresso, etapas });
	},
);

export default projetos;

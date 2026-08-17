import { Hono } from "hono";
import { z } from "zod";
import { hashPassword } from "../auth/hash";
import { requireAuth, requireRole, withSession, type AuthEnv } from "../auth/middleware";

const TIPOS = ["PF", "PJ"] as const;
const STATUS = ["lead", "ativo", "inativo"] as const;

// Campos opcionais em texto: string vazia normaliza para NULL, para não
// gravar "" em colunas que a UI trata como "não preenchido".
const textoOpcional = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.nullable()
		.transform((v) => (v ? v : null));

const camposCliente = {
	tipo: z.enum(TIPOS),
	nome: z.string().trim().min(1).max(200),
	nome_fantasia: textoOpcional(200),
	documento: textoOpcional(20),
	email: textoOpcional(254),
	telefone: textoOpcional(30),
	whatsapp: textoOpcional(30),
	cep: textoOpcional(10),
	logradouro: textoOpcional(200),
	numero: textoOpcional(20),
	complemento: textoOpcional(100),
	bairro: textoOpcional(100),
	cidade: textoOpcional(100),
	estado: textoOpcional(2),
	status: z.enum(STATUS).optional(),
	origem: textoOpcional(100),
	responsavel_interno_id: z.number().int().positive().optional().nullable(),
	observacoes: textoOpcional(2000),
};

const criarClienteSchema = z.object(camposCliente);

const patchClienteSchema = z
	.object(camposCliente)
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

/**
 * Normaliza documento (CPF/CNPJ) para dígitos apenas. Não valida dígito
 * verificador — só o formato básico (11 ou 14 dígitos), suficiente para
 * evitar lixo óbvio sem travar o cadastro rápido de um cliente.
 */
function normalizarDocumento(input: string | null): { documento: string | null } | { error: string } {
	if (!input) return { documento: null };
	const digitos = input.replace(/\D/g, "");
	if (digitos.length === 0) return { documento: null };
	if (digitos.length !== 11 && digitos.length !== 14) {
		return { error: "CPF deve ter 11 dígitos e CNPJ 14 dígitos" };
	}
	return { documento: digitos };
}

const SELECT_LISTA = `
	SELECT c.id, c.tipo, c.nome, c.nome_fantasia, c.documento, c.email, c.telefone, c.whatsapp,
	       c.cidade, c.estado, c.status, c.origem, c.responsavel_interno_id, u.nome AS responsavel_interno_nome,
	       c.criado_em, c.atualizado_em
	FROM clientes c
	LEFT JOIN usuarios u ON u.id = c.responsavel_interno_id
`;

const SELECT_DETALHE = `
	SELECT c.*, u.nome AS responsavel_interno_nome
	FROM clientes c
	LEFT JOIN usuarios u ON u.id = c.responsavel_interno_id
	WHERE c.id = ?
`;

const clientes = new Hono<AuthEnv>();

// Visualizar clientes é permitido a qualquer usuário autenticado
// (inclusive perfil "visualizador") — só criar/editar exige perfil mais
// alto, aplicado individualmente abaixo.
clientes.get("/", withSession, requireAuth, async (c) => {
	const status = c.req.query("status");
	const tipo = c.req.query("tipo");
	const q = c.req.query("q")?.trim();

	const condicoes: string[] = [];
	const valores: unknown[] = [];

	if (status && (STATUS as readonly string[]).includes(status)) {
		condicoes.push("c.status = ?");
		valores.push(status);
	}
	if (tipo && (TIPOS as readonly string[]).includes(tipo)) {
		condicoes.push("c.tipo = ?");
		valores.push(tipo);
	}
	if (q) {
		condicoes.push("(c.nome LIKE ? OR c.nome_fantasia LIKE ? OR c.documento LIKE ?)");
		const termo = `%${q}%`;
		valores.push(termo, termo, termo);
	}

	const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
	const { results } = await c.env.DB.prepare(`${SELECT_LISTA} ${where} ORDER BY c.nome`)
		.bind(...valores)
		.all();

	return c.json({ clientes: results });
});

clientes.get("/:id", withSession, requireAuth, async (c) => {
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const cliente = await c.env.DB.prepare(SELECT_DETALHE).bind(id).first();
	if (!cliente) {
		return c.json({ error: "cliente não encontrado" }, 404);
	}

	const { results: projetos } = await c.env.DB.prepare(
		`SELECT p.id, p.codigo, p.nome, p.status, p.prioridade, p.progresso, p.prazo_previsto, u.nome AS gerente_nome
		 FROM projetos p
		 LEFT JOIN usuarios u ON u.id = p.gerente_id
		 WHERE p.cliente_id = ?
		 ORDER BY p.criado_em DESC`,
	)
		.bind(id)
		.all();

	return c.json({ cliente, projetos });
});

clientes.post("/", withSession, requireAuth, requireRole("administrador", "gestor", "colaborador"), async (c) => {
	const body = await c.req.json().catch(() => null);
	const parsed = criarClienteSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}

	const documentoResultado = normalizarDocumento(parsed.data.documento);
	if ("error" in documentoResultado) {
		return c.json({ error: documentoResultado.error }, 400);
	}

	const dados = { ...parsed.data, documento: documentoResultado.documento, status: parsed.data.status ?? "lead" };

	let novoId: number;
	try {
		const resultado = await c.env.DB.prepare(
			`INSERT INTO clientes (
				tipo, nome, nome_fantasia, documento, email, telefone, whatsapp,
				cep, logradouro, numero, complemento, bairro, cidade, estado,
				status, origem, responsavel_interno_id, observacoes
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			RETURNING id`,
		)
			.bind(
				dados.tipo,
				dados.nome,
				dados.nome_fantasia,
				dados.documento,
				dados.email,
				dados.telefone,
				dados.whatsapp,
				dados.cep,
				dados.logradouro,
				dados.numero,
				dados.complemento,
				dados.bairro,
				dados.cidade,
				dados.estado,
				dados.status,
				dados.origem,
				dados.responsavel_interno_id ?? null,
				dados.observacoes,
			)
			.first<{ id: number }>();
		if (!resultado) throw new Error("insert sem retorno");
		novoId = resultado.id;
	} catch {
		return c.json({ error: "já existe um cliente com este CPF/CNPJ" }, 409);
	}

	const criado = await c.env.DB.prepare(SELECT_DETALHE).bind(novoId).first();
	return c.json({ cliente: criado }, 201);
});

clientes.patch("/:id", withSession, requireAuth, requireRole("administrador", "gestor", "colaborador"), async (c) => {
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const existente = await c.env.DB.prepare("SELECT id FROM clientes WHERE id = ?").bind(id).first();
	if (!existente) {
		return c.json({ error: "cliente não encontrado" }, 404);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = patchClienteSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}

	const dados: Record<string, unknown> = { ...parsed.data };
	if ("documento" in dados) {
		const documentoResultado = normalizarDocumento(dados.documento as string | null);
		if ("error" in documentoResultado) {
			return c.json({ error: documentoResultado.error }, 400);
		}
		dados.documento = documentoResultado.documento;
	}

	const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
	const valores: unknown[] = [];
	for (const [campo, valor] of Object.entries(dados)) {
		campos.push(`${campo} = ?`);
		valores.push(valor);
	}

	try {
		await c.env.DB.prepare(`UPDATE clientes SET ${campos.join(", ")} WHERE id = ?`)
			.bind(...valores, id)
			.run();
	} catch {
		return c.json({ error: "não foi possível atualizar (CPF/CNPJ já em uso?)" }, 409);
	}

	const atualizado = await c.env.DB.prepare(SELECT_DETALHE).bind(id).first();
	return c.json({ cliente: atualizado });
});

// =====================================================================
// Acessos externos (Portal do Cliente) — cliente_contatos + processos
// autorizados. Gerenciar quem tem acesso é uma ação administrativa da
// mesma régua de "gerenciar equipe do projeto": administrador ou gestor.
// Nunca concede acesso a todos os projetos do cliente automaticamente —
// cada processo precisa ser marcado explicitamente para cada contato.
// =====================================================================

const criarContatoSchema = z.object({
	nome: z.string().trim().min(1).max(200),
	email: z.string().trim().toLowerCase().min(1).max(254).email(),
	telefone: textoOpcional(30),
	senha: z.string().min(8).max(200).optional(),
	ativo: z.boolean().optional().default(true),
});

const patchContatoSchema = z
	.object({
		nome: z.string().trim().min(1).max(200).optional(),
		email: z.string().trim().toLowerCase().min(1).max(254).email().optional(),
		telefone: textoOpcional(30),
		senha: z.string().min(8).max(200).optional(),
		ativo: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const processosAutorizadosSchema = z.object({
	projeto_ids: z.array(z.number().int().positive()),
});

// "possui_acesso" é derivado (nunca uma coluna própria): um contato só
// consegue entrar no Portal se tiver senha_hash definida — a senha em si
// nunca é retornada pela API.
const SELECT_CONTATO =
	"SELECT id, cliente_id, nome, email, telefone, ativo, (senha_hash IS NOT NULL) AS possui_acesso, ultimo_login_em, criado_em, atualizado_em FROM cliente_contatos";

clientes.get(
	"/:id/contatos",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const clienteId = Number(c.req.param("id"));
		if (!Number.isInteger(clienteId) || clienteId <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const { results } = await c.env.DB.prepare(`${SELECT_CONTATO} WHERE cliente_id = ? ORDER BY nome`)
			.bind(clienteId)
			.all();

		return c.json({ contatos: results });
	},
);

clientes.post(
	"/:id/contatos",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const clienteId = Number(c.req.param("id"));
		if (!Number.isInteger(clienteId) || clienteId <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const cliente = await c.env.DB.prepare("SELECT id FROM clientes WHERE id = ?").bind(clienteId).first();
		if (!cliente) {
			return c.json({ error: "cliente não encontrado" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = criarContatoSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}
		const dados = parsed.data;

		const senhaHash = dados.senha ? await hashPassword(dados.senha) : null;

		let novoId: number;
		try {
			const resultado = await c.env.DB.prepare(
				"INSERT INTO cliente_contatos (cliente_id, nome, email, telefone, senha_hash, ativo) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
			)
				.bind(clienteId, dados.nome, dados.email, dados.telefone, senhaHash, dados.ativo ? 1 : 0)
				.first<{ id: number }>();
			if (!resultado) throw new Error("insert sem retorno");
			novoId = resultado.id;
		} catch {
			return c.json({ error: "já existe um contato com este e-mail" }, 409);
		}

		const criado = await c.env.DB.prepare(`${SELECT_CONTATO} WHERE id = ?`).bind(novoId).first();
		return c.json({ contato: criado }, 201);
	},
);

clientes.patch(
	"/:id/contatos/:contatoId",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const clienteId = Number(c.req.param("id"));
		const contatoId = Number(c.req.param("contatoId"));
		if (!Number.isInteger(clienteId) || !Number.isInteger(contatoId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const existente = await c.env.DB.prepare("SELECT id FROM cliente_contatos WHERE id = ? AND cliente_id = ?")
			.bind(contatoId, clienteId)
			.first();
		if (!existente) {
			return c.json({ error: "contato não encontrado" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = patchContatoSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}

		const { senha, ...resto } = parsed.data;
		const dados: Record<string, unknown> = { ...resto };
		if ("ativo" in dados) {
			dados.ativo = dados.ativo ? 1 : 0;
		}
		if (senha) {
			dados.senha_hash = await hashPassword(senha);
		}

		const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
		const valores: unknown[] = [];
		for (const [campo, valor] of Object.entries(dados)) {
			campos.push(`${campo} = ?`);
			valores.push(valor);
		}

		try {
			await c.env.DB.prepare(`UPDATE cliente_contatos SET ${campos.join(", ")} WHERE id = ?`)
				.bind(...valores, contatoId)
				.run();
		} catch {
			return c.json({ error: "não foi possível atualizar (e-mail já em uso?)" }, 409);
		}

		const atualizado = await c.env.DB.prepare(`${SELECT_CONTATO} WHERE id = ?`).bind(contatoId).first();
		return c.json({ contato: atualizado });
	},
);

// Remover é seguro: cliente_contato_processos e sessoes_portal têm
// ON DELETE CASCADE a partir de contato_id (migration 0014) — nenhuma
// linha órfã fica para trás, e a pessoa perde o acesso ao Portal
// imediatamente junto com o registro.
clientes.delete(
	"/:id/contatos/:contatoId",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const clienteId = Number(c.req.param("id"));
		const contatoId = Number(c.req.param("contatoId"));
		if (!Number.isInteger(clienteId) || !Number.isInteger(contatoId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const resultado = await c.env.DB.prepare("DELETE FROM cliente_contatos WHERE id = ? AND cliente_id = ?")
			.bind(contatoId, clienteId)
			.run();

		if (resultado.meta.changes === 0) {
			return c.json({ error: "contato não encontrado" }, 404);
		}

		return c.json({ ok: true });
	},
);

clientes.get(
	"/:id/contatos/:contatoId/processos",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const clienteId = Number(c.req.param("id"));
		const contatoId = Number(c.req.param("contatoId"));
		if (!Number.isInteger(clienteId) || !Number.isInteger(contatoId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const contato = await c.env.DB.prepare("SELECT id FROM cliente_contatos WHERE id = ? AND cliente_id = ?")
			.bind(contatoId, clienteId)
			.first();
		if (!contato) {
			return c.json({ error: "contato não encontrado" }, 404);
		}

		// Só projetos DESTE cliente entram na lista de opções — não faz
		// sentido autorizar um contato de um cliente a ver o processo de outro.
		const { results } = await c.env.DB.prepare(
			`SELECT p.id, p.codigo, p.nome, p.status,
			        (ccp.projeto_id IS NOT NULL) AS autorizado
			 FROM projetos p
			 LEFT JOIN cliente_contato_processos ccp ON ccp.projeto_id = p.id AND ccp.contato_id = ?
			 WHERE p.cliente_id = ?
			 ORDER BY p.criado_em DESC`,
		)
			.bind(contatoId, clienteId)
			.all();

		return c.json({ processos: results });
	},
);

clientes.put(
	"/:id/contatos/:contatoId/processos",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const clienteId = Number(c.req.param("id"));
		const contatoId = Number(c.req.param("contatoId"));
		if (!Number.isInteger(clienteId) || !Number.isInteger(contatoId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const contato = await c.env.DB.prepare("SELECT id FROM cliente_contatos WHERE id = ? AND cliente_id = ?")
			.bind(contatoId, clienteId)
			.first();
		if (!contato) {
			return c.json({ error: "contato não encontrado" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = processosAutorizadosSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}

		// Filtra para só os ids que de fato pertencem a este cliente — o
		// caller não pode conceder acesso a um projeto de outro cliente só
		// por enviar o id no corpo da requisição.
		const { results: validos } = await c.env.DB.prepare(
			`SELECT id FROM projetos WHERE cliente_id = ? AND id IN (${parsed.data.projeto_ids.map(() => "?").join(",") || "NULL"})`,
		)
			.bind(clienteId, ...parsed.data.projeto_ids)
			.all<{ id: number }>();

		await c.env.DB.prepare("DELETE FROM cliente_contato_processos WHERE contato_id = ?").bind(contatoId).run();
		for (const { id: projetoId } of validos) {
			await c.env.DB.prepare("INSERT INTO cliente_contato_processos (contato_id, projeto_id) VALUES (?, ?)")
				.bind(contatoId, projetoId)
				.run();
		}

		return c.json({ ok: true, autorizados: validos.map((v) => v.id) });
	},
);

export default clientes;

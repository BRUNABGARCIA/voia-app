import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole, withSession, type AuthEnv } from "../auth/middleware";

// Financeiro do Parceiro ("Meus Recebimentos") — migration 0023.
//
// Regra central (nunca violada por nenhuma rota deste módulo):
//   - ADMIN/GESTOR: cria/edita remuneração, programa/confirma/cancela
//     pagamento, vê remuneração de qualquer parceiro.
//   - PARCEIRO: só lê (nunca cria/edita remuneração, nunca cria/confirma
//     pagamento), e SEMPRE escopado a parceiro_id = usuário da sessão —
//     nunca aceito do corpo/query da requisição.
//
// Nenhuma query deste arquivo toca projetos.valor_contratado, nem em
// JOIN nem em SELECT — o saldo do Parceiro é sempre calculado só a partir
// de projeto_parceiro_remuneracoes/projeto_parceiro_pagamentos. Não existe
// coluna de "valor-base" na tabela de remunerações (ver comentário da
// migration 0023): mesmo que quisesse, o admin não tem onde persistir um
// valor-base comercial aqui para ele escapar para o Parceiro.

const TIPOS_REMUNERACAO = [
	"fixo",
	"percentual",
	"por_etapa",
	"por_entrega",
	"bonus",
	"adiantamento",
	"reembolso",
] as const;

const STATUS_PAGAMENTO = ["pendente", "programado", "pago", "cancelado"] as const;

const textoOpcional = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.nullable()
		.transform((v) => (v ? v : null));

const criarRemuneracaoSchema = z.object({
	parceiro_id: z.number().int().positive(),
	tipo: z.enum(TIPOS_REMUNERACAO),
	valor_acordado: z.number().int().nonnegative(),
	percentual: z.number().nonnegative().max(100).optional().nullable(),
	etapa_id: z.number().int().positive().optional().nullable(),
	referencia_entrega: textoOpcional(500),
});

const patchRemuneracaoSchema = z
	.object({
		tipo: z.enum(TIPOS_REMUNERACAO),
		valor_acordado: z.number().int().nonnegative(),
		percentual: z.number().nonnegative().max(100).optional().nullable(),
		etapa_id: z.number().int().positive().optional().nullable(),
		referencia_entrega: textoOpcional(500),
		ativo: z.boolean(),
	})
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const criarPagamentoSchema = z.object({
	valor: z.number().int().nonnegative(),
	data_programada: textoOpcional(10),
	observacao: textoOpcional(2000),
});

const patchPagamentoSchema = z
	.object({
		valor: z.number().int().nonnegative(),
		data_programada: textoOpcional(10),
		data_pagamento: textoOpcional(10),
		status: z.enum(STATUS_PAGAMENTO),
		observacao: textoOpcional(2000),
		comprovante_documento_id: z.number().int().positive().optional().nullable(),
	})
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const SELECT_REMUNERACAO_ADMIN = `
	SELECT r.id, r.projeto_id, p.nome AS projeto_nome, r.parceiro_id, u.nome AS parceiro_nome,
	       r.tipo, r.valor_acordado, r.percentual, r.etapa_id, r.referencia_entrega, r.ativo,
	       r.criado_em, r.atualizado_em
	FROM projeto_parceiro_remuneracoes r
	JOIN projetos p ON p.id = r.projeto_id
	JOIN usuarios u ON u.id = r.parceiro_id
`;

// Nunca inclui parceiro_nome nem nenhuma coluna de outro parceiro — esta
// versão só é usada em rotas já escopadas a parceiro_id = sessão.
const SELECT_REMUNERACAO_PARCEIRO = `
	SELECT r.id, r.projeto_id, p.nome AS projeto_nome, r.tipo, r.valor_acordado, r.percentual,
	       r.referencia_entrega, r.ativo, r.criado_em
	FROM projeto_parceiro_remuneracoes r
	JOIN projetos p ON p.id = r.projeto_id
`;

const SELECT_PAGAMENTO = `
	SELECT id, remuneracao_id, valor, data_programada, data_pagamento, status,
	       confirmado_por_id, observacao, comprovante_documento_id, criado_em, atualizado_em
	FROM projeto_parceiro_pagamentos
`;

const financeiro = new Hono<AuthEnv>();

// ---------------------------------------------------------------------
// ADMIN/GESTOR — gestão da remuneração de um projeto
// ---------------------------------------------------------------------

financeiro.get(
	"/projetos/:projetoId/remuneracoes",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const projetoId = Number(c.req.param("projetoId"));
		if (!Number.isInteger(projetoId) || projetoId <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const { results } = await c.env.DB.prepare(`${SELECT_REMUNERACAO_ADMIN} WHERE r.projeto_id = ? ORDER BY r.criado_em DESC`)
			.bind(projetoId)
			.all();

		return c.json({ remuneracoes: results });
	},
);

financeiro.post(
	"/projetos/:projetoId/remuneracoes",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const projetoId = Number(c.req.param("projetoId"));
		if (!Number.isInteger(projetoId) || projetoId <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const projeto = await c.env.DB.prepare("SELECT id FROM projetos WHERE id = ?").bind(projetoId).first();
		if (!projeto) {
			return c.json({ error: "projeto não encontrado" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = criarRemuneracaoSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}
		const dados = parsed.data;

		const parceiro = await c.env.DB.prepare("SELECT id FROM usuarios WHERE id = ?").bind(dados.parceiro_id).first();
		if (!parceiro) {
			return c.json({ error: "parceiro não encontrado" }, 400);
		}

		if (dados.etapa_id) {
			const etapa = await c.env.DB.prepare("SELECT id FROM projeto_etapas WHERE id = ? AND projeto_id = ?")
				.bind(dados.etapa_id, projetoId)
				.first();
			if (!etapa) {
				return c.json({ error: "etapa não encontrada neste projeto" }, 400);
			}
		}

		const resultado = await c.env.DB.prepare(
			`INSERT INTO projeto_parceiro_remuneracoes
				(projeto_id, parceiro_id, tipo, valor_acordado, percentual, etapa_id, referencia_entrega)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 RETURNING id`,
		)
			.bind(
				projetoId,
				dados.parceiro_id,
				dados.tipo,
				dados.valor_acordado,
				dados.percentual ?? null,
				dados.etapa_id ?? null,
				dados.referencia_entrega,
			)
			.first<{ id: number }>();

		const criada = await c.env.DB.prepare(`${SELECT_REMUNERACAO_ADMIN} WHERE r.id = ?`).bind(resultado!.id).first();
		return c.json({ remuneracao: criada }, 201);
	},
);

financeiro.patch(
	"/remuneracoes/:id",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const id = Number(c.req.param("id"));
		if (!Number.isInteger(id) || id <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const existente = await c.env.DB.prepare("SELECT projeto_id FROM projeto_parceiro_remuneracoes WHERE id = ?")
			.bind(id)
			.first<{ projeto_id: number }>();
		if (!existente) {
			return c.json({ error: "remuneração não encontrada" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = patchRemuneracaoSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}

		if (parsed.data.etapa_id) {
			const etapa = await c.env.DB.prepare("SELECT id FROM projeto_etapas WHERE id = ? AND projeto_id = ?")
				.bind(parsed.data.etapa_id, existente.projeto_id)
				.first();
			if (!etapa) {
				return c.json({ error: "etapa não encontrada neste projeto" }, 400);
			}
		}

		const dados: Record<string, unknown> = { ...parsed.data };
		if (typeof dados.ativo === "boolean") {
			dados.ativo = dados.ativo ? 1 : 0;
		}

		const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
		const valores: unknown[] = [];
		for (const [campo, valor] of Object.entries(dados)) {
			campos.push(`${campo} = ?`);
			valores.push(valor);
		}

		await c.env.DB.prepare(`UPDATE projeto_parceiro_remuneracoes SET ${campos.join(", ")} WHERE id = ?`)
			.bind(...valores, id)
			.run();

		const atualizada = await c.env.DB.prepare(`${SELECT_REMUNERACAO_ADMIN} WHERE r.id = ?`).bind(id).first();
		return c.json({ remuneracao: atualizada });
	},
);

financeiro.get(
	"/remuneracoes/:id/pagamentos",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const id = Number(c.req.param("id"));
		if (!Number.isInteger(id) || id <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const remuneracao = await c.env.DB.prepare("SELECT id FROM projeto_parceiro_remuneracoes WHERE id = ?").bind(id).first();
		if (!remuneracao) {
			return c.json({ error: "remuneração não encontrada" }, 404);
		}

		const { results } = await c.env.DB.prepare(`${SELECT_PAGAMENTO} WHERE remuneracao_id = ? ORDER BY criado_em DESC`)
			.bind(id)
			.all();

		return c.json({ pagamentos: results });
	},
);

financeiro.post(
	"/remuneracoes/:id/pagamentos",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const id = Number(c.req.param("id"));
		if (!Number.isInteger(id) || id <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const remuneracao = await c.env.DB.prepare("SELECT id FROM projeto_parceiro_remuneracoes WHERE id = ?").bind(id).first();
		if (!remuneracao) {
			return c.json({ error: "remuneração não encontrada" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = criarPagamentoSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}
		const dados = parsed.data;
		// Nasce "programado" quando já tem data definida, "pendente" quando
		// ainda não — nunca nasce "pago" (confirmar pagamento é uma ação
		// própria, feita via PATCH, nunca na criação).
		const status = dados.data_programada ? "programado" : "pendente";

		const resultado = await c.env.DB.prepare(
			`INSERT INTO projeto_parceiro_pagamentos (remuneracao_id, valor, data_programada, status, observacao)
			 VALUES (?, ?, ?, ?, ?)
			 RETURNING id`,
		)
			.bind(id, dados.valor, dados.data_programada, status, dados.observacao)
			.first<{ id: number }>();

		const criado = await c.env.DB.prepare(`${SELECT_PAGAMENTO} WHERE id = ?`).bind(resultado!.id).first();
		return c.json({ pagamento: criado }, 201);
	},
);

financeiro.patch(
	"/pagamentos/:id",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const id = Number(c.req.param("id"));
		if (!Number.isInteger(id) || id <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const existente = await c.env.DB.prepare("SELECT id, status FROM projeto_parceiro_pagamentos WHERE id = ?")
			.bind(id)
			.first<{ id: number; status: string }>();
		if (!existente) {
			return c.json({ error: "pagamento não encontrado" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = patchPagamentoSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}

		const dados: Record<string, unknown> = { ...parsed.data };
		const atual = c.get("user")!;

		// Confirmar como "pago" é a única transição que grava quem confirmou
		// e a data real de pagamento — sempre administrador/gestor (já
		// garantido pelo requireRole da rota), nunca o próprio parceiro.
		if (dados.status === "pago") {
			dados.data_pagamento = dados.data_pagamento ?? new Date().toISOString().slice(0, 10);
			dados.confirmado_por_id = atual.id;
		}

		const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
		const valores: unknown[] = [];
		for (const [campo, valor] of Object.entries(dados)) {
			campos.push(`${campo} = ?`);
			valores.push(valor);
		}

		await c.env.DB.prepare(`UPDATE projeto_parceiro_pagamentos SET ${campos.join(", ")} WHERE id = ?`)
			.bind(...valores, id)
			.run();

		const atualizado = await c.env.DB.prepare(`${SELECT_PAGAMENTO} WHERE id = ?`).bind(id).first();
		return c.json({ pagamento: atualizado });
	},
);

// Admin/gestor: visão de leitura da remuneração de um parceiro específico
// em todos os projetos — reaproveita a mesma SELECT_REMUNERACAO_ADMIN usada
// na visão por projeto, só trocando o filtro. Usada pelo link "Recebimentos"
// em Equipe e Acessos; nenhuma tabela/rota nova além deste filtro.
financeiro.get(
	"/parceiros/:usuarioId/remuneracoes",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	async (c) => {
		const usuarioId = Number(c.req.param("usuarioId"));
		if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const { results } = await c.env.DB.prepare(
			`${SELECT_REMUNERACAO_ADMIN} WHERE r.parceiro_id = ? ORDER BY r.criado_em DESC`,
		)
			.bind(usuarioId)
			.all();

		return c.json({ remuneracoes: results });
	},
);

// ---------------------------------------------------------------------
// PARCEIRO — "Meus Recebimentos" (sempre escopado a si mesmo)
// ---------------------------------------------------------------------

interface RemuneracaoComSaldo {
	id: number;
	valor_acordado: number;
	total_pago: number;
}

financeiro.get("/meus-recebimentos", withSession, requireAuth, async (c) => {
	const usuarioId = c.get("user")!.id;

	const { results: remuneracoes } = await c.env.DB.prepare(
		`${SELECT_REMUNERACAO_PARCEIRO} WHERE r.parceiro_id = ? AND r.ativo = 1 ORDER BY r.criado_em DESC`,
	)
		.bind(usuarioId)
		.all();

	const { results: saldos } = await c.env.DB.prepare(
		`SELECT r.id, r.valor_acordado,
		        COALESCE((SELECT SUM(pg.valor) FROM projeto_parceiro_pagamentos pg WHERE pg.remuneracao_id = r.id AND pg.status = 'pago'), 0) AS total_pago
		 FROM projeto_parceiro_remuneracoes r
		 WHERE r.parceiro_id = ? AND r.ativo = 1`,
	)
		.bind(usuarioId)
		.all<RemuneracaoComSaldo>();

	const saldoPorRemuneracao = new Map(saldos.map((s) => [s.id, s]));
	const remuneracoesComSaldo = remuneracoes.map((r) => {
		const row = r as Record<string, unknown> & { id: number };
		const saldo = saldoPorRemuneracao.get(row.id);
		const totalPago = saldo?.total_pago ?? 0;
		const valorAcordado = saldo?.valor_acordado ?? 0;
		return { ...row, total_pago: totalPago, saldo_a_receber: valorAcordado - totalPago };
	});

	const resumo = saldos.reduce(
		(acc, s) => ({
			totalAcordado: acc.totalAcordado + s.valor_acordado,
			totalRecebido: acc.totalRecebido + s.total_pago,
			saldoAReceber: acc.saldoAReceber + (s.valor_acordado - s.total_pago),
		}),
		{ totalAcordado: 0, totalRecebido: 0, saldoAReceber: 0 },
	);

	return c.json({ resumo, remuneracoes: remuneracoesComSaldo });
});

financeiro.get("/meus-recebimentos/:id/pagamentos", withSession, requireAuth, async (c) => {
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}
	const usuarioId = c.get("user")!.id;

	// Nunca confia só no :id — sempre confirma que a remuneração é do
	// próprio usuário autenticado antes de listar os pagamentos dela.
	const remuneracao = await c.env.DB.prepare(
		"SELECT id FROM projeto_parceiro_remuneracoes WHERE id = ? AND parceiro_id = ?",
	)
		.bind(id, usuarioId)
		.first();
	if (!remuneracao) {
		return c.json({ error: "remuneração não encontrada" }, 404);
	}

	const { results } = await c.env.DB.prepare(
		`SELECT id, valor, data_programada, data_pagamento, status, observacao, comprovante_documento_id, criado_em
		 FROM projeto_parceiro_pagamentos WHERE remuneracao_id = ? ORDER BY COALESCE(data_programada, criado_em) ASC`,
	)
		.bind(id)
		.all();

	return c.json({ pagamentos: results });
});

export default financeiro;

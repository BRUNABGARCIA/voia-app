import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole, withSession, type AuthEnv } from "../auth/middleware";

// Administração dos MODELOS de processo por Tipo de Serviço (Configurações >
// Tipos de Serviço). Só administrador configura — diferente de
// GET /api/projetos/tipos-servico (leitura pública do catálogo, usada nos
// seletores de Cliente/Projeto), que continua como está.

const textoOpcional = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.nullable()
		.transform((v) => (v ? v : null));

const PRIORIDADES = ["baixa", "normal", "alta", "urgente"] as const;

const camposModelo = {
	nome: z.string().trim().min(1).max(200),
	descricao: textoOpcional(2000),
	ordem: z.number().int().min(0).optional(),
	prazo_dias: z.number().int().min(0).max(3650).optional().nullable(),
	visivel_cliente: z.boolean().optional(),
	notificar_cliente: z.boolean().optional(),
	ativa: z.boolean().optional(),
};

const criarModeloSchema = z.object(camposModelo);

const patchModeloSchema = z
	.object(camposModelo)
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const camposTarefaModelo = {
	nome: z.string().trim().min(1).max(200),
	descricao: textoOpcional(2000),
	ordem: z.number().int().min(0).optional(),
	prazo_dias: z.number().int().min(0).max(3650).optional().nullable(),
	prioridade_padrao: z.enum(PRIORIDADES).optional(),
	responsavel_padrao_id: z.number().int().positive().optional().nullable(),
	visivel_cliente: z.boolean().optional(),
	exige_aprovacao: z.boolean().optional(),
	ativa: z.boolean().optional(),
};

const criarTarefaModeloSchema = z.object(camposTarefaModelo);

const patchTarefaModeloSchema = z
	.object(camposTarefaModelo)
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const SELECT_MODELO = `
	SELECT id, tipo_servico_id, nome, descricao, ordem, prazo_dias, peso, visivel_cliente, notificar_cliente, ativa,
	       criado_em, atualizado_em
	FROM tipo_servico_etapas_modelo
`;

const SELECT_TAREFA_MODELO = `
	SELECT t.id, t.modelo_etapa_id, t.nome, t.descricao, t.ordem, t.prazo_dias, t.prioridade_padrao,
	       t.responsavel_padrao_id, u.nome AS responsavel_padrao_nome, t.visivel_cliente, t.exige_aprovacao, t.ativa,
	       t.criado_em, t.atualizado_em
	FROM tipo_servico_modelo_tarefa t
	LEFT JOIN usuarios u ON u.id = t.responsavel_padrao_id
`;

const tiposServico = new Hono<AuthEnv>();

tiposServico.get("/", withSession, requireAuth, requireRole("administrador"), async (c) => {
	const { results } = await c.env.DB.prepare(
		`SELECT ts.id, ts.nome, ts.ativo, COUNT(m.id) AS total_etapas_modelo
		 FROM tipos_servico ts
		 LEFT JOIN tipo_servico_etapas_modelo m ON m.tipo_servico_id = ts.id
		 GROUP BY ts.id
		 ORDER BY ts.nome`,
	).all();

	return c.json({ tiposServico: results });
});

tiposServico.get("/:id/modelo", withSession, requireAuth, requireRole("administrador"), async (c) => {
	const tipoServicoId = Number(c.req.param("id"));
	if (!Number.isInteger(tipoServicoId) || tipoServicoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const tipo = await c.env.DB.prepare("SELECT id, nome FROM tipos_servico WHERE id = ?").bind(tipoServicoId).first();
	if (!tipo) {
		return c.json({ error: "tipo de serviço não encontrado" }, 404);
	}

	const { results: etapasModelo } = await c.env.DB.prepare(`${SELECT_MODELO} WHERE tipo_servico_id = ? ORDER BY ordem, id`)
		.bind(tipoServicoId)
		.all<{ id: number }>();

	// Busca as tarefas de todas as etapas do modelo em uma única query
	// (em vez de N+1 por etapa) e agrupa em memória antes de anexar.
	const etapaIds = etapasModelo.map((e) => e.id);
	const tarefasPorEtapa = new Map<number, unknown[]>();
	if (etapaIds.length > 0) {
		const placeholders = etapaIds.map(() => "?").join(", ");
		const { results: tarefas } = await c.env.DB.prepare(
			`${SELECT_TAREFA_MODELO} WHERE t.modelo_etapa_id IN (${placeholders}) ORDER BY t.ordem, t.id`,
		)
			.bind(...etapaIds)
			.all<{ modelo_etapa_id: number }>();
		for (const tarefa of tarefas) {
			const lista = tarefasPorEtapa.get(tarefa.modelo_etapa_id) ?? [];
			lista.push(tarefa);
			tarefasPorEtapa.set(tarefa.modelo_etapa_id, lista);
		}
	}

	const etapasComTarefas = etapasModelo.map((etapa) => ({ ...etapa, tarefas: tarefasPorEtapa.get(etapa.id) ?? [] }));

	return c.json({ tipoServico: tipo, etapasModelo: etapasComTarefas });
});

tiposServico.post("/:id/modelo", withSession, requireAuth, requireRole("administrador"), async (c) => {
	const tipoServicoId = Number(c.req.param("id"));
	if (!Number.isInteger(tipoServicoId) || tipoServicoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const tipo = await c.env.DB.prepare("SELECT id FROM tipos_servico WHERE id = ?").bind(tipoServicoId).first();
	if (!tipo) {
		return c.json({ error: "tipo de serviço não encontrado" }, 404);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = criarModeloSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}
	const dados = parsed.data;

	let ordem = dados.ordem;
	if (ordem === undefined) {
		const maxOrdem = await c.env.DB.prepare(
			"SELECT COALESCE(MAX(ordem), -1) AS maximo FROM tipo_servico_etapas_modelo WHERE tipo_servico_id = ?",
		)
			.bind(tipoServicoId)
			.first<{ maximo: number }>();
		ordem = (maxOrdem?.maximo ?? -1) + 1;
	}

	const resultado = await c.env.DB.prepare(
		`INSERT INTO tipo_servico_etapas_modelo (tipo_servico_id, nome, descricao, ordem, prazo_dias, visivel_cliente, notificar_cliente, ativa)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 RETURNING id`,
	)
		.bind(
			tipoServicoId,
			dados.nome,
			dados.descricao,
			ordem,
			dados.prazo_dias ?? null,
			dados.visivel_cliente === false ? 0 : 1,
			dados.notificar_cliente ? 1 : 0,
			dados.ativa === false ? 0 : 1,
		)
		.first<{ id: number }>();

	const etapaModelo = await c.env.DB.prepare(`${SELECT_MODELO} WHERE id = ?`).bind(resultado!.id).first();

	return c.json({ etapaModelo }, 201);
});

tiposServico.patch("/:id/modelo/:etapaModeloId", withSession, requireAuth, requireRole("administrador"), async (c) => {
	const tipoServicoId = Number(c.req.param("id"));
	const etapaModeloId = Number(c.req.param("etapaModeloId"));
	if (!Number.isInteger(tipoServicoId) || !Number.isInteger(etapaModeloId)) {
		return c.json({ error: "id inválido" }, 400);
	}

	const existente = await c.env.DB.prepare(
		"SELECT id FROM tipo_servico_etapas_modelo WHERE id = ? AND tipo_servico_id = ?",
	)
		.bind(etapaModeloId, tipoServicoId)
		.first();
	if (!existente) {
		return c.json({ error: "etapa do modelo não encontrada" }, 404);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = patchModeloSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}

	const dados: Record<string, unknown> = { ...parsed.data };
	if (typeof dados.visivel_cliente === "boolean") {
		dados.visivel_cliente = dados.visivel_cliente ? 1 : 0;
	}
	if (typeof dados.notificar_cliente === "boolean") {
		dados.notificar_cliente = dados.notificar_cliente ? 1 : 0;
	}
	if (typeof dados.ativa === "boolean") {
		dados.ativa = dados.ativa ? 1 : 0;
	}

	const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
	const valores: unknown[] = [];
	for (const [campo, valor] of Object.entries(dados)) {
		campos.push(`${campo} = ?`);
		valores.push(valor);
	}

	await c.env.DB.prepare(`UPDATE tipo_servico_etapas_modelo SET ${campos.join(", ")} WHERE id = ?`)
		.bind(...valores, etapaModeloId)
		.run();

	const etapaModelo = await c.env.DB.prepare(`${SELECT_MODELO} WHERE id = ?`).bind(etapaModeloId).first();

	return c.json({ etapaModelo });
});

tiposServico.delete(
	"/:id/modelo/:etapaModeloId",
	withSession,
	requireAuth,
	requireRole("administrador"),
	async (c) => {
		const tipoServicoId = Number(c.req.param("id"));
		const etapaModeloId = Number(c.req.param("etapaModeloId"));
		if (!Number.isInteger(tipoServicoId) || !Number.isInteger(etapaModeloId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const resultado = await c.env.DB.prepare(
			"DELETE FROM tipo_servico_etapas_modelo WHERE id = ? AND tipo_servico_id = ?",
		)
			.bind(etapaModeloId, tipoServicoId)
			.run();

		if (resultado.meta.changes === 0) {
			return c.json({ error: "etapa do modelo não encontrada" }, 404);
		}

		return c.json({ ok: true });
	},
);

// Tarefas padrão dentro de uma etapa padrão do modelo. Mesma régua
// admin-only das etapas do modelo — o modelo de processo inteiro (etapas +
// tarefas) só é configurado por administrador.
tiposServico.post(
	"/:id/modelo/:etapaModeloId/tarefas",
	withSession,
	requireAuth,
	requireRole("administrador"),
	async (c) => {
		const tipoServicoId = Number(c.req.param("id"));
		const etapaModeloId = Number(c.req.param("etapaModeloId"));
		if (!Number.isInteger(tipoServicoId) || !Number.isInteger(etapaModeloId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const etapaModelo = await c.env.DB.prepare(
			"SELECT id FROM tipo_servico_etapas_modelo WHERE id = ? AND tipo_servico_id = ?",
		)
			.bind(etapaModeloId, tipoServicoId)
			.first();
		if (!etapaModelo) {
			return c.json({ error: "etapa do modelo não encontrada" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = criarTarefaModeloSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}
		const dados = parsed.data;

		if (dados.responsavel_padrao_id) {
			const usuario = await c.env.DB.prepare("SELECT id FROM usuarios WHERE id = ?").bind(dados.responsavel_padrao_id).first();
			if (!usuario) {
				return c.json({ error: "responsável padrão não encontrado" }, 400);
			}
		}

		let ordem = dados.ordem;
		if (ordem === undefined) {
			const maxOrdem = await c.env.DB.prepare(
				"SELECT COALESCE(MAX(ordem), -1) AS maximo FROM tipo_servico_modelo_tarefa WHERE modelo_etapa_id = ?",
			)
				.bind(etapaModeloId)
				.first<{ maximo: number }>();
			ordem = (maxOrdem?.maximo ?? -1) + 1;
		}

		const resultado = await c.env.DB.prepare(
			`INSERT INTO tipo_servico_modelo_tarefa (
				modelo_etapa_id, nome, descricao, ordem, prazo_dias, prioridade_padrao,
				responsavel_padrao_id, visivel_cliente, exige_aprovacao, ativa
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING id`,
		)
			.bind(
				etapaModeloId,
				dados.nome,
				dados.descricao,
				ordem,
				dados.prazo_dias ?? null,
				dados.prioridade_padrao ?? "normal",
				dados.responsavel_padrao_id ?? null,
				dados.visivel_cliente === false ? 0 : 1,
				dados.exige_aprovacao ? 1 : 0,
				dados.ativa === false ? 0 : 1,
			)
			.first<{ id: number }>();

		const tarefaModelo = await c.env.DB.prepare(`${SELECT_TAREFA_MODELO} WHERE t.id = ?`).bind(resultado!.id).first();

		return c.json({ tarefaModelo }, 201);
	},
);

tiposServico.patch(
	"/:id/modelo/:etapaModeloId/tarefas/:tarefaModeloId",
	withSession,
	requireAuth,
	requireRole("administrador"),
	async (c) => {
		const etapaModeloId = Number(c.req.param("etapaModeloId"));
		const tarefaModeloId = Number(c.req.param("tarefaModeloId"));
		if (!Number.isInteger(etapaModeloId) || !Number.isInteger(tarefaModeloId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const existente = await c.env.DB.prepare(
			"SELECT id FROM tipo_servico_modelo_tarefa WHERE id = ? AND modelo_etapa_id = ?",
		)
			.bind(tarefaModeloId, etapaModeloId)
			.first();
		if (!existente) {
			return c.json({ error: "tarefa do modelo não encontrada" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = patchTarefaModeloSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}

		if (parsed.data.responsavel_padrao_id) {
			const usuario = await c.env.DB.prepare("SELECT id FROM usuarios WHERE id = ?")
				.bind(parsed.data.responsavel_padrao_id)
				.first();
			if (!usuario) {
				return c.json({ error: "responsável padrão não encontrado" }, 400);
			}
		}

		const dados: Record<string, unknown> = { ...parsed.data };
		for (const campo of ["visivel_cliente", "exige_aprovacao", "ativa"] as const) {
			if (typeof dados[campo] === "boolean") {
				dados[campo] = dados[campo] ? 1 : 0;
			}
		}

		const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
		const valores: unknown[] = [];
		for (const [campo, valor] of Object.entries(dados)) {
			campos.push(`${campo} = ?`);
			valores.push(valor);
		}

		await c.env.DB.prepare(`UPDATE tipo_servico_modelo_tarefa SET ${campos.join(", ")} WHERE id = ?`)
			.bind(...valores, tarefaModeloId)
			.run();

		const tarefaModelo = await c.env.DB.prepare(`${SELECT_TAREFA_MODELO} WHERE t.id = ?`).bind(tarefaModeloId).first();

		return c.json({ tarefaModelo });
	},
);

tiposServico.delete(
	"/:id/modelo/:etapaModeloId/tarefas/:tarefaModeloId",
	withSession,
	requireAuth,
	requireRole("administrador"),
	async (c) => {
		const etapaModeloId = Number(c.req.param("etapaModeloId"));
		const tarefaModeloId = Number(c.req.param("tarefaModeloId"));
		if (!Number.isInteger(etapaModeloId) || !Number.isInteger(tarefaModeloId)) {
			return c.json({ error: "id inválido" }, 400);
		}

		const resultado = await c.env.DB.prepare(
			"DELETE FROM tipo_servico_modelo_tarefa WHERE id = ? AND modelo_etapa_id = ?",
		)
			.bind(tarefaModeloId, etapaModeloId)
			.run();

		if (resultado.meta.changes === 0) {
			return c.json({ error: "tarefa do modelo não encontrada" }, 404);
		}

		return c.json({ ok: true });
	},
);

export default tiposServico;

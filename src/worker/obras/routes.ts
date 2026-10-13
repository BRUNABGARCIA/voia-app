import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole, withSession, type AuthEnv } from "../auth/middleware";
import { ehParceiro, sqlProjetosDoParceiro } from "../projetos/acesso";
import { registrarEvento } from "../projetos/historico";
import { requireObraAccess, obraEProjetoId } from "./acesso";
import {
	validarArquivo,
	gerarStorageKey,
	salvarArquivo,
	lerArquivo,
	removerArquivo,
	contentDispositionAnexo,
	type ArquivoRecebido,
} from "../storage/documentos";

// Gestão de Obras (Rodada 04) — fundação real: toda obra pertence a um
// projeto já existente (migrations 0025-0028). Equipe reaproveita
// projeto_membros (via requireObraAccess → projetos/acesso.ts); nenhuma
// tabela de permissão própria da obra.

const STATUS_OBRA = ["planejamento", "aguardando_inicio", "em_execucao", "pausada", "concluida", "cancelada"] as const;
const CATEGORIAS_OCORRENCIA = [
	"incompatibilidade", "atraso", "material", "qualidade", "seguranca", "cliente", "projeto", "execucao",
] as const;
const PRIORIDADES_OCORRENCIA = ["baixa", "normal", "alta", "urgente"] as const;
const STATUS_OCORRENCIA = ["aberta", "em_tratamento", "resolvida", "cancelada"] as const;

const textoOpcional = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.nullable()
		.transform((v) => (v ? v : null));

const camposObra = {
	nome: z.string().trim().min(1).max(200),
	endereco: textoOpcional(500),
	responsavel_tecnico_id: z.number().int().positive().optional().nullable(),
	responsavel_operacional_id: z.number().int().positive().optional().nullable(),
	data_inicio_prevista: textoOpcional(10),
	data_fim_prevista: textoOpcional(10),
	data_inicio_real: textoOpcional(10),
	data_fim_real: textoOpcional(10),
	status: z.enum(STATUS_OBRA).optional(),
	progresso: z.number().int().min(0).max(100).optional(),
	observacoes: textoOpcional(2000),
};

const criarObraSchema = z.object({ projeto_id: z.number().int().positive(), ...camposObra });
const patchObraSchema = z
	.object(camposObra)
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const SELECT_OBRA = `
	SELECT o.id, o.projeto_id, p.nome AS projeto_nome, c.nome AS cliente_nome,
	       o.nome, o.endereco, o.responsavel_tecnico_id, ut.nome AS responsavel_tecnico_nome,
	       o.responsavel_operacional_id, uo.nome AS responsavel_operacional_nome,
	       o.data_inicio_prevista, o.data_fim_prevista, o.data_inicio_real, o.data_fim_real,
	       o.status, o.progresso, o.observacoes, o.criado_em, o.atualizado_em,
	       (o.data_fim_prevista IS NOT NULL AND o.data_fim_prevista < date('now') AND o.status NOT IN ('concluida', 'cancelada')) AS atrasada
	FROM obras o
	JOIN projetos p ON p.id = o.projeto_id
	JOIN clientes c ON c.id = p.cliente_id
	LEFT JOIN usuarios ut ON ut.id = o.responsavel_tecnico_id
	LEFT JOIN usuarios uo ON uo.id = o.responsavel_operacional_id
`;

const obras = new Hono<AuthEnv>();

// ---------------------------------------------------------------------
// Obras
// ---------------------------------------------------------------------

obras.get("/", withSession, requireAuth, async (c) => {
	const usuario = c.get("user")!;
	const condicoes: string[] = [];
	const binds: unknown[] = [];

	if (ehParceiro(usuario.perfil)) {
		condicoes.push(sqlProjetosDoParceiro("p", usuario.id));
	}
	const status = c.req.query("status");
	if (status && (STATUS_OBRA as readonly string[]).includes(status)) {
		condicoes.push("o.status = ?");
		binds.push(status);
	}
	const clienteId = Number(c.req.query("cliente_id"));
	if (Number.isInteger(clienteId) && clienteId > 0) {
		condicoes.push("p.cliente_id = ?");
		binds.push(clienteId);
	}
	const projetoId = Number(c.req.query("projeto_id"));
	if (Number.isInteger(projetoId) && projetoId > 0) {
		condicoes.push("o.projeto_id = ?");
		binds.push(projetoId);
	}
	const responsavelId = Number(c.req.query("responsavel_id"));
	if (Number.isInteger(responsavelId) && responsavelId > 0) {
		condicoes.push("(o.responsavel_tecnico_id = ? OR o.responsavel_operacional_id = ?)");
		binds.push(responsavelId, responsavelId);
	}
	const q = c.req.query("q")?.trim();
	if (q) {
		condicoes.push("(o.nome LIKE ? OR p.nome LIKE ? OR c.nome LIKE ?)");
		binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
	}

	const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
	const { results } = await c.env.DB.prepare(`${SELECT_OBRA} ${where} ORDER BY o.criado_em DESC`)
		.bind(...binds)
		.all();

	return c.json({ obras: results });
});

obras.post("/", withSession, requireAuth, requireRole("administrador", "gestor"), async (c) => {
	const body = await c.req.json().catch(() => null);
	const parsed = criarObraSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}
	const dados = parsed.data;

	const projeto = await c.env.DB.prepare("SELECT id FROM projetos WHERE id = ?").bind(dados.projeto_id).first();
	if (!projeto) {
		return c.json({ error: "projeto não encontrado" }, 400);
	}

	const autor = c.get("user")!;
	const resultado = await c.env.DB.prepare(
		`INSERT INTO obras (
			projeto_id, nome, endereco, responsavel_tecnico_id, responsavel_operacional_id,
			data_inicio_prevista, data_fim_prevista, data_inicio_real, data_fim_real,
			status, progresso, observacoes, criado_por_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 RETURNING id`,
	)
		.bind(
			dados.projeto_id,
			dados.nome,
			dados.endereco,
			dados.responsavel_tecnico_id ?? null,
			dados.responsavel_operacional_id ?? null,
			dados.data_inicio_prevista,
			dados.data_fim_prevista,
			dados.data_inicio_real,
			dados.data_fim_real,
			dados.status ?? "planejamento",
			dados.progresso ?? 0,
			dados.observacoes,
			autor.id,
		)
		.first<{ id: number }>();

	await registrarEvento(c.env.DB, {
		projetoId: dados.projeto_id,
		tipo: "sistema",
		tipoEvento: "obra_criada",
		entidadeTipo: "obra",
		entidadeId: resultado!.id,
		titulo: `Obra "${dados.nome}" criada`,
		usuarioId: autor.id,
		visivelCliente: false,
	});

	const obra = await c.env.DB.prepare(`${SELECT_OBRA} WHERE o.id = ?`).bind(resultado!.id).first();
	return c.json({ obra }, 201);
});

obras.get("/:id", withSession, requireAuth, requireObraAccess, async (c) => {
	const obraId = Number(c.req.param("id"));
	const obra = await c.env.DB.prepare(`${SELECT_OBRA} WHERE o.id = ?`).bind(obraId).first();
	return c.json({ obra });
});

obras.patch("/:id", withSession, requireAuth, requireRole("administrador", "gestor"), requireObraAccess, async (c) => {
	const obraId = Number(c.req.param("id"));

	const body = await c.req.json().catch(() => null);
	const parsed = patchObraSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}

	const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
	const valores: unknown[] = [];
	for (const [campo, valor] of Object.entries(parsed.data)) {
		campos.push(`${campo} = ?`);
		valores.push(valor);
	}

	await c.env.DB.prepare(`UPDATE obras SET ${campos.join(", ")} WHERE id = ?`)
		.bind(...valores, obraId)
		.run();

	const obra = await c.env.DB.prepare(`${SELECT_OBRA} WHERE o.id = ?`).bind(obraId).first();
	return c.json({ obra });
});

// ---------------------------------------------------------------------
// Diário de Obra (RDO)
// ---------------------------------------------------------------------

const camposRdo = {
	data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida"),
	condicoes_climaticas: textoOpcional(500),
	mao_de_obra: textoOpcional(2000),
	servicos_executados: textoOpcional(4000),
	equipamentos: textoOpcional(2000),
	materiais: textoOpcional(2000),
	ocorrencias: textoOpcional(2000),
	observacoes: textoOpcional(2000),
};
const criarRdoSchema = z.object(camposRdo);
const patchRdoSchema = z
	.object(camposRdo)
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const SELECT_RDO = `
	SELECT r.id, r.obra_id, r.data, r.criado_por_id, u.nome AS criado_por_nome,
	       r.condicoes_climaticas, r.mao_de_obra, r.servicos_executados, r.equipamentos,
	       r.materiais, r.ocorrencias, r.observacoes, r.criado_em, r.atualizado_em
	FROM obra_rdo r
	LEFT JOIN usuarios u ON u.id = r.criado_por_id
`;

obras.get("/:id/rdo", withSession, requireAuth, requireObraAccess, async (c) => {
	const obraId = Number(c.req.param("id"));
	const { results } = await c.env.DB.prepare(`${SELECT_RDO} WHERE r.obra_id = ? ORDER BY r.data DESC, r.id DESC`)
		.bind(obraId)
		.all();
	return c.json({ rdos: results });
});

obras.post(
	"/:id/rdo",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor", "colaborador"),
	requireObraAccess,
	async (c) => {
		const obraId = Number(c.req.param("id"));
		const body = await c.req.json().catch(() => null);
		const parsed = criarRdoSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}
		const dados = parsed.data;
		const autor = c.get("user")!;

		const resultado = await c.env.DB.prepare(
			`INSERT INTO obra_rdo (
				obra_id, data, criado_por_id, condicoes_climaticas, mao_de_obra,
				servicos_executados, equipamentos, materiais, ocorrencias, observacoes
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING id`,
		)
			.bind(
				obraId,
				dados.data,
				autor.id,
				dados.condicoes_climaticas,
				dados.mao_de_obra,
				dados.servicos_executados,
				dados.equipamentos,
				dados.materiais,
				dados.ocorrencias,
				dados.observacoes,
			)
			.first<{ id: number }>();

		const projetoId = await obraEProjetoId(c.env.DB, obraId);
		if (projetoId !== null) {
			await registrarEvento(c.env.DB, {
				projetoId,
				tipo: "sistema",
				tipoEvento: "rdo_criado",
				entidadeTipo: "rdo",
				entidadeId: resultado!.id,
				titulo: `RDO de ${dados.data} registrado`,
				usuarioId: autor.id,
				visivelCliente: false,
			});
		}

		const rdo = await c.env.DB.prepare(`${SELECT_RDO} WHERE r.id = ?`).bind(resultado!.id).first();
		return c.json({ rdo }, 201);
	},
);

obras.patch(
	"/:id/rdo/:rdoId",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor", "colaborador"),
	requireObraAccess,
	async (c) => {
		const obraId = Number(c.req.param("id"));
		const rdoId = Number(c.req.param("rdoId"));
		if (!Number.isInteger(rdoId) || rdoId <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const existente = await c.env.DB.prepare("SELECT id FROM obra_rdo WHERE id = ? AND obra_id = ?")
			.bind(rdoId, obraId)
			.first();
		if (!existente) {
			return c.json({ error: "RDO não encontrado" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = patchRdoSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}

		const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
		const valores: unknown[] = [];
		for (const [campo, valor] of Object.entries(parsed.data)) {
			campos.push(`${campo} = ?`);
			valores.push(valor);
		}

		await c.env.DB.prepare(`UPDATE obra_rdo SET ${campos.join(", ")} WHERE id = ?`)
			.bind(...valores, rdoId)
			.run();

		const rdo = await c.env.DB.prepare(`${SELECT_RDO} WHERE r.id = ?`).bind(rdoId).first();
		return c.json({ rdo });
	},
);

// ---------------------------------------------------------------------
// Ocorrências / Pendências da Obra
// ---------------------------------------------------------------------

const criarOcorrenciaSchema = z.object({
	titulo: z.string().trim().min(1).max(200),
	descricao: textoOpcional(2000),
	categoria: z.enum(CATEGORIAS_OCORRENCIA).optional(),
	prioridade: z.enum(PRIORIDADES_OCORRENCIA).optional(),
	responsavel_id: z.number().int().positive().optional().nullable(),
	prazo: textoOpcional(10),
});
const patchOcorrenciaSchema = z
	.object({
		titulo: z.string().trim().min(1).max(200),
		descricao: textoOpcional(2000),
		categoria: z.enum(CATEGORIAS_OCORRENCIA),
		prioridade: z.enum(PRIORIDADES_OCORRENCIA),
		status: z.enum(STATUS_OCORRENCIA),
		responsavel_id: z.number().int().positive().optional().nullable(),
		prazo: textoOpcional(10),
	})
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const SELECT_OCORRENCIA = `
	SELECT oc.id, oc.obra_id, oc.titulo, oc.descricao, oc.categoria, oc.prioridade, oc.status,
	       oc.responsavel_id, ur.nome AS responsavel_nome, oc.prazo,
	       oc.criado_por_id, uc.nome AS criado_por_nome, oc.resolvido_em, oc.criado_em, oc.atualizado_em
	FROM obra_ocorrencias oc
	LEFT JOIN usuarios ur ON ur.id = oc.responsavel_id
	LEFT JOIN usuarios uc ON uc.id = oc.criado_por_id
`;

obras.get("/:id/ocorrencias", withSession, requireAuth, requireObraAccess, async (c) => {
	const obraId = Number(c.req.param("id"));
	const status = c.req.query("status");
	const condicoes = ["oc.obra_id = ?"];
	const binds: unknown[] = [obraId];
	if (status && (STATUS_OCORRENCIA as readonly string[]).includes(status)) {
		condicoes.push("oc.status = ?");
		binds.push(status);
	}
	const { results } = await c.env.DB.prepare(
		`${SELECT_OCORRENCIA} WHERE ${condicoes.join(" AND ")} ORDER BY oc.criado_em DESC`,
	)
		.bind(...binds)
		.all();
	return c.json({ ocorrencias: results });
});

obras.post(
	"/:id/ocorrencias",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor", "colaborador"),
	requireObraAccess,
	async (c) => {
		const obraId = Number(c.req.param("id"));
		const body = await c.req.json().catch(() => null);
		const parsed = criarOcorrenciaSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}
		const dados = parsed.data;
		const autor = c.get("user")!;

		const resultado = await c.env.DB.prepare(
			`INSERT INTO obra_ocorrencias (obra_id, titulo, descricao, categoria, prioridade, responsavel_id, prazo, criado_por_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING id`,
		)
			.bind(
				obraId,
				dados.titulo,
				dados.descricao,
				dados.categoria ?? "execucao",
				dados.prioridade ?? "normal",
				dados.responsavel_id ?? null,
				dados.prazo,
				autor.id,
			)
			.first<{ id: number }>();

		const projetoId = await obraEProjetoId(c.env.DB, obraId);
		if (projetoId !== null) {
			await registrarEvento(c.env.DB, {
				projetoId,
				tipo: "sistema",
				tipoEvento: "ocorrencia_aberta",
				entidadeTipo: "ocorrencia",
				entidadeId: resultado!.id,
				titulo: `Ocorrência "${dados.titulo}" aberta`,
				usuarioId: autor.id,
				visivelCliente: false,
			});
		}

		const ocorrencia = await c.env.DB.prepare(`${SELECT_OCORRENCIA} WHERE oc.id = ?`).bind(resultado!.id).first();
		return c.json({ ocorrencia }, 201);
	},
);

obras.patch(
	"/:id/ocorrencias/:ocorrenciaId",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor", "colaborador"),
	requireObraAccess,
	async (c) => {
		const obraId = Number(c.req.param("id"));
		const ocorrenciaId = Number(c.req.param("ocorrenciaId"));
		if (!Number.isInteger(ocorrenciaId) || ocorrenciaId <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const existente = await c.env.DB.prepare("SELECT id, titulo, status FROM obra_ocorrencias WHERE id = ? AND obra_id = ?")
			.bind(ocorrenciaId, obraId)
			.first<{ id: number; titulo: string; status: string }>();
		if (!existente) {
			return c.json({ error: "ocorrência não encontrada" }, 404);
		}

		const body = await c.req.json().catch(() => null);
		const parsed = patchOcorrenciaSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "dados inválidos" }, 400);
		}

		const dados: Record<string, unknown> = { ...parsed.data };
		let resolvida = false;
		if (typeof dados.status === "string") {
			if (dados.status === "resolvida" && existente.status !== "resolvida") {
				dados.resolvido_em = new Date().toISOString().slice(0, 10);
				resolvida = true;
			} else if (dados.status !== "resolvida" && existente.status === "resolvida") {
				dados.resolvido_em = null;
			}
		}

		const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP"];
		const valores: unknown[] = [];
		for (const [campo, valor] of Object.entries(dados)) {
			campos.push(`${campo} = ?`);
			valores.push(valor);
		}

		await c.env.DB.prepare(`UPDATE obra_ocorrencias SET ${campos.join(", ")} WHERE id = ?`)
			.bind(...valores, ocorrenciaId)
			.run();

		if (resolvida) {
			const projetoId = await obraEProjetoId(c.env.DB, obraId);
			if (projetoId !== null) {
				await registrarEvento(c.env.DB, {
					projetoId,
					tipo: "sistema",
					tipoEvento: "ocorrencia_resolvida",
					entidadeTipo: "ocorrencia",
					entidadeId: ocorrenciaId,
					titulo: `Ocorrência "${existente.titulo}" resolvida`,
					usuarioId: c.get("user")!.id,
					visivelCliente: false,
				});
			}
		}

		const ocorrencia = await c.env.DB.prepare(`${SELECT_OCORRENCIA} WHERE oc.id = ?`).bind(ocorrenciaId).first();
		return c.json({ ocorrencia });
	},
);

// ---------------------------------------------------------------------
// Fotos da Obra (R2 — reaproveita DOCUMENTOS_BUCKET)
// ---------------------------------------------------------------------

const EXTENSOES_FOTO = ["jpg", "jpeg", "png"];

const SELECT_FOTO = `
	SELECT f.id, f.obra_id, f.rdo_id, f.legenda, f.data, f.enviado_por_id, u.nome AS enviado_por_nome,
	       f.nome_arquivo_original, f.mime_type, f.tamanho_bytes, f.criado_em
	FROM obra_fotos f
	LEFT JOIN usuarios u ON u.id = f.enviado_por_id
`;

obras.get("/:id/fotos", withSession, requireAuth, requireObraAccess, async (c) => {
	const obraId = Number(c.req.param("id"));
	const { results } = await c.env.DB.prepare(`${SELECT_FOTO} WHERE f.obra_id = ? ORDER BY f.data DESC, f.id DESC`)
		.bind(obraId)
		.all();
	return c.json({ fotos: results });
});

obras.post(
	"/:id/fotos",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor", "colaborador"),
	requireObraAccess,
	async (c) => {
		const obraId = Number(c.req.param("id"));
		const projetoId = await obraEProjetoId(c.env.DB, obraId);
		if (projetoId === null) {
			return c.json({ error: "obra não encontrada" }, 404);
		}

		const form = await c.req.formData().catch(() => null);
		if (!form) {
			return c.json({ error: "formulário inválido" }, 400);
		}
		const arquivo = form.get("arquivo");
		if (!(arquivo instanceof File)) {
			return c.json({ error: "arquivo obrigatório" }, 400);
		}

		const arquivoRecebido: ArquivoRecebido = {
			nomeOriginal: arquivo.name,
			mimeType: arquivo.type,
			tamanho: arquivo.size,
			bytes: await arquivo.arrayBuffer(),
		};

		const validacao = validarArquivo(arquivoRecebido);
		if (!validacao.ok) {
			return c.json({ error: validacao.erro }, 400);
		}
		// Fotos da obra: lista mais restrita que documentos em geral (nunca
		// confia no nome do arquivo — a extensão real já foi confirmada por
		// validarArquivo via assinatura de bytes; aqui só reduzimos o
		// conjunto aceito a formatos de imagem).
		const extensao = arquivoRecebido.nomeOriginal.trim().toLowerCase().split(".").pop() ?? "";
		if (!EXTENSOES_FOTO.includes(extensao)) {
			return c.json({ error: "fotos da obra aceitam apenas JPG ou PNG" }, 400);
		}

		const legenda = form.get("legenda");
		const dataForm = form.get("data");
		const rdoIdForm = form.get("rdo_id");

		let rdoId: number | null = null;
		if (typeof rdoIdForm === "string" && rdoIdForm.trim()) {
			const candidato = Number(rdoIdForm);
			if (!Number.isInteger(candidato) || candidato <= 0) {
				return c.json({ error: "rdo_id inválido" }, 400);
			}
			// Nunca confia no rdo_id enviado sem confirmar que pertence a esta
			// mesma obra — evita amarrar foto a RDO de outra obra/projeto.
			const rdo = await c.env.DB.prepare("SELECT id FROM obra_rdo WHERE id = ? AND obra_id = ?")
				.bind(candidato, obraId)
				.first();
			if (!rdo) {
				return c.json({ error: "RDO não encontrado nesta obra" }, 400);
			}
			rdoId = candidato;
		}

		const storageKey = gerarStorageKey(projetoId, arquivoRecebido.nomeOriginal);
		await salvarArquivo(c.env.DOCUMENTOS_BUCKET, storageKey, arquivoRecebido);

		const autor = c.get("user")!;
		const data = typeof dataForm === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dataForm) ? dataForm : new Date().toISOString().slice(0, 10);

		const resultado = await c.env.DB.prepare(
			`INSERT INTO obra_fotos (obra_id, rdo_id, legenda, data, enviado_por_id, storage_key, nome_arquivo_original, mime_type, tamanho_bytes)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING id`,
		)
			.bind(
				obraId,
				rdoId,
				typeof legenda === "string" && legenda.trim() ? legenda.trim().slice(0, 500) : null,
				data,
				autor.id,
				storageKey,
				arquivoRecebido.nomeOriginal,
				arquivoRecebido.mimeType || null,
				arquivoRecebido.tamanho,
			)
			.first<{ id: number }>();

		const foto = await c.env.DB.prepare(`${SELECT_FOTO} WHERE f.id = ?`).bind(resultado!.id).first();
		return c.json({ foto }, 201);
	},
);

obras.get("/:id/fotos/:fotoId/arquivo", withSession, requireAuth, requireObraAccess, async (c) => {
	const obraId = Number(c.req.param("id"));
	const fotoId = Number(c.req.param("fotoId"));
	if (!Number.isInteger(fotoId) || fotoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	// Sempre reconfirma obra_id junto do fotoId — nunca confia só no :fotoId
	// (defesa em profundidade contra IDOR por troca manual de ID).
	const foto = await c.env.DB.prepare(
		"SELECT storage_key, mime_type, nome_arquivo_original FROM obra_fotos WHERE id = ? AND obra_id = ?",
	)
		.bind(fotoId, obraId)
		.first<{ storage_key: string; mime_type: string | null; nome_arquivo_original: string | null }>();
	if (!foto) {
		return c.json({ error: "foto não encontrada" }, 404);
	}

	const objeto = await lerArquivo(c.env.DOCUMENTOS_BUCKET, foto.storage_key);
	if (!objeto) {
		return c.json({ error: "arquivo não encontrado no armazenamento" }, 404);
	}

	return new Response(objeto.body, {
		headers: {
			"Content-Type": foto.mime_type || "application/octet-stream",
			"Content-Disposition": contentDispositionAnexo(foto.nome_arquivo_original || "foto"),
		},
	});
});

obras.delete(
	"/:id/fotos/:fotoId",
	withSession,
	requireAuth,
	requireRole("administrador", "gestor"),
	requireObraAccess,
	async (c) => {
		const obraId = Number(c.req.param("id"));
		const fotoId = Number(c.req.param("fotoId"));
		if (!Number.isInteger(fotoId) || fotoId <= 0) {
			return c.json({ error: "id inválido" }, 400);
		}

		const foto = await c.env.DB.prepare("SELECT storage_key FROM obra_fotos WHERE id = ? AND obra_id = ?")
			.bind(fotoId, obraId)
			.first<{ storage_key: string }>();
		if (!foto) {
			return c.json({ error: "foto não encontrada" }, 404);
		}

		await c.env.DB.prepare("DELETE FROM obra_fotos WHERE id = ?").bind(fotoId).run();
		await removerArquivo(c.env.DOCUMENTOS_BUCKET, foto.storage_key);

		return c.json({ ok: true });
	},
);

export default obras;

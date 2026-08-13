import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole, withSession, type AuthEnv } from "../auth/middleware";

// Perfis oferecidos nesta etapa (o banco também aceita "engenheiro" e
// "financeiro" por compatibilidade com dados existentes, mas a interface
// de Equipe e Acessos só oferece estes quatro).
const PERFIS_DISPONIVEIS = ["administrador", "gestor", "colaborador", "visualizador"] as const;

const patchUsuarioSchema = z
	.object({
		nome: z.string().trim().min(1).max(200).optional(),
		email: z.string().trim().toLowerCase().min(1).max(254).email().optional(),
		perfil: z.enum(PERFIS_DISPONIVEIS).optional(),
		ativo: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, { message: "nada para atualizar" });

const usuarios = new Hono<AuthEnv>();

usuarios.use("*", withSession, requireAuth, requireRole("administrador"));

usuarios.get("/", async (c) => {
	const { results } = await c.env.DB.prepare(
		"SELECT id, nome, email, perfil, ativo, ultimo_login_em, criado_em FROM usuarios ORDER BY nome",
	).all();

	return c.json({ usuarios: results });
});

usuarios.patch("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = patchUsuarioSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}

	const atual = c.get("user")!;

	// Um administrador não pode desativar a própria conta nem trocar o
	// próprio perfil para algo diferente de administrador — evita perder
	// acesso administrativo por acidente através de uma requisição direta.
	if (id === atual.id) {
		if (parsed.data.ativo === false) {
			return c.json({ error: "não é possível desativar a própria conta" }, 400);
		}
		if (parsed.data.perfil && parsed.data.perfil !== "administrador") {
			return c.json({ error: "não é possível remover o próprio acesso administrativo" }, 400);
		}
	}

	const alvo = await c.env.DB.prepare("SELECT id FROM usuarios WHERE id = ?").bind(id).first();
	if (!alvo) {
		return c.json({ error: "usuário não encontrado" }, 404);
	}

	const campos: string[] = [];
	const valores: unknown[] = [];
	for (const [campo, valor] of Object.entries(parsed.data)) {
		campos.push(`${campo} = ?`);
		valores.push(campo === "ativo" ? (valor ? 1 : 0) : valor);
	}
	campos.push("atualizado_em = CURRENT_TIMESTAMP");

	try {
		await c.env.DB.prepare(`UPDATE usuarios SET ${campos.join(", ")} WHERE id = ?`)
			.bind(...valores, id)
			.run();
	} catch {
		return c.json({ error: "não foi possível atualizar (e-mail já em uso?)" }, 409);
	}

	const atualizado = await c.env.DB.prepare(
		"SELECT id, nome, email, perfil, ativo, ultimo_login_em, criado_em FROM usuarios WHERE id = ?",
	)
		.bind(id)
		.first();

	return c.json({ usuario: atualizado });
});

export default usuarios;

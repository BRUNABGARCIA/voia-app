import { createMiddleware } from "hono/factory";
import type { AuthEnv } from "../auth/middleware";
import { temAcessoAoProjeto } from "../projetos/acesso";

/**
 * Obra é sempre sub-recurso de um projeto (migration 0025) — o acesso a
 * ela é DERIVADO do acesso ao projeto dela, nunca uma régua própria.
 * Reaproveita temAcessoAoProjeto (projetos/acesso.ts): Parceiro só acessa
 * obra de projeto em que é membro; administrador/gestor/visualizador
 * mantêm a visão completa já existente.
 */
export async function obraEProjetoId(db: D1Database, obraId: number): Promise<number | null> {
	const row = await db.prepare("SELECT projeto_id FROM obras WHERE id = ?").bind(obraId).first<{ projeto_id: number }>();
	return row?.projeto_id ?? null;
}

/**
 * Exige que a obra do path (:id) exista e seja acessível ao usuário
 * autenticado — 404 (nunca 403) quando não é, mesmo padrão anti-enumeração
 * de requireProjectAccess: nunca confirma a um Parceiro sem acesso que
 * aquela obra existe. Deve rodar depois de withSession + requireAuth.
 */
export const requireObraAccess = createMiddleware<AuthEnv>(async (c, next) => {
	const obraId = Number(c.req.param("id"));
	if (!Number.isInteger(obraId) || obraId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}
	const user = c.get("user")!;
	const projetoId = await obraEProjetoId(c.env.DB, obraId);
	if (projetoId === null) {
		return c.json({ error: "obra não encontrada" }, 404);
	}
	if (!(await temAcessoAoProjeto(c.env.DB, user.id, user.perfil, projetoId))) {
		return c.json({ error: "obra não encontrada" }, 404);
	}
	await next();
});

import { createMiddleware } from "hono/factory";
import { getCookie, deleteCookie } from "hono/cookie";
import { resolveSession, SESSION_COOKIE_NAME, type SessionUser } from "./session";

export type AuthEnv = { Bindings: Env; Variables: { user: SessionUser | null } };

/** Resolve a sessão do cookie (se houver) e disponibiliza o usuário no contexto. Não bloqueia. */
export const withSession = createMiddleware<AuthEnv>(async (c, next) => {
	const token = getCookie(c, SESSION_COOKIE_NAME);
	if (!token) {
		c.set("user", null);
		await next();
		return;
	}

	const user = await resolveSession(c.env.DB, token);
	if (!user) {
		deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
	}

	c.set("user", user);
	await next();
});

/** Exige sessão válida (deve rodar depois de withSession). O backend é a autoridade real de acesso. */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
	if (!c.get("user")) {
		return c.json({ error: "não autenticado" }, 401);
	}
	await next();
});

/** Exige que o usuário autenticado tenha um dos perfis informados. */
export function requireRole(...perfis: string[]) {
	return createMiddleware<AuthEnv>(async (c, next) => {
		const user = c.get("user");
		if (!user || !perfis.includes(user.perfil)) {
			return c.json({ error: "acesso negado" }, 403);
		}
		await next();
	});
}

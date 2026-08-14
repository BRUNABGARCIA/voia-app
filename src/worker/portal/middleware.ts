import { createMiddleware } from "hono/factory";
import { getCookie, deleteCookie } from "hono/cookie";
import { resolvePortalSession, PORTAL_SESSION_COOKIE_NAME, type PortalContato } from "./session";

// Ambiente de tipos PRÓPRIO do Portal (Variables: "contato", nunca "user").
// Rotas internas (AuthEnv) e rotas do Portal (PortalEnv) nunca compartilham
// contexto: mesmo que as duas sessões estivessem presentes ao mesmo tempo no
// navegador, uma rota do Portal nunca lê c.get("user") e uma rota interna
// nunca lê c.get("contato") — não existe caminho de código em que uma
// sessão do Portal resulte em acesso a uma API interna, ou vice-versa.
export type PortalEnv = { Bindings: Env; Variables: { contato: PortalContato | null } };

export const withPortalSession = createMiddleware<PortalEnv>(async (c, next) => {
	const token = getCookie(c, PORTAL_SESSION_COOKIE_NAME);
	if (!token) {
		c.set("contato", null);
		await next();
		return;
	}

	const contato = await resolvePortalSession(c.env.DB, token);
	if (!contato) {
		deleteCookie(c, PORTAL_SESSION_COOKIE_NAME, { path: "/" });
	}

	c.set("contato", contato);
	await next();
});

export const requirePortalAuth = createMiddleware<PortalEnv>(async (c, next) => {
	if (!c.get("contato")) {
		return c.json({ error: "não autenticado" }, 401);
	}
	await next();
});

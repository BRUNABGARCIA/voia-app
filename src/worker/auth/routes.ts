import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import { verifyPassword } from "./hash";
import { createSession, destroySession, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "./session";
import { withSession, requireAuth, type AuthEnv } from "./middleware";

const loginSchema = z.object({
	email: z.string().trim().toLowerCase().min(1).max(254).email(),
	senha: z.string().min(1).max(200),
});

const auth = new Hono<AuthEnv>();

auth.post("/login", async (c) => {
	const body = await c.req.json().catch(() => null);
	const parsed = loginSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "credenciais inválidas" }, 401);
	}

	const { email, senha } = parsed.data;

	const usuario = await c.env.DB.prepare(
		"SELECT id, nome, email, perfil, senha_hash FROM usuarios WHERE email = ? AND ativo = 1",
	)
		.bind(email)
		.first<{ id: number; nome: string; email: string; perfil: string; senha_hash: string | null }>();

	if (!usuario || !usuario.senha_hash || !(await verifyPassword(senha, usuario.senha_hash))) {
		return c.json({ error: "credenciais inválidas" }, 401);
	}

	const token = await createSession(c.env.DB, usuario.id);

	// Registro de auditoria (coluna adicionada na migration 0003), gravado
	// só depois do login já autenticado com sucesso — não participa da
	// validação de credenciais nem da criação da sessão acima.
	await c.env.DB.prepare("UPDATE usuarios SET ultimo_login_em = CURRENT_TIMESTAMP WHERE id = ?").bind(usuario.id).run();

	setCookie(c, SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: new URL(c.req.url).protocol === "https:",
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_DURATION_SECONDS,
	});

	return c.json({ id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil });
});

auth.post("/logout", withSession, async (c) => {
	const token = getCookie(c, SESSION_COOKIE_NAME);
	if (token) {
		await destroySession(c.env.DB, token);
	}
	deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
	return c.json({ ok: true });
});

auth.get("/me", withSession, requireAuth, (c) => {
	return c.json(c.get("user"));
});

export default auth;

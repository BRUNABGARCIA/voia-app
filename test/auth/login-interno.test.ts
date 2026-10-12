import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/worker/index";
import { hashPassword } from "../../src/worker/auth/hash";
import { SESSION_COOKIE_NAME } from "../../src/worker/auth/session";
import { extrairCookie, jsonRequest } from "../helpers/http";

async function criarUsuario(email: string, senha: string | null, opts: { ativo?: boolean } = {}) {
	const senhaHash = senha ? await hashPassword(senha) : null;
	await env.DB.prepare("INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash) VALUES (?, ?, ?, ?, ?)")
		.bind("Usuário de teste", email, "administrador", opts.ativo === false ? 0 : 1, senhaHash)
		.run();
}

describe("POST /api/auth/login", () => {
	it("credencial válida autentica e devolve os dados do usuário", async () => {
		await criarUsuario("login-valido@voia.local", "senha-correta-123");

		const res = await app.request("/api/auth/login", jsonRequest("POST", { email: "login-valido@voia.local", senha: "senha-correta-123" }), env);

		expect(res.status).toBe(200);
		const body = await res.json<{ email: string; perfil: string }>();
		expect(body.email).toBe("login-valido@voia.local");
		expect(body.perfil).toBe("administrador");
	});

	it("e-mail inexistente devolve 401 genérico", async () => {
		const res = await app.request(
			"/api/auth/login",
			jsonRequest("POST", { email: "nao-existe@voia.local", senha: "qualquer-coisa" }),
			env,
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "credenciais inválidas" });
	});

	it("senha incorreta devolve a MESMA resposta genérica de e-mail inexistente", async () => {
		await criarUsuario("senha-errada@voia.local", "senha-correta-456");

		const res = await app.request(
			"/api/auth/login",
			jsonRequest("POST", { email: "senha-errada@voia.local", senha: "senha-errada" }),
			env,
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "credenciais inválidas" });
	});

	it("usuário inativo não consegue logar, mesma resposta genérica", async () => {
		await criarUsuario("inativo@voia.local", "senha-789", { ativo: false });

		const res = await app.request("/api/auth/login", jsonRequest("POST", { email: "inativo@voia.local", senha: "senha-789" }), env);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "credenciais inválidas" });
	});

	it("normaliza e-mail (maiúsculas/espaços) antes de autenticar", async () => {
		await criarUsuario("normalizado@voia.local", "senha-normal");

		const res = await app.request(
			"/api/auth/login",
			jsonRequest("POST", { email: "  NORMALIZADO@VOIA.LOCAL  ", senha: "senha-normal" }),
			env,
		);
		expect(res.status).toBe(200);
	});

	it("cria sessão real no banco e devolve cookie httpOnly/SameSite=Lax", async () => {
		await criarUsuario("cookie@voia.local", "senha-cookie");

		const res = await app.request("/api/auth/login", jsonRequest("POST", { email: "cookie@voia.local", senha: "senha-cookie" }), env);
		const setCookie = res.headers.getSetCookie()[0];

		expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
		expect(setCookie).toMatch(/HttpOnly/i);
		expect(setCookie).toMatch(/SameSite=Lax/i);

		const { results } = await env.DB.prepare(
			"SELECT s.id FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE u.email = ?",
		)
			.bind("cookie@voia.local")
			.all();
		expect(results.length).toBe(1);
	});
});

describe("GET /api/auth/me e POST /api/auth/logout", () => {
	it("logout invalida a sessão no servidor (cookie antigo some de `sessoes`)", async () => {
		await criarUsuario("logout@voia.local", "senha-logout");
		const login = await app.request("/api/auth/login", jsonRequest("POST", { email: "logout@voia.local", senha: "senha-logout" }), env);
		const cookie = extrairCookie(login, SESSION_COOKIE_NAME)!;

		const me = await app.request("/api/auth/me", { headers: { cookie } }, env);
		expect(me.status).toBe(200);

		await app.request("/api/auth/logout", { method: "POST", headers: { cookie } }, env);

		const meDepois = await app.request("/api/auth/me", { headers: { cookie } }, env);
		expect(meDepois.status).toBe(401);
	});

	it("cookie com token inválido/inexistente é rejeitado", async () => {
		const res = await app.request("/api/auth/me", { headers: { cookie: `${SESSION_COOKIE_NAME}=token-que-nunca-existiu` } }, env);
		expect(res.status).toBe(401);
	});

	it("sessão expirada é rejeitada e removida do banco", async () => {
		await criarUsuario("expirado@voia.local", "senha-expirado");
		const login = await app.request(
			"/api/auth/login",
			jsonRequest("POST", { email: "expirado@voia.local", senha: "senha-expirado" }),
			env,
		);
		const cookie = extrairCookie(login, SESSION_COOKIE_NAME)!;

		await env.DB.prepare(
			"UPDATE sessoes SET expira_em = datetime('now', '-1 day') WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)",
		)
			.bind("expirado@voia.local")
			.run();

		const res = await app.request("/api/auth/me", { headers: { cookie } }, env);
		expect(res.status).toBe(401);

		const restante = await env.DB.prepare(
			"SELECT COUNT(*) AS total FROM sessoes WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)",
		)
			.bind("expirado@voia.local")
			.first<{ total: number }>();
		expect(restante?.total).toBe(0);
	});
});

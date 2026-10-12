import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/worker/index";
import { hashPassword } from "../../src/worker/auth/hash";
import { SESSION_COOKIE_NAME } from "../../src/worker/auth/session";
import { PORTAL_SESSION_COOKIE_NAME } from "../../src/worker/portal/session";
import { extrairCookie, jsonRequest } from "../helpers/http";

async function criarCliente(nome: string): Promise<number> {
	const row = await env.DB.prepare("INSERT INTO clientes (tipo, nome) VALUES ('PJ', ?) RETURNING id")
		.bind(nome)
		.first<{ id: number }>();
	return row!.id;
}

async function criarContato(
	clienteId: number,
	email: string,
	senha: string | null,
	opts: { ativo?: boolean } = {},
): Promise<number> {
	const senhaHash = senha ? await hashPassword(senha) : null;
	const row = await env.DB.prepare(
		"INSERT INTO cliente_contatos (cliente_id, nome, email, senha_hash, ativo) VALUES (?, ?, ?, ?, ?) RETURNING id",
	)
		.bind(clienteId, "Contato de teste", email, senhaHash, opts.ativo === false ? 0 : 1)
		.first<{ id: number }>();
	return row!.id;
}

describe("POST /api/portal/login", () => {
	it("contato válido autentica", async () => {
		const clienteId = await criarCliente("Cliente Portal Válido");
		await criarContato(clienteId, "contato-valido@cliente.com", "senha-portal-1");

		const res = await app.request(
			"/api/portal/login",
			jsonRequest("POST", { email: "contato-valido@cliente.com", senha: "senha-portal-1" }),
			env,
		);
		expect(res.status).toBe(200);
	});

	it("contato sem acesso (inativo) é rejeitado com resposta genérica", async () => {
		const clienteId = await criarCliente("Cliente Portal Inativo");
		await criarContato(clienteId, "contato-inativo@cliente.com", "senha-portal-2", { ativo: false });

		const res = await app.request(
			"/api/portal/login",
			jsonRequest("POST", { email: "contato-inativo@cliente.com", senha: "senha-portal-2" }),
			env,
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "credenciais inválidas" });
	});

	it("credencial inválida é rejeitada", async () => {
		const clienteId = await criarCliente("Cliente Portal Senha Errada");
		await criarContato(clienteId, "senha-errada@cliente.com", "senha-correta-portal");

		const res = await app.request(
			"/api/portal/login",
			jsonRequest("POST", { email: "senha-errada@cliente.com", senha: "senha-errada" }),
			env,
		);
		expect(res.status).toBe(401);
	});

	it("cria sessão no banco (sessoes_portal) e devolve cookie próprio", async () => {
		const clienteId = await criarCliente("Cliente Portal Cookie");
		await criarContato(clienteId, "cookie-portal@cliente.com", "senha-cookie-portal");

		const res = await app.request(
			"/api/portal/login",
			jsonRequest("POST", { email: "cookie-portal@cliente.com", senha: "senha-cookie-portal" }),
			env,
		);
		const setCookie = res.headers.getSetCookie()[0];
		expect(setCookie).toContain(`${PORTAL_SESSION_COOKIE_NAME}=`);

		const { results } = await env.DB.prepare(
			"SELECT sp.id FROM sessoes_portal sp JOIN cliente_contatos cc ON cc.id = sp.contato_id WHERE cc.email = ?",
		)
			.bind("cookie-portal@cliente.com")
			.all();
		expect(results.length).toBe(1);
	});

	it("logout do portal invalida a sessão no servidor", async () => {
		const clienteId = await criarCliente("Cliente Portal Logout");
		await criarContato(clienteId, "logout-portal@cliente.com", "senha-logout-portal");

		const login = await app.request(
			"/api/portal/login",
			jsonRequest("POST", { email: "logout-portal@cliente.com", senha: "senha-logout-portal" }),
			env,
		);
		const cookie = extrairCookie(login, PORTAL_SESSION_COOKIE_NAME)!;

		expect((await app.request("/api/portal/me", { headers: { cookie } }, env)).status).toBe(200);

		await app.request("/api/portal/logout", { method: "POST", headers: { cookie } }, env);

		expect((await app.request("/api/portal/me", { headers: { cookie } }, env)).status).toBe(401);
	});
});

describe("isolamento entre sessão interna e sessão do Portal", () => {
	it("cookie de cliente (Portal) NÃO autentica rotas internas", async () => {
		const clienteId = await criarCliente("Cliente Isolamento 1");
		await criarContato(clienteId, "isolamento-1@cliente.com", "senha-isolamento-1");

		const loginPortal = await app.request(
			"/api/portal/login",
			jsonRequest("POST", { email: "isolamento-1@cliente.com", senha: "senha-isolamento-1" }),
			env,
		);
		const cookiePortal = extrairCookie(loginPortal, PORTAL_SESSION_COOKIE_NAME)!;

		// Mesmo valor de token, mas sob o nome de cookie da sessão interna —
		// withSession só procura por SESSION_COOKIE_NAME, nunca por
		// PORTAL_SESSION_COOKIE_NAME, então isso nunca deveria autenticar.
		const tokenCru = cookiePortal.split("=")[1];
		const res = await app.request("/api/auth/me", { headers: { cookie: `${SESSION_COOKIE_NAME}=${tokenCru}` } }, env);
		expect(res.status).toBe(401);
	});

	it("cookie interno (administrador) NÃO concede acesso ao Portal", async () => {
		await env.DB.prepare("INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash) VALUES (?, ?, ?, 1, ?)")
			.bind("Admin Isolamento", "admin-isolamento@voia.local", "administrador", await hashPassword("senha-admin-isolamento"))
			.run();

		const loginInterno = await app.request(
			"/api/auth/login",
			jsonRequest("POST", { email: "admin-isolamento@voia.local", senha: "senha-admin-isolamento" }),
			env,
		);
		const cookieInterno = extrairCookie(loginInterno, SESSION_COOKIE_NAME)!;

		const tokenCru = cookieInterno.split("=")[1];
		const res = await app.request(
			"/api/portal/me",
			{ headers: { cookie: `${PORTAL_SESSION_COOKIE_NAME}=${tokenCru}` } },
			env,
		);
		expect(res.status).toBe(401);
	});
});

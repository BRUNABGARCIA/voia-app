import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/worker/index";
import { hashPassword } from "../../src/worker/auth/hash";
import { PORTAL_SESSION_COOKIE_NAME } from "../../src/worker/portal/session";
import { criarCliente, criarProjeto, criarUsuario } from "../helpers/fixtures";
import { extrairCookie, jsonRequest } from "../helpers/http";

async function criarContatoComAcesso(clienteId: number, email: string, projetoIds: number[]): Promise<void> {
	const contato = await env.DB.prepare(
		"INSERT INTO cliente_contatos (cliente_id, nome, email, senha_hash) VALUES (?, ?, ?, ?) RETURNING id",
	)
		.bind(clienteId, "Contato", email, await hashPassword("senha-contato-teste"))
		.first<{ id: number }>();
	for (const projetoId of projetoIds) {
		await env.DB.prepare("INSERT INTO cliente_contato_processos (contato_id, projeto_id) VALUES (?, ?)")
			.bind(contato!.id, projetoId)
			.run();
	}
}

async function loginPortal(email: string): Promise<string> {
	const res = await app.request(
		"/api/portal/login",
		jsonRequest("POST", { email, senha: "senha-contato-teste" }),
		env,
	);
	return extrairCookie(res, PORTAL_SESSION_COOKIE_NAME)!;
}

describe("Portal do Cliente — isolamento entre contatos/processos", () => {
	it("contato só vê os processos explicitamente autorizados a ele, não todos os do cliente", async () => {
		const admin = await criarUsuario("admin-portal-isolamento@voia.local", "administrador");
		const clienteId = await criarCliente("Cliente Portal Isolamento");
		const projetoAutorizado = await criarProjeto(clienteId, admin, "Projeto autorizado");
		await criarProjeto(clienteId, admin, "Projeto NÃO autorizado");

		await criarContatoComAcesso(clienteId, "contato-parcial@cliente.com", [projetoAutorizado]);
		const cookie = await loginPortal("contato-parcial@cliente.com");

		const res = await app.request("/api/portal/processos", { headers: { cookie } }, env);
		const body = await res.json<{ processos: { id: number }[] }>();
		expect(body.processos).toHaveLength(1);
		expect(body.processos[0].id).toBe(projetoAutorizado);
	});

	it("contato não consegue ver o detalhe de um processo que não lhe foi concedido (404, não 403)", async () => {
		const admin = await criarUsuario("admin-portal-404@voia.local", "administrador");
		const clienteId = await criarCliente("Cliente Portal 404");
		const projetoNaoAutorizado = await criarProjeto(clienteId, admin, "Projeto fora do alcance");
		await criarContatoComAcesso(clienteId, "contato-sem-acesso@cliente.com", []);
		const cookie = await loginPortal("contato-sem-acesso@cliente.com");

		const res = await app.request(`/api/portal/processos/${projetoNaoAutorizado}`, { headers: { cookie } }, env);
		expect(res.status).toBe(404);
	});

	it("contato de um cliente não vê processo autorizado a um contato de OUTRO cliente", async () => {
		const admin = await criarUsuario("admin-portal-cruzado@voia.local", "administrador");
		const clienteA = await criarCliente("Cliente Portal A");
		const clienteB = await criarCliente("Cliente Portal B");
		const projetoDoB = await criarProjeto(clienteB, admin, "Projeto do cliente B");

		await criarContatoComAcesso(clienteA, "contato-cliente-a@cliente.com", []);
		const cookieA = await loginPortal("contato-cliente-a@cliente.com");

		// Mesmo sabendo o id do projeto do cliente B, o contato do cliente A
		// não tem linha em cliente_contato_processos para ele.
		const res = await app.request(`/api/portal/processos/${projetoDoB}`, { headers: { cookie: cookieA } }, env);
		expect(res.status).toBe(404);
	});
});

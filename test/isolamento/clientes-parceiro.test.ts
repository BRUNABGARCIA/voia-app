import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/worker/index";
import { SESSION_COOKIE_NAME } from "../../src/worker/auth/session";
import { criarCliente, criarProjeto, criarUsuario, vincularMembro } from "../helpers/fixtures";
import { extrairCookie, jsonRequest } from "../helpers/http";

async function loginComo(email: string): Promise<string> {
	const res = await app.request("/api/auth/login", jsonRequest("POST", { email, senha: "senha-padrao-teste" }), env);
	return extrairCookie(res, SESSION_COOKIE_NAME)!;
}

describe("Parceiro nunca cria/edita cliente (decisão de produto da revisão da Rodada 03)", () => {
	it("POST /api/clientes é rejeitado com 403 para Parceiro", async () => {
		await criarUsuario("parceiro-sem-criar-cliente@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-sem-criar-cliente@voia.local");

		const res = await app.request(
			"/api/clientes",
			jsonRequest("POST", { tipo: "PJ", nome: "Cliente criado por Parceiro" }, cookie),
			env,
		);
		expect(res.status).toBe(403);

		const existe = await env.DB.prepare("SELECT COUNT(*) AS n FROM clientes WHERE nome = ?")
			.bind("Cliente criado por Parceiro")
			.first<{ n: number }>();
		expect(existe?.n).toBe(0);
	});

	it("PATCH /api/clientes/:id é rejeitado com 403 para Parceiro, mesmo em cliente do seu próprio projeto", async () => {
		const admin = await criarUsuario("admin-setup-cliente-parceiro@voia.local", "administrador");
		const parceiro = await criarUsuario("parceiro-sem-editar-cliente@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-sem-editar-cliente@voia.local");

		const clienteId = await criarCliente("Cliente do projeto do Parceiro");
		const projetoId = await criarProjeto(clienteId, admin, "Projeto vinculado");
		await vincularMembro(projetoId, parceiro);

		const res = await app.request(
			`/api/clientes/${clienteId}`,
			jsonRequest("PATCH", { nome: "Nome alterado pelo Parceiro" }, cookie),
			env,
		);
		expect(res.status).toBe(403);

		const cliente = await env.DB.prepare("SELECT nome FROM clientes WHERE id = ?").bind(clienteId).first<{ nome: string }>();
		expect(cliente?.nome).toBe("Cliente do projeto do Parceiro");
	});

	it("Parceiro continua conseguindo CONSULTAR o cliente do seu próprio projeto (GET não foi afetado)", async () => {
		const admin = await criarUsuario("admin-setup-cliente-leitura@voia.local", "administrador");
		const parceiro = await criarUsuario("parceiro-le-cliente@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-le-cliente@voia.local");

		const clienteId = await criarCliente("Cliente consultável");
		const projetoId = await criarProjeto(clienteId, admin, "Projeto consultável");
		await vincularMembro(projetoId, parceiro);

		const res = await app.request(`/api/clientes/${clienteId}`, { headers: { cookie } }, env);
		expect(res.status).toBe(200);
	});

	it("administrador e gestor continuam criando/editando cliente normalmente", async () => {
		await criarUsuario("admin-ainda-cria@voia.local", "administrador");
		await criarUsuario("gestor-ainda-edita@voia.local", "gestor");
		const cookieAdmin = await loginComo("admin-ainda-cria@voia.local");
		const cookieGestor = await loginComo("gestor-ainda-edita@voia.local");

		const criado = await app.request(
			"/api/clientes",
			jsonRequest("POST", { tipo: "PJ", nome: "Cliente criado por admin" }, cookieAdmin),
			env,
		);
		expect(criado.status).toBe(201);
		const { cliente } = await criado.json<{ cliente: { id: number } }>();

		const editado = await app.request(
			`/api/clientes/${cliente.id}`,
			jsonRequest("PATCH", { nome: "Cliente editado por gestor" }, cookieGestor),
			env,
		);
		expect(editado.status).toBe(200);
	});
});

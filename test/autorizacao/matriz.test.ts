import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/worker/index";
import { SESSION_COOKIE_NAME } from "../../src/worker/auth/session";
import { criarCliente, criarProjeto, criarUsuario } from "../helpers/fixtures";
import { extrairCookie, jsonRequest } from "../helpers/http";

async function loginComo(email: string): Promise<string> {
	const res = await app.request("/api/auth/login", jsonRequest("POST", { email, senha: "senha-padrao-teste" }), env);
	return extrairCookie(res, SESSION_COOKIE_NAME)!;
}

describe("matriz de autorização — casos sensíveis", () => {
	it("visualizador não pode criar cliente (403)", async () => {
		await criarUsuario("visualizador-cliente@voia.local", "visualizador");
		const cookie = await loginComo("visualizador-cliente@voia.local");

		const res = await app.request(
			"/api/clientes",
			jsonRequest("POST", { tipo: "PJ", nome: "Tentativa de visualizador" }, cookie),
			env,
		);
		expect(res.status).toBe(403);
	});

	it("visualizador PODE listar clientes (leitura liberada a qualquer perfil autenticado)", async () => {
		await criarUsuario("visualizador-leitura@voia.local", "visualizador");
		const cookie = await loginComo("visualizador-leitura@voia.local");

		const res = await app.request("/api/clientes", { headers: { cookie } }, env);
		expect(res.status).toBe(200);
	});

	it("colaborador não pode excluir etapa (ação restrita a administrador/gestor)", async () => {
		const admin = await criarUsuario("admin-setup-colab@voia.local", "administrador");
		await criarUsuario("colaborador-exclui@voia.local", "colaborador");
		const cookieColaborador = await loginComo("colaborador-exclui@voia.local");

		const clienteId = await criarCliente("Cliente Matriz Colaborador");
		const projetoId = await criarProjeto(clienteId, admin, "Projeto Matriz Colaborador");
		const etapaRow = await env.DB.prepare(
			"INSERT INTO projeto_etapas (projeto_id, nome, ordem) VALUES (?, ?, 1) RETURNING id",
		)
			.bind(projetoId, "Etapa")
			.first<{ id: number }>();

		const res = await app.request(
			`/api/projetos/${projetoId}/etapas/${etapaRow!.id}`,
			{ method: "DELETE", headers: { cookie: cookieColaborador } },
			env,
		);
		expect(res.status).toBe(403);
	});

	it("colaborador não pode cancelar o próprio projeto (regra manual no handler)", async () => {
		const colaboradorId = await criarUsuario("colaborador-cancela@voia.local", "colaborador");
		const cookie = await loginComo("colaborador-cancela@voia.local");
		const clienteId = await criarCliente("Cliente Matriz Cancelar");
		const projetoId = await criarProjeto(clienteId, colaboradorId, "Projeto a Cancelar");

		const res = await app.request(
			`/api/projetos/${projetoId}`,
			jsonRequest("PATCH", { status: "cancelado" }, cookie),
			env,
		);
		expect(res.status).toBe(403);
	});

	it("rotas de tipos de serviço (modelo) exigem administrador — gestor é rejeitado", async () => {
		await criarUsuario("gestor-tipos-servico@voia.local", "gestor");
		const cookie = await loginComo("gestor-tipos-servico@voia.local");

		const res = await app.request("/api/tipos-servico", { headers: { cookie } }, env);
		expect(res.status).toBe(403);
	});

	it("sem sessão nenhuma, rota protegida devolve 401 (não 403)", async () => {
		const res = await app.request("/api/clientes", {}, env);
		expect(res.status).toBe(401);
	});
});

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/worker/index";
import { SESSION_COOKIE_NAME } from "../../src/worker/auth/session";
import { criarUsuario } from "../helpers/fixtures";
import { extrairCookie, jsonRequest } from "../helpers/http";

async function loginComo(email: string): Promise<string> {
	const res = await app.request("/api/auth/login", jsonRequest("POST", { email, senha: "senha-padrao-teste" }), env);
	return extrairCookie(res, SESSION_COOKIE_NAME)!;
}

describe("validação de responsavel_interno_id (mesmo padrão de gerente_id em projetos)", () => {
	it("POST /api/clientes rejeita responsavel_interno_id inexistente", async () => {
		await criarUsuario("admin-valida-cliente@voia.local", "administrador");
		const cookie = await loginComo("admin-valida-cliente@voia.local");

		const res = await app.request(
			"/api/clientes",
			jsonRequest("POST", { tipo: "PJ", nome: "Cliente com responsável inválido", responsavel_interno_id: 999999 }, cookie),
			env,
		);
		expect(res.status).toBe(400);
	});

	it("PATCH /api/clientes/:id rejeita responsavel_interno_id inexistente", async () => {
		const adminId = await criarUsuario("admin-valida-cliente-patch@voia.local", "administrador");
		const cookie = await loginComo("admin-valida-cliente-patch@voia.local");

		const criado = await env.DB.prepare("INSERT INTO clientes (tipo, nome, responsavel_interno_id) VALUES ('PJ', ?, ?) RETURNING id")
			.bind("Cliente válido", adminId)
			.first<{ id: number }>();

		const res = await app.request(
			`/api/clientes/${criado!.id}`,
			jsonRequest("PATCH", { responsavel_interno_id: 999999 }, cookie),
			env,
		);
		expect(res.status).toBe(400);

		const cliente = await env.DB.prepare("SELECT responsavel_interno_id FROM clientes WHERE id = ?")
			.bind(criado!.id)
			.first<{ responsavel_interno_id: number }>();
		expect(cliente?.responsavel_interno_id).toBe(adminId);
	});

	it("POST /api/clientes aceita responsavel_interno_id de um usuário real", async () => {
		const adminId = await criarUsuario("admin-valido-cliente@voia.local", "administrador");
		const cookie = await loginComo("admin-valido-cliente@voia.local");

		const res = await app.request(
			"/api/clientes",
			jsonRequest("POST", { tipo: "PJ", nome: "Cliente com responsável válido", responsavel_interno_id: adminId }, cookie),
			env,
		);
		expect(res.status).toBe(201);
	});
});

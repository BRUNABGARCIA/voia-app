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

describe("Meu foco de hoje — isolamento entre usuários", () => {
	it("Parceiro A grava o próprio foco e consegue lê-lo de volta", async () => {
		await criarUsuario("parceiro-foco-a@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-foco-a@voia.local");

		const salvo = await app.request("/api/foco", jsonRequest("PUT", { texto: "Fechar a planilha do projeto X" }, cookie), env);
		expect(salvo.status).toBe(200);

		const lido = await app.request("/api/foco", { headers: { cookie } }, env);
		const body = await lido.json<{ texto: string | null }>();
		expect(body.texto).toBe("Fechar a planilha do projeto X");
	});

	it("Parceiro B não lê o foco do Parceiro A (cada um vê só o próprio)", async () => {
		await criarUsuario("parceiro-foco-c@voia.local", "colaborador");
		await criarUsuario("parceiro-foco-d@voia.local", "colaborador");
		const cookieA = await loginComo("parceiro-foco-c@voia.local");
		const cookieB = await loginComo("parceiro-foco-d@voia.local");

		await app.request("/api/foco", jsonRequest("PUT", { texto: "Foco exclusivo do C" }, cookieA), env);

		const comoB = await app.request("/api/foco", { headers: { cookie: cookieB } }, env);
		const body = await comoB.json<{ texto: string | null }>();
		expect(body.texto).toBeNull();
	});

	it("Parceiro B não consegue alterar o foco do Parceiro A (não existe id no payload, sempre é o da sessão)", async () => {
		await criarUsuario("parceiro-foco-e@voia.local", "colaborador");
		await criarUsuario("parceiro-foco-f@voia.local", "colaborador");
		const cookieA = await loginComo("parceiro-foco-e@voia.local");
		const cookieB = await loginComo("parceiro-foco-f@voia.local");

		await app.request("/api/foco", jsonRequest("PUT", { texto: "Foco original do E" }, cookieA), env);
		await app.request("/api/foco", jsonRequest("PUT", { texto: "Tentativa de sobrescrever" }, cookieB), env);

		const comoA = await app.request("/api/foco", { headers: { cookie: cookieA } }, env);
		const body = await comoA.json<{ texto: string | null }>();
		expect(body.texto).toBe("Foco original do E");
	});

	it("atualizar o foco no mesmo dia substitui o registro (não duplica)", async () => {
		const usuarioId = await criarUsuario("parceiro-foco-mesmo-dia@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-foco-mesmo-dia@voia.local");

		await app.request("/api/foco", jsonRequest("PUT", { texto: "Primeira versão" }, cookie), env);
		await app.request("/api/foco", jsonRequest("PUT", { texto: "Segunda versão" }, cookie), env);

		const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM parceiro_foco_diario WHERE usuario_id = ?")
			.bind(usuarioId)
			.first<{ n: number }>();
		expect(total?.n).toBe(1);

		const lido = await app.request("/api/foco", { headers: { cookie } }, env);
		const body = await lido.json<{ texto: string | null }>();
		expect(body.texto).toBe("Segunda versão");
	});

	it("datas diferentes são registros diferentes (gravação direta simulando outro dia)", async () => {
		const usuarioId = await criarUsuario("parceiro-foco-datas@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-foco-datas@voia.local");

		await app.request("/api/foco", jsonRequest("PUT", { texto: "Foco de hoje" }, cookie), env);
		await env.DB.prepare("INSERT INTO parceiro_foco_diario (usuario_id, data, texto) VALUES (?, ?, ?)")
			.bind(usuarioId, "2020-01-01", "Foco de um dia antigo")
			.run();

		const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM parceiro_foco_diario WHERE usuario_id = ?")
			.bind(usuarioId)
			.first<{ n: number }>();
		expect(total?.n).toBe(2);
	});

	it("sem sessão, GET/PUT /api/foco devolvem 401", async () => {
		const get = await app.request("/api/foco", {}, env);
		const put = await app.request("/api/foco", jsonRequest("PUT", { texto: "x" }), env);
		expect(get.status).toBe(401);
		expect(put.status).toBe(401);
	});
});

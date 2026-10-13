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

describe("Dashboard — KPIs de obras/ocorrências (Rodada 04)", () => {
	it("admin vê contagem real de obras em execução e ocorrências abertas", async () => {
		const adminId = await criarUsuario("admin-dash-obras@voia.local", "administrador");
		const cookieAdmin = await loginComo("admin-dash-obras@voia.local");
		const clienteId = await criarCliente("Cliente Dashboard Obras");
		const projetoId = await criarProjeto(clienteId, adminId, "Projeto Dashboard Obras");

		const criada = await app.request(
			"/api/obras",
			jsonRequest("POST", { projeto_id: projetoId, nome: "Obra Dashboard", status: "em_execucao" }, cookieAdmin),
			env,
		);
		const { obra } = await criada.json<{ obra: { id: number } }>();

		await app.request(
			`/api/obras/${obra.id}/ocorrencias`,
			jsonRequest("POST", { titulo: "Pendência de material" }, cookieAdmin),
			env,
		);

		const res = await app.request("/api/dashboard", { headers: { cookie: cookieAdmin } }, env);
		const body = await res.json<{ obrasEmExecucao: number; ocorrenciasAbertas: number }>();
		expect(body.obrasEmExecucao).toBeGreaterThanOrEqual(1);
		expect(body.ocorrenciasAbertas).toBeGreaterThanOrEqual(1);
	});

	it("dashboard do Parceiro nunca inclui os KPIs administrativos de obras/ocorrências", async () => {
		const parceiroId = await criarUsuario("parceiro-dash-obras@voia.local", "colaborador");
		const cookieParceiro = await loginComo("parceiro-dash-obras@voia.local");

		const res = await app.request("/api/dashboard", { headers: { cookie: cookieParceiro } }, env);
		const texto = await res.text();
		expect(texto).not.toContain("obrasEmExecucao");
		expect(texto).not.toContain("ocorrenciasAbertas");
		void parceiroId;
	});
});

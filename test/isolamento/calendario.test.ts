import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/worker/index";
import { SESSION_COOKIE_NAME } from "../../src/worker/auth/session";
import { criarCliente, criarEtapa, criarProjeto, criarUsuario, vincularMembro } from "../helpers/fixtures";
import { extrairCookie, jsonRequest } from "../helpers/http";

async function loginComo(email: string): Promise<string> {
	const res = await app.request("/api/auth/login", jsonRequest("POST", { email, senha: "senha-padrao-teste" }), env);
	return extrairCookie(res, SESSION_COOKIE_NAME)!;
}

describe("Calendário — escopo por perfil", () => {
	it("Parceiro não vê etapa de projeto ao qual não está vinculado", async () => {
		const adminId = await criarUsuario("admin-cal-etapa@voia.local", "administrador");
		const parceiroId = await criarUsuario("parceiro-cal-etapa@voia.local", "colaborador");
		const cookieParceiro = await loginComo("parceiro-cal-etapa@voia.local");

		const clienteAlheio = await criarCliente("Cliente Calendario Alheio");
		const projetoAlheio = await criarProjeto(clienteAlheio, adminId, "Projeto Calendario Alheio");
		const etapaAlheia = await criarEtapa(projetoAlheio, "Etapa Alheia Calendario");
		await env.DB.prepare(
			"UPDATE projeto_etapas SET data_fim_prevista = date('now', '+2 days') WHERE id = ?",
		)
			.bind(etapaAlheia)
			.run();

		const res = await app.request("/api/calendario", { headers: { cookie: cookieParceiro } }, env);
		const body = await res.json<{ eventos: { titulo: string }[] }>();
		expect(body.eventos.map((e) => e.titulo)).not.toContain("Etapa Alheia Calendario");
		void parceiroId;
	});

	it("Parceiro vê etapa do próprio projeto no calendário", async () => {
		const adminId = await criarUsuario("admin-cal-propria@voia.local", "administrador");
		const parceiroId = await criarUsuario("parceiro-cal-propria@voia.local", "colaborador");
		const cookieParceiro = await loginComo("parceiro-cal-propria@voia.local");

		const clienteId = await criarCliente("Cliente Calendario Propria");
		const projetoId = await criarProjeto(clienteId, adminId, "Projeto Calendario Propria");
		await vincularMembro(projetoId, parceiroId);
		const etapaId = await criarEtapa(projetoId, "Etapa Propria Calendario");
		await env.DB.prepare("UPDATE projeto_etapas SET data_fim_prevista = date('now', '+3 days') WHERE id = ?")
			.bind(etapaId)
			.run();

		const res = await app.request("/api/calendario", { headers: { cookie: cookieParceiro } }, env);
		const body = await res.json<{ eventos: { titulo: string }[] }>();
		expect(body.eventos.map((e) => e.titulo)).toContain("Etapa Propria Calendario");
	});

	it("Parceiro A não vê pagamento programado do Parceiro B no calendário", async () => {
		const adminId = await criarUsuario("admin-cal-pagamento@voia.local", "administrador");
		const parceiroA = await criarUsuario("parceiro-cal-pagamento-a@voia.local", "colaborador");
		const parceiroB = await criarUsuario("parceiro-cal-pagamento-b@voia.local", "colaborador");
		const cookieAdmin = await loginComo("admin-cal-pagamento@voia.local");
		const cookieA = await loginComo("parceiro-cal-pagamento-a@voia.local");

		const clienteId = await criarCliente("Cliente Calendario Pagamento");
		const projetoId = await criarProjeto(clienteId, adminId, "Projeto Calendario Pagamento");
		await vincularMembro(projetoId, parceiroA);
		await vincularMembro(projetoId, parceiroB);

		const remB = await app.request(
			`/api/financeiro/projetos/${projetoId}/remuneracoes`,
			jsonRequest("POST", { parceiro_id: parceiroB, tipo: "fixo", valor_acordado: 100000 }, cookieAdmin),
			env,
		);
		const { remuneracao } = await remB.json<{ remuneracao: { id: number } }>();
		await app.request(
			`/api/financeiro/remuneracoes/${remuneracao.id}/pagamentos`,
			jsonRequest("POST", { valor: 50000, data_programada: "9999-01-01" }, cookieAdmin),
			env,
		);

		const res = await app.request("/api/calendario", { headers: { cookie: cookieA } }, env);
		const body = await res.json<{ eventos: unknown[] }>();
		// 9999-01-01 está fora da janela de 60 dias, então o teste real é: não
		// quebra e não inclui nada do parceiro B. Verificamos com uma data
		// dentro da janela também.
		expect(Array.isArray(body.eventos)).toBe(true);

		const remA = await app.request(
			`/api/financeiro/projetos/${projetoId}/remuneracoes`,
			jsonRequest("POST", { parceiro_id: parceiroA, tipo: "fixo", valor_acordado: 100000 }, cookieAdmin),
			env,
		);
		const { remuneracao: remuneracaoA } = await remA.json<{ remuneracao: { id: number } }>();
		await env.DB.prepare(
			`INSERT INTO projeto_parceiro_pagamentos (remuneracao_id, valor, data_programada, status) VALUES (?, ?, date('now', '+5 days'), 'programado')`,
		)
			.bind(remuneracaoA.id, 70000)
			.run();
		await env.DB.prepare(
			`INSERT INTO projeto_parceiro_pagamentos (remuneracao_id, valor, data_programada, status) VALUES (?, ?, date('now', '+5 days'), 'programado')`,
		)
			.bind(remuneracao.id, 90000)
			.run();

		const res2 = await app.request("/api/calendario", { headers: { cookie: cookieA } }, env);
		const body2 = await res2.json<{ eventos: { projetoId: number; tipo: string }[] }>();
		const pagamentos = body2.eventos.filter((e) => e.tipo === "pagamento");
		// Só deve haver 1 pagamento no calendário de A (o dele), nunca o de B.
		expect(pagamentos.length).toBe(1);
	});
});

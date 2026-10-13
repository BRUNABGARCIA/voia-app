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

interface Cenario {
	cookieAdmin: string;
	parceiroA: number;
	cookieA: string;
	parceiroB: number;
	cookieB: string;
	remuneracaoA: number;
	remuneracaoB: number;
}

async function montarCenario(sufixo: string): Promise<Cenario> {
	const admin = await criarUsuario(`admin-fin-${sufixo}@voia.local`, "administrador");
	const cookieAdmin = await loginComo(`admin-fin-${sufixo}@voia.local`);

	const parceiroA = await criarUsuario(`parceiro-fin-a-${sufixo}@voia.local`, "colaborador");
	const parceiroB = await criarUsuario(`parceiro-fin-b-${sufixo}@voia.local`, "colaborador");
	const cookieA = await loginComo(`parceiro-fin-a-${sufixo}@voia.local`);
	const cookieB = await loginComo(`parceiro-fin-b-${sufixo}@voia.local`);

	const clienteId = await criarCliente(`Cliente Financeiro ${sufixo}`);
	const projetoId = await criarProjeto(clienteId, admin, `Projeto Financeiro ${sufixo}`);
	await env.DB.prepare("UPDATE projetos SET valor_contratado = 10000000 WHERE id = ?").bind(projetoId).run();
	await vincularMembro(projetoId, parceiroA);
	await vincularMembro(projetoId, parceiroB);

	const criadaA = await app.request(
		`/api/financeiro/projetos/${projetoId}/remuneracoes`,
		jsonRequest("POST", { parceiro_id: parceiroA, tipo: "fixo", valor_acordado: 500000 }, cookieAdmin),
		env,
	);
	const { remuneracao: remA } = await criadaA.json<{ remuneracao: { id: number } }>();

	const criadaB = await app.request(
		`/api/financeiro/projetos/${projetoId}/remuneracoes`,
		jsonRequest("POST", { parceiro_id: parceiroB, tipo: "fixo", valor_acordado: 300000 }, cookieAdmin),
		env,
	);
	const { remuneracao: remB } = await criadaB.json<{ remuneracao: { id: number } }>();

	return { cookieAdmin, parceiroA, cookieA, parceiroB, cookieB, remuneracaoA: remA.id, remuneracaoB: remB.id };
}

describe("Financeiro do Parceiro — remuneração e pagamentos", () => {
	it("Parceiro A lê a própria remuneração em /meus-recebimentos", async () => {
		const cen = await montarCenario("le-propria");
		const res = await app.request("/api/financeiro/meus-recebimentos", { headers: { cookie: cen.cookieA } }, env);
		const body = await res.json<{ remuneracoes: { id: number }[] }>();
		expect(body.remuneracoes.map((r) => r.id)).toEqual([cen.remuneracaoA]);
	});

	it("Parceiro A NÃO lê a remuneração do Parceiro B", async () => {
		const cen = await montarCenario("nao-le-outro");
		const res = await app.request("/api/financeiro/meus-recebimentos", { headers: { cookie: cen.cookieA } }, env);
		const body = await res.json<{ remuneracoes: { id: number }[] }>();
		expect(body.remuneracoes.map((r) => r.id)).not.toContain(cen.remuneracaoB);
	});

	it("Parceiro A não acessa os pagamentos da remuneração do Parceiro B (404)", async () => {
		const cen = await montarCenario("nao-acessa-pagamentos-b");
		const res = await app.request(
			`/api/financeiro/meus-recebimentos/${cen.remuneracaoB}/pagamentos`,
			{ headers: { cookie: cen.cookieA } },
			env,
		);
		expect(res.status).toBe(404);
	});

	it("Parceiro não cria remuneração (403)", async () => {
		const cen = await montarCenario("nao-cria-remuneracao");
		const clienteId = await criarCliente("Cliente extra");
		const projetoId = await criarProjeto(clienteId, cen.parceiroA, "Projeto extra");

		const res = await app.request(
			`/api/financeiro/projetos/${projetoId}/remuneracoes`,
			jsonRequest("POST", { parceiro_id: cen.parceiroA, tipo: "fixo", valor_acordado: 999999 }, cen.cookieA),
			env,
		);
		expect(res.status).toBe(403);
	});

	it("Parceiro não edita remuneração (403), mesmo a própria", async () => {
		const cen = await montarCenario("nao-edita-remuneracao");
		const res = await app.request(
			`/api/financeiro/remuneracoes/${cen.remuneracaoA}`,
			jsonRequest("PATCH", { valor_acordado: 999999 }, cen.cookieA),
			env,
		);
		expect(res.status).toBe(403);
	});

	it("Parceiro não cria pagamento (403)", async () => {
		const cen = await montarCenario("nao-cria-pagamento");
		const res = await app.request(
			`/api/financeiro/remuneracoes/${cen.remuneracaoA}/pagamentos`,
			jsonRequest("POST", { valor: 100000 }, cen.cookieA),
			env,
		);
		expect(res.status).toBe(403);
	});

	it("Parceiro não confirma pagamento como pago (403) — só administrador/gestor", async () => {
		const cen = await montarCenario("nao-confirma-pagamento");
		const criado = await app.request(
			`/api/financeiro/remuneracoes/${cen.remuneracaoA}/pagamentos`,
			jsonRequest("POST", { valor: 200000 }, cen.cookieAdmin),
			env,
		);
		const { pagamento } = await criado.json<{ pagamento: { id: number } }>();

		const tentativa = await app.request(
			`/api/financeiro/pagamentos/${pagamento.id}`,
			jsonRequest("PATCH", { status: "pago" }, cen.cookieA),
			env,
		);
		expect(tentativa.status).toBe(403);

		const confirmado = await app.request(
			`/api/financeiro/pagamentos/${pagamento.id}`,
			jsonRequest("PATCH", { status: "pago" }, cen.cookieAdmin),
			env,
		);
		expect(confirmado.status).toBe(200);
		const row = await env.DB.prepare("SELECT status, confirmado_por_id FROM projeto_parceiro_pagamentos WHERE id = ?")
			.bind(pagamento.id)
			.first<{ status: string; confirmado_por_id: number }>();
		expect(row?.status).toBe("pago");
		expect(row?.confirmado_por_id).not.toBeNull();
	});

	it("saldo a receber é calculado a partir dos pagamentos, nunca de valor_contratado", async () => {
		const cen = await montarCenario("saldo-calculado");
		const pagamento1 = await app.request(
			`/api/financeiro/remuneracoes/${cen.remuneracaoA}/pagamentos`,
			jsonRequest("POST", { valor: 200000 }, cen.cookieAdmin),
			env,
		);
		const { pagamento: p1 } = await pagamento1.json<{ pagamento: { id: number } }>();
		await app.request(`/api/financeiro/pagamentos/${p1.id}`, jsonRequest("PATCH", { status: "pago" }, cen.cookieAdmin), env);

		const resumo = await app.request("/api/financeiro/meus-recebimentos", { headers: { cookie: cen.cookieA } }, env);
		const body = await resumo.json<{ resumo: { totalAcordado: number; totalRecebido: number; saldoAReceber: number } }>();
		expect(body.resumo.totalAcordado).toBe(500000);
		expect(body.resumo.totalRecebido).toBe(200000);
		expect(body.resumo.saldoAReceber).toBe(300000);
	});

	it("nenhum payload do Parceiro contém valor_contratado, faturamento, margem ou lucro", async () => {
		const cen = await montarCenario("sem-dado-comercial");
		const res = await app.request("/api/financeiro/meus-recebimentos", { headers: { cookie: cen.cookieA } }, env);
		const texto = await res.text();
		expect(texto).not.toContain("valor_contratado");
		expect(texto.toLowerCase()).not.toContain("faturamento");
		expect(texto.toLowerCase()).not.toContain("margem");
		expect(texto.toLowerCase()).not.toContain("lucro");
	});

	it("administrador vê a remuneração de qualquer parceiro no projeto", async () => {
		const cen = await montarCenario("admin-ve-tudo");
		const projetoId = await env.DB.prepare("SELECT projeto_id FROM projeto_parceiro_remuneracoes WHERE id = ?")
			.bind(cen.remuneracaoA)
			.first<{ projeto_id: number }>();
		const res = await app.request(
			`/api/financeiro/projetos/${projetoId!.projeto_id}/remuneracoes`,
			{ headers: { cookie: cen.cookieAdmin } },
			env,
		);
		const body = await res.json<{ remuneracoes: { id: number }[] }>();
		const ids = body.remuneracoes.map((r) => r.id);
		expect(ids).toContain(cen.remuneracaoA);
		expect(ids).toContain(cen.remuneracaoB);
	});

	it("GET /parceiros/:usuarioId/remuneracoes (admin) só traz a remuneração daquele parceiro, em qualquer projeto", async () => {
		const cen = await montarCenario("admin-ve-um-parceiro");
		const res = await app.request(
			`/api/financeiro/parceiros/${cen.parceiroA}/remuneracoes`,
			{ headers: { cookie: cen.cookieAdmin } },
			env,
		);
		expect(res.status).toBe(200);
		const body = await res.json<{ remuneracoes: { id: number }[] }>();
		const ids = body.remuneracoes.map((r) => r.id);
		expect(ids).toContain(cen.remuneracaoA);
		expect(ids).not.toContain(cen.remuneracaoB);
	});

	it("GET /parceiros/:usuarioId/remuneracoes é bloqueado para o Parceiro (403)", async () => {
		const cen = await montarCenario("parceiro-nao-acessa-visao-admin");
		const res = await app.request(
			`/api/financeiro/parceiros/${cen.parceiroB}/remuneracoes`,
			{ headers: { cookie: cen.cookieA } },
			env,
		);
		expect(res.status).toBe(403);
	});
});

describe("Financeiro — remuneração só pode ser criada para Parceiro vinculado ao projeto", () => {
	async function montarProjetoAdmin(sufixo: string) {
		const adminId = await criarUsuario(`admin-perfil-${sufixo}@voia.local`, "administrador");
		const cookieAdmin = await loginComo(`admin-perfil-${sufixo}@voia.local`);
		const clienteId = await criarCliente(`Cliente Perfil ${sufixo}`);
		const projetoId = await criarProjeto(clienteId, adminId, `Projeto Perfil ${sufixo}`);
		return { adminId, cookieAdmin, projetoId };
	}

	it("1. Admin cadastra remuneração para Parceiro ativo vinculado ao projeto", async () => {
		const { cookieAdmin, projetoId } = await montarProjetoAdmin("ok");
		const parceiroId = await criarUsuario("parceiro-perfil-ok@voia.local", "colaborador");
		await vincularMembro(projetoId, parceiroId);

		const res = await app.request(
			`/api/financeiro/projetos/${projetoId}/remuneracoes`,
			jsonRequest("POST", { parceiro_id: parceiroId, tipo: "fixo", valor_acordado: 100000 }, cookieAdmin),
			env,
		);
		expect(res.status).toBe(201);
	});

	it("2. Admin NÃO consegue cadastrar remuneração para um administrador", async () => {
		const { cookieAdmin, projetoId } = await montarProjetoAdmin("nega-admin");
		const outroAdminId = await criarUsuario("outro-admin-perfil@voia.local", "administrador");
		await vincularMembro(projetoId, outroAdminId);

		const res = await app.request(
			`/api/financeiro/projetos/${projetoId}/remuneracoes`,
			jsonRequest("POST", { parceiro_id: outroAdminId, tipo: "fixo", valor_acordado: 100000 }, cookieAdmin),
			env,
		);
		expect(res.status).toBe(400);
		const vazio = await env.DB.prepare("SELECT COUNT(*) AS n FROM projeto_parceiro_remuneracoes WHERE parceiro_id = ?")
			.bind(outroAdminId)
			.first<{ n: number }>();
		expect(vazio?.n).toBe(0);
	});

	it("3. Admin NÃO consegue cadastrar remuneração para um gestor", async () => {
		const { cookieAdmin, projetoId } = await montarProjetoAdmin("nega-gestor");
		const gestorId = await criarUsuario("gestor-perfil@voia.local", "gestor");
		await vincularMembro(projetoId, gestorId);

		const res = await app.request(
			`/api/financeiro/projetos/${projetoId}/remuneracoes`,
			jsonRequest("POST", { parceiro_id: gestorId, tipo: "fixo", valor_acordado: 100000 }, cookieAdmin),
			env,
		);
		expect(res.status).toBe(400);
	});

	it("4. Admin NÃO consegue cadastrar remuneração para Parceiro que não está vinculado ao projeto", async () => {
		const { cookieAdmin, projetoId } = await montarProjetoAdmin("nega-nao-vinculado");
		const parceiroForaId = await criarUsuario("parceiro-fora-perfil@voia.local", "colaborador");
		// Nunca vinculado via vincularMembro — perfil correto, mas sem vínculo com este projeto.

		const res = await app.request(
			`/api/financeiro/projetos/${projetoId}/remuneracoes`,
			jsonRequest("POST", { parceiro_id: parceiroForaId, tipo: "fixo", valor_acordado: 100000 }, cookieAdmin),
			env,
		);
		expect(res.status).toBe(400);
	});

	it("5. Parceiro continua sem poder criar a própria remuneração, mesmo vinculado ao projeto", async () => {
		const { projetoId } = await montarProjetoAdmin("parceiro-nao-cria-proprio");
		const parceiroId = await criarUsuario("parceiro-proprio-perfil@voia.local", "colaborador");
		await vincularMembro(projetoId, parceiroId);
		const cookieParceiro = await loginComo("parceiro-proprio-perfil@voia.local");

		const res = await app.request(
			`/api/financeiro/projetos/${projetoId}/remuneracoes`,
			jsonRequest("POST", { parceiro_id: parceiroId, tipo: "fixo", valor_acordado: 100000 }, cookieParceiro),
			env,
		);
		expect(res.status).toBe(403);
	});

	it("6. Alterar o parceiro_id via PATCH não contorna a validação de perfil/vínculo", async () => {
		const { cookieAdmin, projetoId } = await montarProjetoAdmin("patch-nao-contorna");
		const parceiroId = await criarUsuario("parceiro-patch-perfil@voia.local", "colaborador");
		await vincularMembro(projetoId, parceiroId);
		const outroAdminId = await criarUsuario("admin-patch-perfil@voia.local", "administrador");

		const criada = await app.request(
			`/api/financeiro/projetos/${projetoId}/remuneracoes`,
			jsonRequest("POST", { parceiro_id: parceiroId, tipo: "fixo", valor_acordado: 100000 }, cookieAdmin),
			env,
		);
		const { remuneracao } = await criada.json<{ remuneracao: { id: number } }>();

		// patchRemuneracaoSchema não tem parceiro_id — mesmo enviando, o campo
		// é descartado pelo zod e nunca chega à query de UPDATE.
		const patch = await app.request(
			`/api/financeiro/remuneracoes/${remuneracao.id}`,
			jsonRequest("PATCH", { parceiro_id: outroAdminId, valor_acordado: 200000 }, cookieAdmin),
			env,
		);
		expect(patch.status).toBe(200);

		const row = await env.DB.prepare("SELECT parceiro_id, valor_acordado FROM projeto_parceiro_remuneracoes WHERE id = ?")
			.bind(remuneracao.id)
			.first<{ parceiro_id: number; valor_acordado: number }>();
		expect(row?.parceiro_id).toBe(parceiroId);
		expect(row?.valor_acordado).toBe(200000);
	});
});

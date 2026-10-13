import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/worker/index";
import { SESSION_COOKIE_NAME } from "../../src/worker/auth/session";
import {
	criarCliente,
	criarDocumento,
	criarEtapa,
	criarProjeto,
	criarTarefa,
	criarUsuario,
	vincularMembro,
} from "../helpers/fixtures";
import { extrairCookie, jsonRequest } from "../helpers/http";

/**
 * Regressão completa da Rodada 03 (Experiência e Segurança do Parceiro):
 * Parceiro A só acessa o que é dele, nunca o de Parceiro B, mesmo trocando
 * IDs manualmente — e nenhum payload que chega a ele contém valor
 * contratado, faturamento, margem ou lucro. Cada teste usa um cenário
 * próprio (e-mails únicos) porque o isolamento de storage do
 * @cloudflare/vitest-plugin é por ARQUIVO, não por teste (ver
 * test/isolamento.test.ts).
 */
async function loginComo(email: string, senha = "senha-padrao-teste"): Promise<string> {
	const res = await app.request("/api/auth/login", jsonRequest("POST", { email, senha }), env);
	return extrairCookie(res, SESSION_COOKIE_NAME)!;
}

interface Cenario {
	admin: number;
	cookieAdmin: string;
	parceiroA: number;
	cookieA: string;
	parceiroB: number;
	cookieB: string;
	clienteA: number;
	clienteB: number;
	projetoA: number;
	projetoB: number;
	etapaA: number;
	etapaB: number;
	tarefaA: number;
	tarefaB: number;
	documentoA: number;
	documentoB: number;
}

async function montarCenario(sufixo: string): Promise<Cenario> {
	const admin = await criarUsuario(`admin-${sufixo}@voia.local`, "administrador");
	const cookieAdmin = await loginComo(`admin-${sufixo}@voia.local`);

	const parceiroA = await criarUsuario(`parceiro-a-${sufixo}@voia.local`, "colaborador");
	const parceiroB = await criarUsuario(`parceiro-b-${sufixo}@voia.local`, "colaborador");
	const cookieA = await loginComo(`parceiro-a-${sufixo}@voia.local`);
	const cookieB = await loginComo(`parceiro-b-${sufixo}@voia.local`);

	const clienteA = await criarCliente(`Cliente A ${sufixo}`);
	const clienteB = await criarCliente(`Cliente B ${sufixo}`);

	const projetoA = await criarProjeto(clienteA, admin, `Projeto A ${sufixo}`);
	const projetoB = await criarProjeto(clienteB, admin, `Projeto B ${sufixo}`);

	await vincularMembro(projetoA, parceiroA);
	await vincularMembro(projetoB, parceiroB);

	// valor_contratado real nos dois projetos — nunca deve aparecer em
	// nenhuma resposta destinada a um Parceiro.
	await env.DB.prepare("UPDATE projetos SET valor_contratado = 500000 WHERE id IN (?, ?)").bind(projetoA, projetoB).run();

	const etapaA = await criarEtapa(projetoA, `Etapa A ${sufixo}`);
	const etapaB = await criarEtapa(projetoB, `Etapa B ${sufixo}`);
	const tarefaA = await criarTarefa(projetoA, etapaA, `Tarefa A ${sufixo}`);
	const tarefaB = await criarTarefa(projetoB, etapaB, `Tarefa B ${sufixo}`);
	const documentoA = await criarDocumento(projetoA, admin, `Documento A ${sufixo}`);
	const documentoB = await criarDocumento(projetoB, admin, `Documento B ${sufixo}`);

	return {
		admin,
		cookieAdmin,
		parceiroA,
		cookieA,
		parceiroB,
		cookieB,
		clienteA,
		clienteB,
		projetoA,
		projetoB,
		etapaA,
		etapaB,
		tarefaA,
		tarefaB,
		documentoA,
		documentoB,
	};
}

describe("Parceiro A consegue acessar o que é dele", () => {
	it("lista o Projeto A na listagem de projetos", async () => {
		const cen = await montarCenario("lista-propria");
		const res = await app.request("/api/projetos", { headers: { cookie: cen.cookieA } }, env);
		const body = await res.json<{ projetos: { id: number }[] }>();
		expect(body.projetos.map((p) => p.id)).toEqual([cen.projetoA]);
	});

	it("acessa o detalhe do Projeto A", async () => {
		const cen = await montarCenario("detalhe-proprio");
		const res = await app.request(`/api/projetos/${cen.projetoA}`, { headers: { cookie: cen.cookieA } }, env);
		expect(res.status).toBe(200);
	});

	it("acessa etapas, tarefas e documentos do Projeto A", async () => {
		const cen = await montarCenario("subrecursos-proprios");
		const [etapas, tarefas, docs] = await Promise.all([
			app.request(`/api/projetos/${cen.projetoA}/etapas`, { headers: { cookie: cen.cookieA } }, env),
			app.request(`/api/projetos/${cen.projetoA}/tarefas`, { headers: { cookie: cen.cookieA } }, env),
			app.request(`/api/projetos/${cen.projetoA}/documentos`, { headers: { cookie: cen.cookieA } }, env),
		]);
		expect(etapas.status).toBe(200);
		expect(tarefas.status).toBe(200);
		expect(docs.status).toBe(200);
	});

	it("acessa o cliente do Projeto A", async () => {
		const cen = await montarCenario("cliente-proprio");
		const res = await app.request(`/api/clientes/${cen.clienteA}`, { headers: { cookie: cen.cookieA } }, env);
		expect(res.status).toBe(200);
	});
});

describe("Parceiro A NUNCA acessa o que é do Parceiro B", () => {
	it("não lista o Projeto B na listagem de projetos", async () => {
		const cen = await montarCenario("nao-lista-b");
		const res = await app.request("/api/projetos", { headers: { cookie: cen.cookieA } }, env);
		const body = await res.json<{ projetos: { id: number }[] }>();
		expect(body.projetos.map((p) => p.id)).not.toContain(cen.projetoB);
	});

	it("não acessa o Projeto B diretamente pelo ID (404, não 403 — anti-enumeração)", async () => {
		const cen = await montarCenario("nao-acessa-b-id");
		const res = await app.request(`/api/projetos/${cen.projetoB}`, { headers: { cookie: cen.cookieA } }, env);
		expect(res.status).toBe(404);
	});

	it("não lê etapas, tarefas, documentos ou membros do Projeto B pelo ID", async () => {
		const cen = await montarCenario("nao-le-subrecursos-b");
		const [etapas, tarefas, docs, membros] = await Promise.all([
			app.request(`/api/projetos/${cen.projetoB}/etapas`, { headers: { cookie: cen.cookieA } }, env),
			app.request(`/api/projetos/${cen.projetoB}/tarefas`, { headers: { cookie: cen.cookieA } }, env),
			app.request(`/api/projetos/${cen.projetoB}/documentos`, { headers: { cookie: cen.cookieA } }, env),
			app.request(`/api/projetos/${cen.projetoB}/membros`, { headers: { cookie: cen.cookieA } }, env),
		]);
		expect(etapas.status).toBe(404);
		expect(tarefas.status).toBe(404);
		expect(docs.status).toBe(404);
		expect(membros.status).toBe(404);
	});

	it("não altera a etapa do Projeto B mesmo sabendo o etapaId real", async () => {
		const cen = await montarCenario("nao-altera-etapa-b");
		const res = await app.request(
			`/api/projetos/${cen.projetoB}/etapas/${cen.etapaB}`,
			jsonRequest("PATCH", { nome: "Invadido" }, cen.cookieA),
			env,
		);
		expect(res.status).toBe(404);
		const etapa = await env.DB.prepare("SELECT nome FROM projeto_etapas WHERE id = ?").bind(cen.etapaB).first<{ nome: string }>();
		expect(etapa?.nome).not.toBe("Invadido");
	});

	it("não altera a tarefa do Projeto B mesmo sabendo o tarefaId real", async () => {
		const cen = await montarCenario("nao-altera-tarefa-b");
		const res = await app.request(
			`/api/projetos/${cen.projetoB}/tarefas/${cen.tarefaB}`,
			jsonRequest("PATCH", { nome: "Invadido" }, cen.cookieA),
			env,
		);
		expect(res.status).toBe(404);
		const tarefa = await env.DB.prepare("SELECT nome FROM projeto_tarefas WHERE id = ?").bind(cen.tarefaB).first<{ nome: string }>();
		expect(tarefa?.nome).not.toBe("Invadido");
	});

	it("não altera o metadado de documento do Projeto B mesmo sabendo o documentoId real", async () => {
		const cen = await montarCenario("nao-altera-doc-b");
		const res = await app.request(
			`/api/projetos/${cen.projetoB}/documentos/${cen.documentoB}`,
			jsonRequest("PATCH", { nome: "Invadido" }, cen.cookieA),
			env,
		);
		expect(res.status).toBe(404);
	});

	it("não baixa o arquivo de um documento do Projeto B", async () => {
		const cen = await montarCenario("nao-baixa-doc-b");
		const res = await app.request(
			`/api/projetos/${cen.projetoB}/documentos/${cen.documentoB}/download`,
			{ headers: { cookie: cen.cookieA } },
			env,
		);
		expect(res.status).toBe(404);
	});

	it("não cria etapa, tarefa, documento nem atualização no Projeto B", async () => {
		const cen = await montarCenario("nao-cria-no-b");
		const [etapa, tarefa, atualizacao] = await Promise.all([
			app.request(`/api/projetos/${cen.projetoB}/etapas`, jsonRequest("POST", { nome: "Invasão" }, cen.cookieA), env),
			app.request(
				`/api/projetos/${cen.projetoB}/etapas/${cen.etapaB}/tarefas`,
				jsonRequest("POST", { nome: "Invasão" }, cen.cookieA),
				env,
			),
			app.request(
				`/api/projetos/${cen.projetoB}/atualizacoes`,
				jsonRequest("POST", { titulo: "Invasão" }, cen.cookieA),
				env,
			),
		]);
		expect(etapa.status).toBe(404);
		expect(tarefa.status).toBe(404);
		expect(atualizacao.status).toBe(404);
	});

	it("não acessa o cliente exclusivo do Projeto B (404, não 403)", async () => {
		const cen = await montarCenario("nao-acessa-cliente-b");
		const res = await app.request(`/api/clientes/${cen.clienteB}`, { headers: { cookie: cen.cookieA } }, env);
		expect(res.status).toBe(404);
	});

	it("não vê o cliente B na listagem de clientes", async () => {
		const cen = await montarCenario("nao-lista-cliente-b");
		const res = await app.request("/api/clientes", { headers: { cookie: cen.cookieA } }, env);
		const body = await res.json<{ clientes: { id: number }[] }>();
		expect(body.clientes.map((cl) => cl.id)).toEqual([cen.clienteA]);
	});

	it("trocar só o :id na URL nunca transforma uma chamada proibida em permitida (varredura de todas as rotas de sub-recurso)", async () => {
		const cen = await montarCenario("varredura-ids");
		const rotas = [
			["GET", `/api/projetos/${cen.projetoB}`],
			["GET", `/api/projetos/${cen.projetoB}/etapas`],
			["GET", `/api/projetos/${cen.projetoB}/tarefas`],
			["GET", `/api/projetos/${cen.projetoB}/atualizacoes`],
			["GET", `/api/projetos/${cen.projetoB}/documentos`],
			["GET", `/api/projetos/${cen.projetoB}/membros`],
			["GET", `/api/projetos/${cen.projetoB}/tipos-servico-disponiveis`],
		] as const;
		for (const [metodo, caminho] of rotas) {
			const res = await app.request(caminho, { method: metodo, headers: { cookie: cen.cookieA } }, env);
			expect(res.status, `${metodo} ${caminho} deveria ser 404`).toBe(404);
		}
	});
});

describe("Nenhum payload para Parceiro contém dado comercial", () => {
	it("GET /api/projetos nunca inclui valor_contratado nem observacoes", async () => {
		const cen = await montarCenario("sem-valor-lista");
		const res = await app.request("/api/projetos", { headers: { cookie: cen.cookieA } }, env);
		const body = await res.json<{ projetos: Record<string, unknown>[] }>();
		expect(body.projetos.length).toBeGreaterThan(0);
		for (const projeto of body.projetos) {
			expect(projeto).not.toHaveProperty("valor_contratado");
			expect(projeto).not.toHaveProperty("observacoes");
		}
	});

	it("GET /api/projetos/:id nunca inclui valor_contratado nem observacoes", async () => {
		const cen = await montarCenario("sem-valor-detalhe");
		const res = await app.request(`/api/projetos/${cen.projetoA}`, { headers: { cookie: cen.cookieA } }, env);
		const body = await res.json<{ projeto: Record<string, unknown> }>();
		expect(body.projeto).not.toHaveProperty("valor_contratado");
		expect(body.projeto).not.toHaveProperty("observacoes");
	});

	it("PATCH /api/projetos/:id ignora valor_contratado enviado pelo Parceiro (não persiste, não devolve)", async () => {
		const cen = await montarCenario("ignora-valor-patch");
		const res = await app.request(
			`/api/projetos/${cen.projetoA}`,
			jsonRequest("PATCH", { nome: "Projeto A renomeado", valor_contratado: 999999999 }, cen.cookieA),
			env,
		);
		expect(res.status).toBe(200);
		const body = await res.json<{ projeto: Record<string, unknown> }>();
		expect(body.projeto).not.toHaveProperty("valor_contratado");

		const row = await env.DB.prepare("SELECT valor_contratado FROM projetos WHERE id = ?")
			.bind(cen.projetoA)
			.first<{ valor_contratado: number }>();
		expect(row?.valor_contratado).toBe(500000); // valor original da migração do cenário, não o valor injetado
	});

	it("cliente visível ao Parceiro nunca inclui responsavel_interno_id nem observacoes", async () => {
		const cen = await montarCenario("sem-admin-cliente");
		const res = await app.request(`/api/clientes/${cen.clienteA}`, { headers: { cookie: cen.cookieA } }, env);
		const body = await res.json<{ cliente: Record<string, unknown> }>();
		expect(body.cliente).not.toHaveProperty("responsavel_interno_id");
		expect(body.cliente).not.toHaveProperty("responsavel_interno_nome");
		expect(body.cliente).not.toHaveProperty("observacoes");
	});

	it("dashboard do Parceiro não contém nenhum indicador global da empresa", async () => {
		const cen = await montarCenario("dashboard-sem-global");
		const res = await app.request("/api/dashboard", { headers: { cookie: cen.cookieA } }, env);
		const body = await res.json<Record<string, unknown>>();
		expect(body.tipo).toBe("parceiro");
		expect(body).not.toHaveProperty("clientesAtivos");
		expect(body).not.toHaveProperty("projetosEmAndamento");
		expect(body).not.toHaveProperty("projetosSemResponsavel");
	});
});

describe("Parceiro B tem isolamento equivalente (não é um caso especial do A)", () => {
	it("lista só o Projeto B, nunca o A", async () => {
		const cen = await montarCenario("simetria-b");
		const res = await app.request("/api/projetos", { headers: { cookie: cen.cookieB } }, env);
		const body = await res.json<{ projetos: { id: number }[] }>();
		expect(body.projetos.map((p) => p.id)).toEqual([cen.projetoB]);
	});

	it("não acessa o Projeto A nem o cliente A", async () => {
		const cen = await montarCenario("simetria-b-bloqueios");
		const [projeto, cliente] = await Promise.all([
			app.request(`/api/projetos/${cen.projetoA}`, { headers: { cookie: cen.cookieB } }, env),
			app.request(`/api/clientes/${cen.clienteA}`, { headers: { cookie: cen.cookieB } }, env),
		]);
		expect(projeto.status).toBe(404);
		expect(cliente.status).toBe(404);
	});
});

describe("Administrador continua com acesso total (nada quebrou para ele)", () => {
	it("lista todos os projetos, incluindo A e B", async () => {
		const cen = await montarCenario("admin-continua");
		const res = await app.request("/api/projetos", { headers: { cookie: cen.cookieAdmin } }, env);
		const body = await res.json<{ projetos: { id: number }[] }>();
		const ids = body.projetos.map((p) => p.id);
		expect(ids).toContain(cen.projetoA);
		expect(ids).toContain(cen.projetoB);
	});

	it("vê valor_contratado no detalhe do projeto", async () => {
		const cen = await montarCenario("admin-ve-valor");
		const res = await app.request(`/api/projetos/${cen.projetoA}`, { headers: { cookie: cen.cookieAdmin } }, env);
		const body = await res.json<{ projeto: Record<string, unknown> }>();
		expect(body.projeto.valor_contratado).toBe(500000);
	});

	it("acessa qualquer cliente, mesmo sem vínculo de projeto_membros", async () => {
		const cen = await montarCenario("admin-acessa-cliente");
		const res = await app.request(`/api/clientes/${cen.clienteA}`, { headers: { cookie: cen.cookieAdmin } }, env);
		expect(res.status).toBe(200);
	});
});

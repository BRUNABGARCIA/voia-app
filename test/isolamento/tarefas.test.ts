import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/worker/index";
import { SESSION_COOKIE_NAME } from "../../src/worker/auth/session";
import { criarCliente, criarEtapa, criarProjeto, criarUsuario, criarTarefa, vincularMembro } from "../helpers/fixtures";
import { extrairCookie, jsonRequest } from "../helpers/http";

async function loginComo(email: string): Promise<string> {
	const res = await app.request("/api/auth/login", jsonRequest("POST", { email, senha: "senha-padrao-teste" }), env);
	return extrairCookie(res, SESSION_COOKIE_NAME)!;
}

describe("Tarefas — criação sem etapa (migration 0024)", () => {
	it("admin cria tarefa de projeto sem etapa_id", async () => {
		const adminId = await criarUsuario("admin-tarefa-sem-etapa@voia.local", "administrador");
		const cookieAdmin = await loginComo("admin-tarefa-sem-etapa@voia.local");
		const clienteId = await criarCliente("Cliente Tarefa Sem Etapa");
		const projetoId = await criarProjeto(clienteId, adminId, "Projeto Tarefa Sem Etapa");

		const res = await app.request(
			`/api/projetos/${projetoId}/tarefas`,
			jsonRequest("POST", { nome: "Tarefa geral do projeto" }, cookieAdmin),
			env,
		);
		expect(res.status).toBe(201);
		const { tarefa } = await res.json<{ tarefa: { id: number; etapa_id: number | null; criado_por_id: number } }>();
		expect(tarefa.etapa_id).toBeNull();
		expect(tarefa.criado_por_id).toBe(adminId);
	});

	it("tarefa criada com etapa_id grava criado_por_id", async () => {
		const adminId = await criarUsuario("admin-tarefa-criado-por@voia.local", "administrador");
		const cookieAdmin = await loginComo("admin-tarefa-criado-por@voia.local");
		const clienteId = await criarCliente("Cliente Criado Por");
		const projetoId = await criarProjeto(clienteId, adminId, "Projeto Criado Por");
		const etapaId = await criarEtapa(projetoId, "Etapa 1");

		const res = await app.request(
			`/api/projetos/${projetoId}/etapas/${etapaId}/tarefas`,
			jsonRequest("POST", { nome: "Tarefa da etapa" }, cookieAdmin),
			env,
		);
		const { tarefa } = await res.json<{ tarefa: { criado_por_id: number } }>();
		expect(tarefa.criado_por_id).toBe(adminId);
	});
});

describe("Tarefas — Parceiro não atribui responsável fora do escopo", () => {
	it("Parceiro NÃO pode atribuir tarefa a usuário fora do projeto", async () => {
		const adminId = await criarUsuario("admin-tarefa-escopo@voia.local", "administrador");
		const parceiroId = await criarUsuario("parceiro-tarefa-escopo@voia.local", "colaborador");
		const foraId = await criarUsuario("fora-tarefa-escopo@voia.local", "colaborador");
		const cookieParceiro = await loginComo("parceiro-tarefa-escopo@voia.local");
		const clienteId = await criarCliente("Cliente Escopo Tarefa");
		const projetoId = await criarProjeto(clienteId, adminId, "Projeto Escopo Tarefa");
		await vincularMembro(projetoId, parceiroId);
		// foraId nunca é vinculado a este projeto.

		const res = await app.request(
			`/api/projetos/${projetoId}/tarefas`,
			jsonRequest("POST", { nome: "Tarefa suspeita", responsavel_id: foraId }, cookieParceiro),
			env,
		);
		expect(res.status).toBe(400);
	});

	it("Parceiro PODE atribuir tarefa a outro membro do mesmo projeto", async () => {
		const adminId = await criarUsuario("admin-tarefa-escopo-ok@voia.local", "administrador");
		const parceiroId = await criarUsuario("parceiro-tarefa-escopo-ok@voia.local", "colaborador");
		const outroMembroId = await criarUsuario("outro-membro-escopo-ok@voia.local", "colaborador");
		const cookieParceiro = await loginComo("parceiro-tarefa-escopo-ok@voia.local");
		const clienteId = await criarCliente("Cliente Escopo Tarefa Ok");
		const projetoId = await criarProjeto(clienteId, adminId, "Projeto Escopo Tarefa Ok");
		await vincularMembro(projetoId, parceiroId);
		await vincularMembro(projetoId, outroMembroId);

		const res = await app.request(
			`/api/projetos/${projetoId}/tarefas`,
			jsonRequest("POST", { nome: "Tarefa ok", responsavel_id: outroMembroId }, cookieParceiro),
			env,
		);
		expect(res.status).toBe(201);
	});

	it("admin continua podendo atribuir a qualquer usuário, sem exigir vínculo", async () => {
		const adminId = await criarUsuario("admin-tarefa-livre@voia.local", "administrador");
		const cookieAdmin = await loginComo("admin-tarefa-livre@voia.local");
		const foraId = await criarUsuario("fora-tarefa-livre@voia.local", "colaborador");
		const clienteId = await criarCliente("Cliente Livre");
		const projetoId = await criarProjeto(clienteId, adminId, "Projeto Livre");

		const res = await app.request(
			`/api/projetos/${projetoId}/tarefas`,
			jsonRequest("POST", { nome: "Tarefa livre", responsavel_id: foraId }, cookieAdmin),
			env,
		);
		expect(res.status).toBe(201);
	});
});

describe("Tarefas — Meu Dia (GET /api/tarefas/meu-dia)", () => {
	it("só retorna tarefas atribuídas ao próprio usuário autenticado", async () => {
		const adminId = await criarUsuario("admin-meu-dia@voia.local", "administrador");
		const parceiroA = await criarUsuario("parceiro-meu-dia-a@voia.local", "colaborador");
		const parceiroB = await criarUsuario("parceiro-meu-dia-b@voia.local", "colaborador");
		const cookieA = await loginComo("parceiro-meu-dia-a@voia.local");
		const clienteId = await criarCliente("Cliente Meu Dia");
		const projetoId = await criarProjeto(clienteId, adminId, "Projeto Meu Dia");
		await vincularMembro(projetoId, parceiroA);
		await vincularMembro(projetoId, parceiroB);
		const etapaId = await criarEtapa(projetoId, "Etapa Meu Dia");
		const tarefaDeA = await criarTarefa(projetoId, etapaId, "Tarefa de A");
		const tarefaDeB = await criarTarefa(projetoId, etapaId, "Tarefa de B");
		await env.DB.prepare("UPDATE projeto_tarefas SET responsavel_id = ?, status = 'pendente' WHERE id = ?")
			.bind(parceiroA, tarefaDeA)
			.run();
		await env.DB.prepare("UPDATE projeto_tarefas SET responsavel_id = ?, status = 'pendente' WHERE id = ?")
			.bind(parceiroB, tarefaDeB)
			.run();

		const res = await app.request("/api/tarefas/meu-dia", { headers: { cookie: cookieA } }, env);
		const body = await res.json<{ proximas: { id: number }[] }>();
		const ids = body.proximas.map((t) => t.id);
		expect(ids).toContain(tarefaDeA);
		expect(ids).not.toContain(tarefaDeB);
	});
});

describe("Tarefas — Kanban (GET /api/tarefas) escopado por Parceiro", () => {
	it("Parceiro só vê tarefas dos projetos em que é membro", async () => {
		const adminId = await criarUsuario("admin-kanban@voia.local", "administrador");
		const parceiroId = await criarUsuario("parceiro-kanban@voia.local", "colaborador");
		const cookieParceiro = await loginComo("parceiro-kanban@voia.local");

		const clienteMeu = await criarCliente("Cliente Kanban Meu");
		const projetoMeu = await criarProjeto(clienteMeu, adminId, "Projeto Kanban Meu");
		await vincularMembro(projetoMeu, parceiroId);
		const etapaMinha = await criarEtapa(projetoMeu, "Etapa Minha");
		const tarefaMinha = await criarTarefa(projetoMeu, etapaMinha, "Tarefa minha");

		const clienteAlheio = await criarCliente("Cliente Kanban Alheio");
		const projetoAlheio = await criarProjeto(clienteAlheio, adminId, "Projeto Kanban Alheio");
		const etapaAlheia = await criarEtapa(projetoAlheio, "Etapa Alheia");
		const tarefaAlheia = await criarTarefa(projetoAlheio, etapaAlheia, "Tarefa alheia");

		const res = await app.request("/api/tarefas", { headers: { cookie: cookieParceiro } }, env);
		const body = await res.json<{ tarefas: { id: number }[] }>();
		const ids = body.tarefas.map((t) => t.id);
		expect(ids).toContain(tarefaMinha);
		expect(ids).not.toContain(tarefaAlheia);
	});

	it("filtro de status=cancelada só aparece quando pedido explicitamente", async () => {
		const adminId = await criarUsuario("admin-kanban-cancelada@voia.local", "administrador");
		const cookieAdmin = await loginComo("admin-kanban-cancelada@voia.local");
		const clienteId = await criarCliente("Cliente Kanban Cancelada");
		const projetoId = await criarProjeto(clienteId, adminId, "Projeto Kanban Cancelada");
		const etapaId = await criarEtapa(projetoId, "Etapa Cancelada");
		const tarefaId = await criarTarefa(projetoId, etapaId, "Tarefa cancelada");
		await env.DB.prepare("UPDATE projeto_tarefas SET status = 'cancelada' WHERE id = ?").bind(tarefaId).run();

		const semFiltro = await app.request(
			`/api/tarefas?projeto_id=${projetoId}`,
			{ headers: { cookie: cookieAdmin } },
			env,
		);
		const bodySemFiltro = await semFiltro.json<{ tarefas: { id: number }[] }>();
		expect(bodySemFiltro.tarefas.map((t) => t.id)).not.toContain(tarefaId);

		const comFiltro = await app.request(
			`/api/tarefas?projeto_id=${projetoId}&status=cancelada`,
			{ headers: { cookie: cookieAdmin } },
			env,
		);
		const bodyComFiltro = await comFiltro.json<{ tarefas: { id: number }[] }>();
		expect(bodyComFiltro.tarefas.map((t) => t.id)).toContain(tarefaId);
	});
});

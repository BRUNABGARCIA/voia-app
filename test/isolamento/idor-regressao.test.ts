import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/worker/index";
import { SESSION_COOKIE_NAME } from "../../src/worker/auth/session";
import { criarCliente, criarDocumento, criarEtapa, criarProjeto, criarTarefa, criarUsuario } from "../helpers/fixtures";
import { extrairCookie, jsonRequest } from "../helpers/http";

/**
 * Regressão da defesa em profundidade adicionada nesta rodada: as rotas de
 * PATCH de etapa/tarefa/documento (projetos/routes.ts) e de contato
 * (clientes/routes.ts) agora escopam o UPDATE final por `AND projeto_id = ?`
 * / `AND cliente_id = ?`, não só pela verificação SELECT anterior. Estes
 * testes atacam exatamente o cenário que a defesa em profundidade cobre:
 * um :id de sub-recurso real, mas sob o :id de OUTRO projeto/cliente na URL.
 */
async function loginComo(email: string): Promise<string> {
	const res = await app.request("/api/auth/login", jsonRequest("POST", { email, senha: "senha-padrao-teste" }), env);
	return extrairCookie(res, SESSION_COOKIE_NAME)!;
}

describe("defesa em profundidade — sub-recursos de projeto não vazam entre projetos", () => {
	it("PATCH de etapa com :id de outro projeto não encontra nem altera a etapa", async () => {
		const admin = await criarUsuario("idor-etapa@voia.local", "administrador");
		const cookie = await loginComo("idor-etapa@voia.local");
		const clienteId = await criarCliente("Cliente IDOR Etapa");
		const projetoA = await criarProjeto(clienteId, admin, "Projeto A");
		const projetoB = await criarProjeto(clienteId, admin, "Projeto B");
		const etapaDoA = await criarEtapa(projetoA, "Etapa do projeto A");

		// :id da URL é o projeto B, mas etapaId pertence ao projeto A.
		const res = await app.request(
			`/api/projetos/${projetoB}/etapas/${etapaDoA}`,
			jsonRequest("PATCH", { nome: "Nome alterado via IDOR" }, cookie),
			env,
		);
		expect(res.status).toBe(404);

		const etapa = await env.DB.prepare("SELECT nome FROM projeto_etapas WHERE id = ?").bind(etapaDoA).first<{ nome: string }>();
		expect(etapa?.nome).toBe("Etapa do projeto A");
	});

	it("PATCH de tarefa com :id de outro projeto não encontra nem altera a tarefa", async () => {
		const admin = await criarUsuario("idor-tarefa@voia.local", "administrador");
		const cookie = await loginComo("idor-tarefa@voia.local");
		const clienteId = await criarCliente("Cliente IDOR Tarefa");
		const projetoA = await criarProjeto(clienteId, admin, "Projeto A Tarefa");
		const projetoB = await criarProjeto(clienteId, admin, "Projeto B Tarefa");
		const etapaDoA = await criarEtapa(projetoA, "Etapa A");
		const tarefaDoA = await criarTarefa(projetoA, etapaDoA, "Tarefa do projeto A");

		const res = await app.request(
			`/api/projetos/${projetoB}/tarefas/${tarefaDoA}`,
			jsonRequest("PATCH", { nome: "Nome alterado via IDOR" }, cookie),
			env,
		);
		expect(res.status).toBe(404);

		const tarefa = await env.DB.prepare("SELECT nome FROM projeto_tarefas WHERE id = ?").bind(tarefaDoA).first<{ nome: string }>();
		expect(tarefa?.nome).toBe("Tarefa do projeto A");
	});

	it("PATCH de metadado de documento com :id de outro projeto não encontra nem altera", async () => {
		const admin = await criarUsuario("idor-doc@voia.local", "administrador");
		const cookie = await loginComo("idor-doc@voia.local");
		const clienteId = await criarCliente("Cliente IDOR Documento");
		const projetoA = await criarProjeto(clienteId, admin, "Projeto A Doc");
		const projetoB = await criarProjeto(clienteId, admin, "Projeto B Doc");
		const docDoA = await criarDocumento(projetoA, admin, "Documento do projeto A");

		const res = await app.request(
			`/api/projetos/${projetoB}/documentos/${docDoA}`,
			jsonRequest("PATCH", { nome: "Nome alterado via IDOR" }, cookie),
			env,
		);
		expect(res.status).toBe(404);

		const doc = await env.DB.prepare("SELECT nome FROM projeto_documentos WHERE id = ?")
			.bind(docDoA)
			.first<{ nome: string }>();
		expect(doc?.nome).toBe("Documento do projeto A");
	});

	it("PATCH de contato de Portal com :id de outro cliente não encontra nem altera", async () => {
		await criarUsuario("idor-contato@voia.local", "administrador");
		const cookie = await loginComo("idor-contato@voia.local");
		const clienteA = await criarCliente("Cliente A Contato");
		const clienteB = await criarCliente("Cliente B Contato");

		const contatoDoA = await env.DB.prepare(
			"INSERT INTO cliente_contatos (cliente_id, nome, email) VALUES (?, ?, ?) RETURNING id",
		)
			.bind(clienteA, "Contato do cliente A", "contato-a@cliente.com")
			.first<{ id: number }>();

		const res = await app.request(
			`/api/clientes/${clienteB}/contatos/${contatoDoA!.id}`,
			jsonRequest("PATCH", { nome: "Nome alterado via IDOR" }, cookie),
			env,
		);
		expect(res.status).toBe(404);

		const contato = await env.DB.prepare("SELECT nome FROM cliente_contatos WHERE id = ?")
			.bind(contatoDoA!.id)
			.first<{ nome: string }>();
		expect(contato?.nome).toBe("Contato do cliente A");
	});

	it("dentro do MESMO projeto, o PATCH de etapa continua funcionando normalmente", async () => {
		const admin = await criarUsuario("idor-controle@voia.local", "administrador");
		const cookie = await loginComo("idor-controle@voia.local");
		const clienteId = await criarCliente("Cliente Controle");
		const projeto = await criarProjeto(clienteId, admin, "Projeto Controle");
		const etapa = await criarEtapa(projeto, "Etapa original");

		const res = await app.request(
			`/api/projetos/${projeto}/etapas/${etapa}`,
			jsonRequest("PATCH", { nome: "Etapa renomeada" }, cookie),
			env,
		);
		expect(res.status).toBe(200);

		const etapaAtualizada = await env.DB.prepare("SELECT nome FROM projeto_etapas WHERE id = ?")
			.bind(etapa)
			.first<{ nome: string }>();
		expect(etapaAtualizada?.nome).toBe("Etapa renomeada");
	});
});

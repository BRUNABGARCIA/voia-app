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

async function criarDocumentoComVisibilidade(
	projetoId: number,
	autorId: number,
	nome: string,
	opts: { visivelParceiro?: boolean; visivelCliente?: boolean; storageKey?: string | null } = {},
): Promise<number> {
	const row = await env.DB.prepare(
		"INSERT INTO projeto_documentos (projeto_id, nome, autor_id, storage_key, visivel_parceiro, visivel_cliente) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
	)
		.bind(
			projetoId,
			nome,
			autorId,
			opts.storageKey ?? null,
			opts.visivelParceiro ? 1 : 0,
			opts.visivelCliente ? 1 : 0,
		)
		.first<{ id: number }>();
	return row!.id;
}

describe("Documentos — DEFAULT DENY de visibilidade para o Parceiro", () => {
	it("documento liberado ao Parceiro (visivel_parceiro=1) aparece na listagem", async () => {
		const admin = await criarUsuario("admin-doc-liberado@voia.local", "administrador");
		const parceiro = await criarUsuario("parceiro-doc-liberado@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-doc-liberado@voia.local");
		const clienteId = await criarCliente("Cliente Doc Liberado");
		const projetoId = await criarProjeto(clienteId, admin, "Projeto Doc Liberado");
		await vincularMembro(projetoId, parceiro);
		const docId = await criarDocumentoComVisibilidade(projetoId, admin, "Documento liberado", { visivelParceiro: true });

		const res = await app.request(`/api/projetos/${projetoId}/documentos`, { headers: { cookie } }, env);
		const body = await res.json<{ documentos: { id: number }[] }>();
		expect(body.documentos.map((d) => d.id)).toContain(docId);
	});

	it("documento NÃO liberado (visivel_parceiro=0, padrão) não aparece na listagem", async () => {
		const admin = await criarUsuario("admin-doc-oculto@voia.local", "administrador");
		const parceiro = await criarUsuario("parceiro-doc-oculto@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-doc-oculto@voia.local");
		const clienteId = await criarCliente("Cliente Doc Oculto");
		const projetoId = await criarProjeto(clienteId, admin, "Projeto Doc Oculto");
		await vincularMembro(projetoId, parceiro);
		const docId = await criarDocumentoComVisibilidade(projetoId, admin, "Documento oculto");

		const res = await app.request(`/api/projetos/${projetoId}/documentos`, { headers: { cookie } }, env);
		const body = await res.json<{ documentos: { id: number }[] }>();
		expect(body.documentos.map((d) => d.id)).not.toContain(docId);
	});

	it("tentar o documento oculto direto pelo ID (PATCH) também é bloqueado (404)", async () => {
		const admin = await criarUsuario("admin-doc-patch-oculto@voia.local", "administrador");
		const parceiro = await criarUsuario("parceiro-doc-patch-oculto@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-doc-patch-oculto@voia.local");
		const clienteId = await criarCliente("Cliente Doc Patch");
		const projetoId = await criarProjeto(clienteId, admin, "Projeto Doc Patch");
		await vincularMembro(projetoId, parceiro);
		const docId = await criarDocumentoComVisibilidade(projetoId, admin, "Documento oculto para patch");

		const res = await app.request(
			`/api/projetos/${projetoId}/documentos/${docId}`,
			jsonRequest("PATCH", { nome: "Tentativa de alterar" }, cookie),
			env,
		);
		expect(res.status).toBe(404);
	});

	it("download direto por ID de documento oculto também é bloqueado (404)", async () => {
		const admin = await criarUsuario("admin-doc-download-oculto@voia.local", "administrador");
		const parceiro = await criarUsuario("parceiro-doc-download-oculto@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-doc-download-oculto@voia.local");
		const clienteId = await criarCliente("Cliente Doc Download");
		const projetoId = await criarProjeto(clienteId, admin, "Projeto Doc Download");
		await vincularMembro(projetoId, parceiro);
		const docId = await criarDocumentoComVisibilidade(projetoId, admin, "Documento oculto para download", {
			storageKey: "projetos/1/fake-key.pdf",
		});

		const res = await app.request(`/api/projetos/${projetoId}/documentos/${docId}/download`, { headers: { cookie } }, env);
		expect(res.status).toBe(404);
	});

	it("Parceiro não consegue se autoliberar um documento via PATCH (visivel_parceiro é ignorado)", async () => {
		const admin = await criarUsuario("admin-doc-autoliberacao@voia.local", "administrador");
		const parceiro = await criarUsuario("parceiro-doc-autoliberacao@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-doc-autoliberacao@voia.local");
		const clienteId = await criarCliente("Cliente Autoliberação");
		const projetoId = await criarProjeto(clienteId, admin, "Projeto Autoliberação");
		await vincularMembro(projetoId, parceiro);
		// Documento já visível (necessário para o Parceiro conseguir fazer o
		// PATCH básico) — o que se testa é se visivel_parceiro muda sozinho.
		const docId = await criarDocumentoComVisibilidade(projetoId, admin, "Documento do teste de autoliberação", {
			visivelParceiro: true,
		});

		await app.request(
			`/api/projetos/${projetoId}/documentos/${docId}`,
			jsonRequest("PATCH", { nome: "Nome alterado", visivel_parceiro: false }, cookie),
			env,
		);

		const row = await env.DB.prepare("SELECT visivel_parceiro FROM projeto_documentos WHERE id = ?")
			.bind(docId)
			.first<{ visivel_parceiro: number }>();
		// visivel_parceiro continua 1: o Parceiro não tem permissão para
		// alterá-lo, então o valor enviado (false) foi ignorado pelo backend.
		expect(row?.visivel_parceiro).toBe(1);
	});

	it("regra de Cliente (visivel_cliente) permanece independente de visivel_parceiro", async () => {
		const admin = await criarUsuario("admin-doc-independente@voia.local", "administrador");
		const parceiro = await criarUsuario("parceiro-doc-independente@voia.local", "colaborador");
		const cookie = await loginComo("parceiro-doc-independente@voia.local");
		const clienteId = await criarCliente("Cliente Independente");
		const projetoId = await criarProjeto(clienteId, admin, "Projeto Independente");
		await vincularMembro(projetoId, parceiro);

		// Visível ao cliente, mas NÃO ao parceiro.
		const docClienteOnly = await criarDocumentoComVisibilidade(projetoId, admin, "Só cliente", {
			visivelCliente: true,
			visivelParceiro: false,
		});
		// Visível ao parceiro, mas NÃO ao cliente.
		const docParceiroOnly = await criarDocumentoComVisibilidade(projetoId, admin, "Só parceiro", {
			visivelCliente: false,
			visivelParceiro: true,
		});

		const res = await app.request(`/api/projetos/${projetoId}/documentos`, { headers: { cookie } }, env);
		const body = await res.json<{ documentos: { id: number }[] }>();
		const ids = body.documentos.map((d) => d.id);
		expect(ids).not.toContain(docClienteOnly);
		expect(ids).toContain(docParceiroOnly);
	});

	it("administrador continua vendo todos os documentos, liberados ou não", async () => {
		const admin = await criarUsuario("admin-doc-ve-tudo@voia.local", "administrador");
		const cookieAdmin = await loginComo("admin-doc-ve-tudo@voia.local");
		const clienteId = await criarCliente("Cliente Admin Ve Tudo");
		const projetoId = await criarProjeto(clienteId, admin, "Projeto Admin Ve Tudo");
		const docOculto = await criarDocumentoComVisibilidade(projetoId, admin, "Documento oculto ao parceiro");

		const res = await app.request(`/api/projetos/${projetoId}/documentos`, { headers: { cookie: cookieAdmin } }, env);
		const body = await res.json<{ documentos: { id: number }[] }>();
		expect(body.documentos.map((d) => d.id)).toContain(docOculto);
	});
});

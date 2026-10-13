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

// PNG 1x1 válido (assinatura 0x89 0x50 0x4E 0x47 + resto mínimo) — usado nos
// testes de upload de foto; não precisa ser uma imagem decodificável de
// verdade, só passar a checagem de assinatura de bytes (storage/documentos.ts).
const PNG_MINIMO = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

interface Cenario {
	cookieAdmin: string;
	parceiroA: number;
	cookieA: string;
	parceiroB: number;
	cookieB: string;
	obraA: number;
	obraB: number;
}

async function montarCenario(sufixo: string): Promise<Cenario> {
	const adminId = await criarUsuario(`admin-obras-${sufixo}@voia.local`, "administrador");
	const cookieAdmin = await loginComo(`admin-obras-${sufixo}@voia.local`);
	const parceiroA = await criarUsuario(`parceiro-obras-a-${sufixo}@voia.local`, "colaborador");
	const parceiroB = await criarUsuario(`parceiro-obras-b-${sufixo}@voia.local`, "colaborador");
	const cookieA = await loginComo(`parceiro-obras-a-${sufixo}@voia.local`);
	const cookieB = await loginComo(`parceiro-obras-b-${sufixo}@voia.local`);

	const clienteA = await criarCliente(`Cliente Obras A ${sufixo}`);
	const projetoA = await criarProjeto(clienteA, adminId, `Projeto Obras A ${sufixo}`);
	await vincularMembro(projetoA, parceiroA);

	const clienteB = await criarCliente(`Cliente Obras B ${sufixo}`);
	const projetoB = await criarProjeto(clienteB, adminId, `Projeto Obras B ${sufixo}`);
	await vincularMembro(projetoB, parceiroB);

	const criadaA = await app.request(
		"/api/obras",
		jsonRequest("POST", { projeto_id: projetoA, nome: `Obra A ${sufixo}` }, cookieAdmin),
		env,
	);
	const { obra: obraA } = await criadaA.json<{ obra: { id: number } }>();

	const criadaB = await app.request(
		"/api/obras",
		jsonRequest("POST", { projeto_id: projetoB, nome: `Obra B ${sufixo}` }, cookieAdmin),
		env,
	);
	const { obra: obraB } = await criadaB.json<{ obra: { id: number } }>();

	return { cookieAdmin, parceiroA, cookieA, parceiroB, cookieB, obraA: obraA.id, obraB: obraB.id };
}

describe("Obras — CRUD básico", () => {
	it("admin cria obra vinculada a projeto existente", async () => {
		const cen = await montarCenario("crud-basico");
		expect(cen.obraA).toBeGreaterThan(0);
	});

	it("Parceiro não pode criar obra (403)", async () => {
		const cen = await montarCenario("parceiro-nao-cria");
		const res = await app.request(
			"/api/obras",
			jsonRequest("POST", { projeto_id: 1, nome: "Obra ilegal" }, cen.cookieA),
			env,
		);
		expect(res.status).toBe(403);
	});

	it("não cria obra para projeto inexistente (400)", async () => {
		const adminId = await criarUsuario("admin-obra-projeto-invalido@voia.local", "administrador");
		const cookieAdmin = await loginComo("admin-obra-projeto-invalido@voia.local");
		const res = await app.request(
			"/api/obras",
			jsonRequest("POST", { projeto_id: 999999, nome: "Obra fantasma" }, cookieAdmin),
			env,
		);
		expect(res.status).toBe(400);
		void adminId;
	});

	it("admin edita progresso manual e status da obra", async () => {
		const cen = await montarCenario("edita-progresso");
		const res = await app.request(
			`/api/obras/${cen.obraA}`,
			jsonRequest("PATCH", { progresso: 42, status: "em_execucao" }, cen.cookieAdmin),
			env,
		);
		expect(res.status).toBe(200);
		const { obra } = await res.json<{ obra: { progresso: number; status: string } }>();
		expect(obra.progresso).toBe(42);
		expect(obra.status).toBe("em_execucao");
	});
});

describe("Obras — isolamento Parceiro A/B", () => {
	it("Parceiro A não lista a obra B em GET /api/obras", async () => {
		const cen = await montarCenario("isolamento-lista");
		const res = await app.request("/api/obras", { headers: { cookie: cen.cookieA } }, env);
		const body = await res.json<{ obras: { id: number }[] }>();
		const ids = body.obras.map((o) => o.id);
		expect(ids).toContain(cen.obraA);
		expect(ids).not.toContain(cen.obraB);
	});

	it("Parceiro A não acessa o detalhe da obra B (404, nunca 403)", async () => {
		const cen = await montarCenario("isolamento-detalhe");
		const res = await app.request(`/api/obras/${cen.obraB}`, { headers: { cookie: cen.cookieA } }, env);
		expect(res.status).toBe(404);
	});

	it("Parceiro A não edita a obra B (403 — PATCH é admin/gestor only, mesmo padrão de outras rotas administrativas)", async () => {
		const cen = await montarCenario("isolamento-patch");
		const res = await app.request(
			`/api/obras/${cen.obraB}`,
			jsonRequest("PATCH", { progresso: 99 }, cen.cookieA),
			env,
		);
		expect(res.status).toBe(403);
	});

	it("Parceiro A não lista RDO, ocorrências nem fotos da obra B", async () => {
		const cen = await montarCenario("isolamento-subrecursos");
		const rdo = await app.request(`/api/obras/${cen.obraB}/rdo`, { headers: { cookie: cen.cookieA } }, env);
		const ocorrencias = await app.request(`/api/obras/${cen.obraB}/ocorrencias`, { headers: { cookie: cen.cookieA } }, env);
		const fotos = await app.request(`/api/obras/${cen.obraB}/fotos`, { headers: { cookie: cen.cookieA } }, env);
		expect(rdo.status).toBe(404);
		expect(ocorrencias.status).toBe(404);
		expect(fotos.status).toBe(404);
	});

	it("Parceiro A não cria RDO/ocorrência na obra B", async () => {
		const cen = await montarCenario("isolamento-criacao");
		const rdo = await app.request(
			`/api/obras/${cen.obraB}/rdo`,
			jsonRequest("POST", { data: "2025-01-01" }, cen.cookieA),
			env,
		);
		const ocorrencia = await app.request(
			`/api/obras/${cen.obraB}/ocorrencias`,
			jsonRequest("POST", { titulo: "Ocorrência suspeita" }, cen.cookieA),
			env,
		);
		expect(rdo.status).toBe(404);
		expect(ocorrencia.status).toBe(404);
	});
});

describe("Obras — RDO", () => {
	it("Parceiro cria RDO na própria obra, com autoria registrada", async () => {
		const cen = await montarCenario("rdo-autoria");
		const res = await app.request(
			`/api/obras/${cen.obraA}/rdo`,
			jsonRequest("POST", { data: "2025-02-10", condicoes_climaticas: "Ensolarado", servicos_executados: "Fundação" }, cen.cookieA),
			env,
		);
		expect(res.status).toBe(201);
		const { rdo } = await res.json<{ rdo: { criado_por_id: number; data: string } }>();
		expect(rdo.criado_por_id).toBe(cen.parceiroA);
		expect(rdo.data).toBe("2025-02-10");
	});

	it("histórico de RDO ordenado por data, mais recente primeiro", async () => {
		const cen = await montarCenario("rdo-historico");
		await app.request(`/api/obras/${cen.obraA}/rdo`, jsonRequest("POST", { data: "2025-01-01" }, cen.cookieAdmin), env);
		await app.request(`/api/obras/${cen.obraA}/rdo`, jsonRequest("POST", { data: "2025-03-01" }, cen.cookieAdmin), env);
		const res = await app.request(`/api/obras/${cen.obraA}/rdo`, { headers: { cookie: cen.cookieAdmin } }, env);
		const { rdos } = await res.json<{ rdos: { data: string }[] }>();
		expect(rdos[0].data).toBe("2025-03-01");
	});
});

describe("Obras — Ocorrências", () => {
	it("abre, atribui e resolve uma ocorrência, com resolvido_em preenchido", async () => {
		const cen = await montarCenario("ocorrencia-fluxo");
		const criada = await app.request(
			`/api/obras/${cen.obraA}/ocorrencias`,
			jsonRequest("POST", { titulo: "Falta de material", categoria: "material", prioridade: "alta" }, cen.cookieAdmin),
			env,
		);
		const { ocorrencia } = await criada.json<{ ocorrencia: { id: number; status: string } }>();
		expect(ocorrencia.status).toBe("aberta");

		const atribuida = await app.request(
			`/api/obras/${cen.obraA}/ocorrencias/${ocorrencia.id}`,
			jsonRequest("PATCH", { responsavel_id: cen.parceiroA, status: "em_tratamento" }, cen.cookieAdmin),
			env,
		);
		expect(atribuida.status).toBe(200);

		const resolvida = await app.request(
			`/api/obras/${cen.obraA}/ocorrencias/${ocorrencia.id}`,
			jsonRequest("PATCH", { status: "resolvida" }, cen.cookieAdmin),
			env,
		);
		const { ocorrencia: resolvidaBody } = await resolvida.json<{ ocorrencia: { status: string; resolvido_em: string | null } }>();
		expect(resolvidaBody.status).toBe("resolvida");
		expect(resolvidaBody.resolvido_em).not.toBeNull();
	});
});

describe("Obras — Fotos (R2 local)", () => {
	function montarFormData(nomeArquivo: string, bytes: Uint8Array, tipo: string): FormData {
		const form = new FormData();
		form.set("arquivo", new File([bytes], nomeArquivo, { type: tipo }));
		return form;
	}

	it("upload de PNG válido é aceito e listado", async () => {
		const cen = await montarCenario("foto-upload-ok");
		const form = montarFormData("foto.png", PNG_MINIMO, "image/png");
		const res = await app.request(`/api/obras/${cen.obraA}/fotos`, {
			method: "POST",
			headers: { cookie: cen.cookieAdmin },
			body: form,
		}, env);
		expect(res.status).toBe(201);
		const { foto } = await res.json<{ foto: { id: number; obra_id: number } }>();
		expect(foto.obra_id).toBe(cen.obraA);

		const listagem = await app.request(`/api/obras/${cen.obraA}/fotos`, { headers: { cookie: cen.cookieAdmin } }, env);
		const { fotos } = await listagem.json<{ fotos: { id: number }[] }>();
		expect(fotos.map((f) => f.id)).toContain(foto.id);
	});

	it("rejeita arquivo que não é imagem (PDF) nas fotos da obra", async () => {
		const cen = await montarCenario("foto-rejeita-pdf");
		const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
		const form = montarFormData("documento.pdf", pdfBytes, "application/pdf");
		const res = await app.request(`/api/obras/${cen.obraA}/fotos`, {
			method: "POST",
			headers: { cookie: cen.cookieAdmin },
			body: form,
		}, env);
		expect(res.status).toBe(400);
	});

	it("Parceiro A não acessa foto da obra B nem por ID direto", async () => {
		const cen = await montarCenario("foto-isolamento");
		const form = montarFormData("foto-b.png", PNG_MINIMO, "image/png");
		const upload = await app.request(`/api/obras/${cen.obraB}/fotos`, {
			method: "POST",
			headers: { cookie: cen.cookieAdmin },
			body: form,
		}, env);
		const { foto } = await upload.json<{ foto: { id: number } }>();

		const semAcessoObra = await app.request(`/api/obras/${cen.obraB}/fotos/${foto.id}/arquivo`, { headers: { cookie: cen.cookieA } }, env);
		expect(semAcessoObra.status).toBe(404);

		// Mesmo tentando "pela própria obra" com o ID da foto de B — a query
		// sempre reconfirma obra_id = :id do path, nunca só o fotoId.
		const trocaDeObra = await app.request(`/api/obras/${cen.obraA}/fotos/${foto.id}/arquivo`, { headers: { cookie: cen.cookieA } }, env);
		expect(trocaDeObra.status).toBe(404);
	});

	it("Parceiro não pode excluir foto (403) — só administrador/gestor", async () => {
		const cen = await montarCenario("foto-exclusao-restrita");
		const form = montarFormData("foto.png", PNG_MINIMO, "image/png");
		const upload = await app.request(`/api/obras/${cen.obraA}/fotos`, {
			method: "POST",
			headers: { cookie: cen.cookieAdmin },
			body: form,
		}, env);
		const { foto } = await upload.json<{ foto: { id: number } }>();

		const tentativa = await app.request(`/api/obras/${cen.obraA}/fotos/${foto.id}`, {
			method: "DELETE",
			headers: { cookie: cen.cookieA },
		}, env);
		expect(tentativa.status).toBe(403);
	});
});

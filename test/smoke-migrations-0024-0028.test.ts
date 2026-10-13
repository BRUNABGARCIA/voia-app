import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("migrations 0024-0028 aplicam limpo contra o D1 local", () => {
	it("projeto_tarefas: etapa_id agora é nullable e criado_por_id existe", async () => {
		const info = await env.DB.prepare("PRAGMA table_info(projeto_tarefas)").all<{
			name: string;
			notnull: number;
		}>();
		const etapaId = info.results.find((c) => c.name === "etapa_id");
		const criadoPor = info.results.find((c) => c.name === "criado_por_id");
		expect(etapaId?.notnull).toBe(0);
		expect(criadoPor).toBeDefined();
		expect(criadoPor?.notnull).toBe(0);
	});

	it("projeto_tarefas preserva as colunas antigas (rebuild não perdeu nada)", async () => {
		const info = await env.DB.prepare("PRAGMA table_info(projeto_tarefas)").all<{ name: string }>();
		const nomes = info.results.map((c) => c.name).sort();
		expect(nomes).toEqual(
			[
				"atualizado_em",
				"criado_em",
				"criado_por_id",
				"data_conclusao",
				"data_inicio",
				"descricao",
				"etapa_id",
				"id",
				"nome",
				"ordem",
				"origem_modelo_id",
				"prazo",
				"prioridade",
				"projeto_id",
				"responsavel_id",
				"status",
				"visivel_cliente",
			].sort(),
		);
	});

	it("obras existe, ligada a projetos, com status e progresso manual default 0", async () => {
		const info = await env.DB.prepare("PRAGMA table_info(obras)").all<{
			name: string;
			notnull: number;
			dflt_value: string | null;
		}>();
		const progresso = info.results.find((c) => c.name === "progresso");
		expect(progresso?.dflt_value).toBe("0");

		const fk = await env.DB.prepare("PRAGMA foreign_key_list(obras)").all<{ table: string; from: string }>();
		expect(fk.results.some((f) => f.table === "projetos" && f.from === "projeto_id")).toBe(true);
	});

	it("obra_rdo, obra_fotos e obra_ocorrencias existem e se referenciam a obras", async () => {
		const tabelas = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('obra_rdo', 'obra_fotos', 'obra_ocorrencias')",
		).all<{ name: string }>();
		expect(tabelas.results.map((t) => t.name).sort()).toEqual(["obra_fotos", "obra_ocorrencias", "obra_rdo"]);

		for (const tabela of ["obra_rdo", "obra_fotos", "obra_ocorrencias"]) {
			const fk = await env.DB.prepare(`PRAGMA foreign_key_list(${tabela})`).all<{ table: string; from: string }>();
			expect(fk.results.some((f) => f.table === "obras" && f.from === "obra_id")).toBe(true);
		}
	});

	it("obra_fotos referencia obra_rdo (rdo_id opcional)", async () => {
		const fk = await env.DB.prepare("PRAGMA foreign_key_list(obra_fotos)").all<{ table: string; from: string }>();
		expect(fk.results.some((f) => f.table === "obra_rdo" && f.from === "rdo_id")).toBe(true);
	});

	it("foreign_key_check não encontra nenhuma violação após as 28 migrations", async () => {
		const violacoes = await env.DB.prepare("PRAGMA foreign_key_check").all();
		expect(violacoes.results).toEqual([]);
	});
});

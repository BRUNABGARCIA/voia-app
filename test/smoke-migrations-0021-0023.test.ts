import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("migrations 0021-0023 aplicam limpo contra o D1 local", () => {
	it("projeto_documentos.visivel_parceiro existe, NOT NULL DEFAULT 0", async () => {
		const info = await env.DB.prepare("PRAGMA table_info(projeto_documentos)").all<{
			name: string;
			notnull: number;
			dflt_value: string | null;
		}>();
		const coluna = info.results.find((c) => c.name === "visivel_parceiro");
		expect(coluna).toBeDefined();
		expect(coluna?.notnull).toBe(1);
		expect(coluna?.dflt_value).toBe("0");
	});

	it("parceiro_foco_diario existe com PK composta (usuario_id, data)", async () => {
		const tabela = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
			.bind("parceiro_foco_diario")
			.first();
		expect(tabela).not.toBeNull();

		const info = await env.DB.prepare("PRAGMA table_info(parceiro_foco_diario)").all<{ name: string; pk: number }>();
		const pks = info.results.filter((c) => c.pk > 0).map((c) => c.name);
		expect(pks.sort()).toEqual(["data", "usuario_id"]);
	});

	it("projeto_parceiro_remuneracoes e projeto_parceiro_pagamentos existem e se referenciam", async () => {
		const tabelas = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('projeto_parceiro_remuneracoes', 'projeto_parceiro_pagamentos')",
		).all<{ name: string }>();
		expect(tabelas.results.map((t) => t.name).sort()).toEqual([
			"projeto_parceiro_pagamentos",
			"projeto_parceiro_remuneracoes",
		]);

		const fkPagamentos = await env.DB.prepare("PRAGMA foreign_key_list(projeto_parceiro_pagamentos)").all<{
			table: string;
			from: string;
		}>();
		expect(fkPagamentos.results.some((fk) => fk.table === "projeto_parceiro_remuneracoes" && fk.from === "remuneracao_id")).toBe(
			true,
		);
	});

	it("foreign_key_check não encontra nenhuma violação após as 23 migrations", async () => {
		const violacoes = await env.DB.prepare("PRAGMA foreign_key_check").all();
		expect(violacoes.results).toEqual([]);
	});
});

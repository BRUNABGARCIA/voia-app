import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// Caracteriza o comportamento real do isolamento de storage do
// @cloudflare/vitest-plugin: é por ARQUIVO de teste, não por `it()`
// individual (confirmado empiricamente — a documentação da própria
// ferramenta não deixa isso explícito). Cada arquivo de teste começa com
// o schema das migrations já aplicado (ver test/setup/apply-migrations.ts),
// mas dados inseridos por um teste continuam visíveis aos testes
// seguintes NO MESMO ARQUIVO. Por isso, os demais testes deste projeto
// usam e-mails/identificadores únicos por teste em vez de depender de
// limpeza entre `it()`s.
describe("isolamento de storage do @cloudflare/vitest-plugin", () => {
	it("dados de um teste continuam visíveis a outro teste do mesmo arquivo", async () => {
		await env.DB.prepare("INSERT INTO usuarios (nome, email, perfil) VALUES (?, ?, ?)")
			.bind("Isolamento", "caracterizacao-isolamento@voia.local", "administrador")
			.run();
		const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE email = ?")
			.bind("caracterizacao-isolamento@voia.local")
			.first<{ total: number }>();
		expect(row?.total).toBe(1);
	});

	it("confirma que o INSERT do teste anterior persistiu neste teste", async () => {
		const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE email = ?")
			.bind("caracterizacao-isolamento@voia.local")
			.first<{ total: number }>();
		expect(row?.total).toBe(1);
	});
});

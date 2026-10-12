import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("fundação de testes", () => {
	it("aplica as migrations reais (0001-0020) contra o D1 local", async () => {
		const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM usuarios").first<{ total: number }>();
		expect(row?.total).toBeGreaterThan(0);
	});

	it("tem acesso ao binding R2 de documentos", async () => {
		expect(env.DOCUMENTOS_BUCKET).toBeDefined();
	});
});

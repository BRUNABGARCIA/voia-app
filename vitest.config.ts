import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
	const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

	return {
		plugins: [
			cloudflareTest({
				wrangler: { configPath: "./wrangler.json" },
				miniflare: {
					// Binding só de teste (não existe em produção) para o setup file
					// poder aplicar as migrations reais via applyD1Migrations().
					bindings: { TEST_MIGRATIONS: migrations },
					d1Databases: { DB_LEGADO: 'rodada-3-legado-teste' },
				},
			}),
		],
		test: {
			include: ["test/**/*.test.ts"],
			setupFiles: ["./test/setup/apply-migrations.ts"],
		},
	};
});

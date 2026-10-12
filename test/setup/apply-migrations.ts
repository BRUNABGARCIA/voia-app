import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { D1Migration } from "@cloudflare/vitest-plugin";

// TEST_MIGRATIONS é um binding só de teste (ver vitest.config.ts), sem
// relação com produção/wrangler.json — por isso não amplia a interface
// Env real, só um cast local aqui.
const testMigrations = (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;

// Setup files rodam fora do isolamento de storage por arquivo de teste e
// podem rodar mais de uma vez — applyD1Migrations() só aplica o que ainda
// não foi aplicado, então é seguro chamar aqui sempre. Nunca toca no D1
// remoto: as migrations vêm dos arquivos reais em migrations/.
await applyD1Migrations(env.DB, testMigrations);

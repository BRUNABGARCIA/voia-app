import { Hono } from "hono";
import auth from "./auth/routes";
import usuarios from "./usuarios/routes";
import configuracoes from "./configuracoes/routes";
import clientes from "./clientes/routes";
import projetos from "./projetos/routes";
import dashboard from "./dashboard/routes";
import tiposServico from "./tipos-servico/routes";
import portal from "./portal/routes";

const app = new Hono<{ Bindings: Env }>();

app.route("/api/auth", auth);
app.route("/api/usuarios", usuarios);
app.route("/api/configuracoes", configuracoes);
app.route("/api/clientes", clientes);
app.route("/api/projetos", projetos);
app.route("/api/dashboard", dashboard);
app.route("/api/tipos-servico", tiposServico);
// Portal do Cliente — API externa isolada, cookie e tabela de sessão
// próprios (ver src/worker/portal). Nunca reaproveita withSession/AuthEnv.
app.route("/api/portal", portal);

app.get("/api/health", async (c) => {
	const timestamp = new Date().toISOString();

	if (!c.env.DB) {
		return c.json(
			{
				status: "error",
				api: "ok",
				database: { binding: false, connected: false, migrationApplied: false },
				timestamp,
			},
			503,
		);
	}

	try {
		await c.env.DB.prepare("SELECT 1 AS ok").first();

		try {
			await c.env.DB.prepare("SELECT COUNT(*) AS total FROM usuarios").first();

			return c.json({
				status: "ok",
				api: "ok",
				database: { binding: true, connected: true, migrationApplied: true },
				timestamp,
			});
		} catch {
			return c.json({
				status: "degraded",
				api: "ok",
				database: { binding: true, connected: true, migrationApplied: false },
				timestamp,
			});
		}
	} catch {
		return c.json(
			{
				status: "error",
				api: "ok",
				database: { binding: true, connected: false, migrationApplied: false },
				timestamp,
			},
			503,
		);
	}
});

// Fallback de SPA: rotas do React Router (ex.: /login, /status) não
// correspondem a nenhum arquivo estático, então o roteamento padrão de
// assets da Cloudflare não as resolve para index.html automaticamente
// quando há um Worker `main` configurado — só caminhos com arquivo exato
// são servidos antes do Worker. Sem criar um binding novo em
// wrangler.json, buscamos "/" (que É um arquivo exato e é servido direto
// pela camada de assets) e devolvemos seu conteúdo.
//
// IMPORTANTE (bug corrigido nesta rodada): "not_found_handling:
// single-page-application" no wrangler.json intercepta QUALQUER caminho
// sem asset correspondente — inclusive "/api/*" — quando o request "parece
// navegação de página" (Accept: text/html, como um clique real em <a
// href>), servindo index.html ANTES do Worker rodar. Chamadas via fetch()
// (Accept: */*, sem Sec-Fetch-Mode: navigate) nunca acionavam isso, por
// isso só o link de download (o único <a href> apontando para /api/* da
// aplicação) exibia o bug. A correção real está em wrangler.json
// ("assets.run_worker_first": ["/api/*"]), que garante que /api/* sempre
// chega neste Worker primeiro, independente do Accept header — este
// catch-all abaixo continua existindo só para as rotas de SPA de verdade.
app.get("*", async (c) => {
	if (c.req.path.startsWith("/api/")) {
		return c.text("404 Not Found", 404);
	}

	const indexUrl = new URL("/", c.req.url);
	const res = await fetch(indexUrl.toString(), { cf: c.req.raw.cf });
	return new Response(res.body, res);
});

export default app;

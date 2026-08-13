import { Hono } from "hono";
import auth from "./auth/routes";

const app = new Hono<{ Bindings: Env }>();

app.route("/api/auth", auth);

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
app.get("*", async (c) => {
	if (c.req.path.startsWith("/api/")) {
		return c.text("404 Not Found", 404);
	}

	const indexUrl = new URL("/", c.req.url);
	const res = await fetch(indexUrl.toString(), { cf: c.req.raw.cf });
	return new Response(res.body, res);
});

export default app;

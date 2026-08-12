import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

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

export default app;

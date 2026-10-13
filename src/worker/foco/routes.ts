import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, withSession, type AuthEnv } from "../auth/middleware";

// "Meu foco de hoje" — sempre amarrado ao usuário autenticado (nunca
// aceito do corpo da requisição) e ao dia civil atual (YYYY-UTC, mesmo
// padrão de data usado no resto do sistema). Qualquer usuário autenticado
// pode usar — a feature foi pedida para o Parceiro, mas a tabela
// (migration 0022) não amarra isso a um perfil específico; só o próprio
// usuário nunca lê/escreve o foco de outro, garantido aqui por nunca
// aceitar usuario_id de fora da sessão.
const foco = new Hono<AuthEnv>();

function hoje(): string {
	return new Date().toISOString().slice(0, 10);
}

foco.get("/", withSession, requireAuth, async (c) => {
	const usuarioId = c.get("user")!.id;
	const data = hoje();

	const row = await c.env.DB.prepare("SELECT texto, atualizado_em FROM parceiro_foco_diario WHERE usuario_id = ? AND data = ?")
		.bind(usuarioId, data)
		.first<{ texto: string; atualizado_em: string }>();

	return c.json({ data, texto: row?.texto ?? null, atualizado_em: row?.atualizado_em ?? null });
});

const salvarFocoSchema = z.object({ texto: z.string().trim().min(1).max(280) });

foco.put("/", withSession, requireAuth, async (c) => {
	const usuarioId = c.get("user")!.id;
	const body = await c.req.json().catch(() => null);
	const parsed = salvarFocoSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "dados inválidos" }, 400);
	}

	const data = hoje();
	// Atualizar no mesmo dia substitui o registro daquele dia (nunca
	// duplica) — chave primária composta (usuario_id, data) garante isso
	// mesmo sem o upsert, mas o ON CONFLICT evita um SELECT prévio.
	await c.env.DB.prepare(
		`INSERT INTO parceiro_foco_diario (usuario_id, data, texto, atualizado_em)
		 VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT (usuario_id, data) DO UPDATE SET texto = excluded.texto, atualizado_em = CURRENT_TIMESTAMP`,
	)
		.bind(usuarioId, data, parsed.data.texto)
		.run();

	return c.json({ data, texto: parsed.data.texto });
});

export default foco;

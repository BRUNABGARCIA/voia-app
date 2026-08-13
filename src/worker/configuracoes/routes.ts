import { Hono } from "hono";
import { requireAuth, requireRole, withSession, type AuthEnv } from "../auth/middleware";

const MAX_BYTES = 500 * 1024; // 500 KB

const FALLBACK_LOGO = "/branding/logo-voia.png";
const FALLBACK_FAVICON = "/branding/favicon-voia.png";

interface LinhaConfig {
	nome_sistema: string;
	tem_logo: number;
	tem_favicon: number;
	atualizado_em: string;
}

/** Assinatura real dos bytes do arquivo — nunca confia no Content-Type declarado pelo navegador. */
function detectarMime(bytes: Uint8Array): string | null {
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return "image/png";
	}
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return "image/jpeg";
	}
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return "image/webp";
	}
	return null;
}

async function lerEValidarImagem(file: File): Promise<{ bytes: ArrayBuffer; mime: string } | { error: string }> {
	if (file.size > MAX_BYTES) {
		return { error: "arquivo maior que 500 KB" };
	}

	const bytes = await file.arrayBuffer();
	const mime = detectarMime(new Uint8Array(bytes));
	if (!mime) {
		return { error: "formato de imagem não suportado (use PNG, JPEG ou WEBP)" };
	}

	return { bytes, mime };
}

function respostaConfig(row: LinhaConfig | null) {
	return {
		nomeSistema: row?.nome_sistema ?? "VOIA Engenharia",
		logoUrl: row?.tem_logo ? "/api/configuracoes/logo" : FALLBACK_LOGO,
		faviconUrl: row?.tem_favicon ? "/api/configuracoes/favicon" : FALLBACK_FAVICON,
		atualizadoEm: row?.atualizado_em ?? null,
	};
}

const configuracoes = new Hono<AuthEnv>();

// Público — logo, favicon e nome do sistema não são informação
// administrativa/sensível. Nunca inclui os BLOBs na resposta JSON.
configuracoes.get("/", async (c) => {
	const row = await c.env.DB.prepare(
		"SELECT nome_sistema, logo_blob IS NOT NULL AS tem_logo, favicon_blob IS NOT NULL AS tem_favicon, atualizado_em FROM configuracoes_aparencia WHERE id = 1",
	).first<LinhaConfig>();

	return c.json(respostaConfig(row));
});

configuracoes.get("/logo", async (c) => {
	const row = await c.env.DB.prepare("SELECT logo_blob, logo_mime FROM configuracoes_aparencia WHERE id = 1").first<{
		logo_blob: ArrayBuffer | null;
		logo_mime: string | null;
	}>();

	if (!row?.logo_blob) {
		return c.redirect(FALLBACK_LOGO, 302);
	}

	return new Response(row.logo_blob, {
		headers: { "Content-Type": row.logo_mime ?? "image/png", "Cache-Control": "no-cache" },
	});
});

configuracoes.get("/favicon", async (c) => {
	const row = await c.env.DB.prepare(
		"SELECT favicon_blob, favicon_mime FROM configuracoes_aparencia WHERE id = 1",
	).first<{ favicon_blob: ArrayBuffer | null; favicon_mime: string | null }>();

	if (!row?.favicon_blob) {
		return c.redirect(FALLBACK_FAVICON, 302);
	}

	return new Response(row.favicon_blob, {
		headers: { "Content-Type": row.favicon_mime ?? "image/png", "Cache-Control": "no-cache" },
	});
});

configuracoes.patch("/", withSession, requireAuth, requireRole("administrador"), async (c) => {
	const body = await c.req.parseBody().catch(() => null);
	if (!body) {
		return c.json({ error: "dados inválidos" }, 400);
	}

	const nomeSistemaBruto = body["nome_sistema"];
	const nomeSistema = typeof nomeSistemaBruto === "string" ? nomeSistemaBruto.trim() : undefined;
	if (nomeSistema !== undefined && (nomeSistema.length === 0 || nomeSistema.length > 200)) {
		return c.json({ error: "nome do sistema inválido" }, 400);
	}

	const logoFile = body["logo"];
	const faviconFile = body["favicon"];

	let logo: { bytes: ArrayBuffer; mime: string } | undefined;
	if (logoFile instanceof File) {
		const resultado = await lerEValidarImagem(logoFile);
		if ("error" in resultado) return c.json({ error: `logo: ${resultado.error}` }, 400);
		logo = resultado;
	}

	let favicon: { bytes: ArrayBuffer; mime: string } | undefined;
	if (faviconFile instanceof File) {
		const resultado = await lerEValidarImagem(faviconFile);
		if ("error" in resultado) return c.json({ error: `favicon: ${resultado.error}` }, 400);
		favicon = resultado;
	}

	const atual = c.get("user")!;
	const campos: string[] = ["atualizado_em = CURRENT_TIMESTAMP", "atualizado_por_id = ?"];
	const valores: unknown[] = [atual.id];

	if (nomeSistema !== undefined) {
		campos.push("nome_sistema = ?");
		valores.push(nomeSistema);
	}
	if (logo) {
		campos.push("logo_blob = ?", "logo_mime = ?");
		valores.push(logo.bytes, logo.mime);
	}
	if (favicon) {
		campos.push("favicon_blob = ?", "favicon_mime = ?");
		valores.push(favicon.bytes, favicon.mime);
	}

	await c.env.DB.prepare(`UPDATE configuracoes_aparencia SET ${campos.join(", ")} WHERE id = 1`)
		.bind(...valores)
		.run();

	const row = await c.env.DB.prepare(
		"SELECT nome_sistema, logo_blob IS NOT NULL AS tem_logo, favicon_blob IS NOT NULL AS tem_favicon, atualizado_em FROM configuracoes_aparencia WHERE id = 1",
	).first<LinhaConfig>();

	return c.json(respostaConfig(row));
});

export default configuracoes;

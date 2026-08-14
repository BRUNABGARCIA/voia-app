import { Hono } from "hono";
import { requireAuth, requireRole, withSession, type AuthEnv } from "../auth/middleware";

const MAX_BYTES = 500 * 1024; // 500 KB

const FALLBACK_LOGO = "/branding/logo-voia.png";
const FALLBACK_FAVICON = "/branding/favicon-voia.png";

const LOGO_ESCALA_MIN = 60;
const LOGO_ESCALA_MAX = 130;

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

// campo do form (snake_case) -> coluna no banco = mesmo nome; mapeado para
// camelCase na resposta JSON (respostaConfig). Uma única lista alimenta
// tanto a leitura/validação do PATCH quanto o SELECT.
const CAMPOS_COR = [
	"cor_principal",
	"cor_destaque",
	"cor_fundo",
	"cor_superficie",
	"cor_sidebar",
	"cor_texto_principal",
	"cor_texto_secundario",
] as const;

interface LinhaConfig {
	nome_sistema: string;
	tem_logo: number;
	tem_favicon: number;
	logo_escala: number;
	cor_principal: string;
	cor_destaque: string;
	cor_fundo: string;
	cor_superficie: string;
	cor_sidebar: string;
	cor_texto_principal: string;
	cor_texto_secundario: string;
	atualizado_em: string;
}

/**
 * O D1 local (e, historicamente, também em produção) não garante que uma
 * coluna BLOB retorne como ArrayBuffer/Uint8Array — em testes locais veio
 * como Array simples de números, e `new Response(array, ...)` serializa
 * isso via String() (bytes separados por vírgula) em vez de enviar binário.
 * Uint8Array aceita tanto ArrayBuffer quanto array-like como entrada, então
 * normaliza os dois casos.
 */
function bytesParaResponseBody(blob: ArrayBuffer | number[]): Uint8Array {
	return new Uint8Array(blob);
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
		logoEscala: row?.logo_escala ?? 100,
		corPrincipal: row?.cor_principal ?? "#124435",
		corDestaque: row?.cor_destaque ?? "#F7C94A",
		corFundo: row?.cor_fundo ?? "#F7F7F5",
		corSuperficie: row?.cor_superficie ?? "#FFFFFF",
		corSidebar: row?.cor_sidebar ?? "#000000",
		corTextoPrincipal: row?.cor_texto_principal ?? "#1B1F1C",
		corTextoSecundario: row?.cor_texto_secundario ?? "#3D443F",
		atualizadoEm: row?.atualizado_em ?? null,
	};
}

const SELECT_CONFIG = `
	SELECT nome_sistema, logo_blob IS NOT NULL AS tem_logo, favicon_blob IS NOT NULL AS tem_favicon, logo_escala,
	       ${CAMPOS_COR.join(", ")}, atualizado_em
	FROM configuracoes_aparencia WHERE id = 1
`;

const configuracoes = new Hono<AuthEnv>();

// Público — logo, favicon e nome do sistema não são informação
// administrativa/sensível. Nunca inclui os BLOBs na resposta JSON.
configuracoes.get("/", async (c) => {
	const row = await c.env.DB.prepare(SELECT_CONFIG).first<LinhaConfig>();

	return c.json(respostaConfig(row));
});

configuracoes.get("/logo", async (c) => {
	const row = await c.env.DB.prepare("SELECT logo_blob, logo_mime FROM configuracoes_aparencia WHERE id = 1").first<{
		logo_blob: ArrayBuffer | number[] | null;
		logo_mime: string | null;
	}>();

	if (!row?.logo_blob) {
		return c.redirect(FALLBACK_LOGO, 302);
	}

	return new Response(bytesParaResponseBody(row.logo_blob), {
		headers: { "Content-Type": row.logo_mime ?? "image/png", "Cache-Control": "no-cache" },
	});
});

configuracoes.get("/favicon", async (c) => {
	const row = await c.env.DB.prepare(
		"SELECT favicon_blob, favicon_mime FROM configuracoes_aparencia WHERE id = 1",
	).first<{ favicon_blob: ArrayBuffer | number[] | null; favicon_mime: string | null }>();

	if (!row?.favicon_blob) {
		return c.redirect(FALLBACK_FAVICON, 302);
	}

	return new Response(bytesParaResponseBody(row.favicon_blob), {
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

	const logoEscalaBruto = body["logo_escala"];
	let logoEscala: number | undefined;
	if (typeof logoEscalaBruto === "string" && logoEscalaBruto.length > 0) {
		logoEscala = Number(logoEscalaBruto);
		if (!Number.isInteger(logoEscala) || logoEscala < LOGO_ESCALA_MIN || logoEscala > LOGO_ESCALA_MAX) {
			return c.json({ error: `tamanho da logo inválido (use entre ${LOGO_ESCALA_MIN} e ${LOGO_ESCALA_MAX})` }, 400);
		}
	}

	const cores: Partial<Record<(typeof CAMPOS_COR)[number], string>> = {};
	for (const campo of CAMPOS_COR) {
		const bruto = body[campo];
		if (typeof bruto !== "string" || bruto.length === 0) continue;
		if (!HEX_REGEX.test(bruto)) {
			return c.json({ error: `cor inválida em "${campo}" (use o formato #rrggbb)` }, 400);
		}
		cores[campo] = bruto.toUpperCase();
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
	if (logoEscala !== undefined) {
		campos.push("logo_escala = ?");
		valores.push(logoEscala);
	}
	for (const [campo, valor] of Object.entries(cores)) {
		campos.push(`${campo} = ?`);
		valores.push(valor);
	}

	await c.env.DB.prepare(`UPDATE configuracoes_aparencia SET ${campos.join(", ")} WHERE id = 1`)
		.bind(...valores)
		.run();

	const row = await c.env.DB.prepare(SELECT_CONFIG).first<LinhaConfig>();

	return c.json(respostaConfig(row));
});

export default configuracoes;

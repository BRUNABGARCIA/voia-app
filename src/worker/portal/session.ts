import { bytesToBase64, bytesToBase64Url } from "../auth/base64";

// Cookie e tabela de sessão TOTALMENTE separados da autenticação interna
// (sessoes/voia_session) — de propósito, para que uma sessão do Portal
// jamais seja resolvida por engano pelo middleware administrativo (ou
// vice-versa). Mesmo nível de segurança (token opaco de 32 bytes, só o
// hash SHA-256 fica no banco).
export const PORTAL_SESSION_COOKIE_NAME = "voia_portal_session";
export const PORTAL_SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 dias

export interface PortalContato {
	id: number;
	nome: string;
	email: string;
	clienteId: number;
	clienteNome: string;
}

function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return bytesToBase64Url(bytes);
}

async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return bytesToBase64(new Uint8Array(digest));
}

export async function createPortalSession(db: D1Database, contatoId: number): Promise<string> {
	const token = randomToken();
	const tokenHash = await hashToken(token);
	const expiraEm = new Date(Date.now() + PORTAL_SESSION_DURATION_SECONDS * 1000).toISOString();

	await db
		.prepare("INSERT INTO sessoes_portal (contato_id, token_hash, expira_em) VALUES (?, ?, ?)")
		.bind(contatoId, tokenHash, expiraEm)
		.run();

	return token;
}

export async function resolvePortalSession(db: D1Database, token: string): Promise<PortalContato | null> {
	const tokenHash = await hashToken(token);

	const row = await db
		.prepare(
			`SELECT cc.id, cc.nome, cc.email, cc.cliente_id, cl.nome AS cliente_nome, sp.expira_em
			 FROM sessoes_portal sp
			 JOIN cliente_contatos cc ON cc.id = sp.contato_id
			 JOIN clientes cl ON cl.id = cc.cliente_id
			 WHERE sp.token_hash = ? AND cc.ativo = 1`,
		)
		.bind(tokenHash)
		.first<{ id: number; nome: string; email: string; cliente_id: number; cliente_nome: string; expira_em: string }>();

	if (!row) return null;

	if (new Date(row.expira_em).getTime() <= Date.now()) {
		await db.prepare("DELETE FROM sessoes_portal WHERE token_hash = ?").bind(tokenHash).run();
		return null;
	}

	return { id: row.id, nome: row.nome, email: row.email, clienteId: row.cliente_id, clienteNome: row.cliente_nome };
}

export async function destroyPortalSession(db: D1Database, token: string): Promise<void> {
	const tokenHash = await hashToken(token);
	await db.prepare("DELETE FROM sessoes_portal WHERE token_hash = ?").bind(tokenHash).run();
}

import { bytesToBase64, bytesToBase64Url } from "./base64";

export const SESSION_COOKIE_NAME = "voia_session";
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 dias

export interface SessionUser {
	id: number;
	nome: string;
	email: string;
	perfil: string;
}

function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return bytesToBase64Url(bytes);
}

async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return bytesToBase64(new Uint8Array(digest));
}

/** Cria uma sessão no D1 e retorna o token cru (só ele vai para o cookie). */
export async function createSession(db: D1Database, usuarioId: number): Promise<string> {
	const token = randomToken();
	const tokenHash = await hashToken(token);
	const expiraEm = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000).toISOString();

	await db
		.prepare("INSERT INTO sessoes (usuario_id, token_hash, expira_em) VALUES (?, ?, ?)")
		.bind(usuarioId, tokenHash, expiraEm)
		.run();

	return token;
}

/** Resolve um token de cookie para o usuário da sessão, ou null se inválida/expirada. */
export async function resolveSession(db: D1Database, token: string): Promise<SessionUser | null> {
	const tokenHash = await hashToken(token);

	const row = await db
		.prepare(
			`SELECT u.id, u.nome, u.email, u.perfil, s.expira_em
			 FROM sessoes s
			 JOIN usuarios u ON u.id = s.usuario_id
			 WHERE s.token_hash = ? AND u.ativo = 1`,
		)
		.bind(tokenHash)
		.first<{ id: number; nome: string; email: string; perfil: string; expira_em: string }>();

	if (!row) return null;

	if (new Date(row.expira_em).getTime() <= Date.now()) {
		await db.prepare("DELETE FROM sessoes WHERE token_hash = ?").bind(tokenHash).run();
		return null;
	}

	return { id: row.id, nome: row.nome, email: row.email, perfil: row.perfil };
}

/** Invalida a sessão no servidor (logout real, não só limpeza de cookie no cliente). */
export async function destroySession(db: D1Database, token: string): Promise<void> {
	const tokenHash = await hashToken(token);
	await db.prepare("DELETE FROM sessoes WHERE token_hash = ?").bind(tokenHash).run();
}

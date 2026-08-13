import { bytesToBase64, base64ToBytes } from "./base64";

const ALGORITHM = "pbkdf2-sha256";
const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);

	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
		keyMaterial,
		KEY_BYTES * 8,
	);

	return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a[i] ^ b[i];
	}
	return diff === 0;
}

/** Deriva um hash de senha no formato "pbkdf2-sha256$iterações$salt$hash" (base64). */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const derived = await deriveBits(password, salt, ITERATIONS);

	return [ALGORITHM, ITERATIONS, bytesToBase64(salt), bytesToBase64(derived)].join("$");
}

/** Verifica uma senha contra um hash armazenado, em tempo constante. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split("$");
	if (parts.length !== 4 || parts[0] !== ALGORITHM) return false;

	const iterations = Number(parts[1]);
	if (!Number.isInteger(iterations) || iterations <= 0) return false;

	const salt = base64ToBytes(parts[2]);
	const expected = base64ToBytes(parts[3]);

	const derived = await deriveBits(password, salt, iterations);
	return timingSafeEqual(derived, expected);
}

#!/usr/bin/env node
// FERRAMENTA TEMPORÁRIA DE DIAGNÓSTICO — não faz parte do app, criada só
// para investigar o incidente "credenciais inválidas mesmo após redefinir
// a senha do administrador em produção". Apagar depois de resolvido.
//
// O que faz:
//   1. Busca (READ-ONLY, só SELECT) o senha_hash atual de um usuário no D1
//      — local por padrão, remoto só com --remote explícito — OU aceita o
//      hash colado manualmente, sem tocar em nenhum banco.
//   2. Pede a senha a testar, interativamente (nunca como argumento de CLI,
//      nunca impressa em lugar nenhum).
//   3. Roda EXATAMENTE a mesma lógica de verifyPassword() de
//      src/worker/auth/hash.ts (duplicada aqui pelo mesmo motivo de
//      scripts/hash-password.mjs: este script roda fora do bundle do
//      Worker, então não pode importar o .ts diretamente sem um passo de
//      build) e informa só MATCH ou NO MATCH.
//
// NUNCA escreve nada — nenhum INSERT/UPDATE/DELETE/ALTER/DROP/CREATE em
// lugar nenhum deste arquivo.
//
// USO (hash colado manualmente — não toca em nenhum banco):
//   node scripts/diagnosticar-login-admin.mjs
//   (escolha "colar o hash" quando perguntado)
//
// USO (busca automática, D1 local):
//   node scripts/diagnosticar-login-admin.mjs
//
// USO (busca automática, D1 REMOTO — só com autorização explícita):
//   node scripts/diagnosticar-login-admin.mjs --remote

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WRANGLER_JS = path.join(SCRIPT_DIR, "..", "node_modules", "wrangler", "bin", "wrangler.js");
const DATABASE_NAME = "voia-db";
const REMOTO_CONFIRMADO = process.argv.includes("--remote");
const ALVO = REMOTO_CONFIRMADO ? "--remote" : "--local";

// --- mesma lógica de src/worker/auth/hash.ts (verifyPassword), duplicada
// aqui — comparada e comprovada compatível byte a byte nesta mesma rodada
// via teste de round-trip contra o hash.ts real compilado.
const ALGORITHM = "pbkdf2-sha256";

async function deriveBits(password, salt, iterations) {
	const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 32 * 8);
	return new Uint8Array(bits);
}

function timingSafeEqual(a, b) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

function base64ToBytes(base64) {
	return new Uint8Array(Buffer.from(base64, "base64"));
}

async function verifyPassword(password, stored) {
	const parts = stored.split("$");
	if (parts.length !== 4 || parts[0] !== ALGORITHM) return { ok: false, motivo: "formato do hash não é pbkdf2-sha256$iter$salt$hash" };

	const iterations = Number(parts[1]);
	if (!Number.isInteger(iterations) || iterations <= 0) return { ok: false, motivo: "iterations inválido no hash" };

	const salt = base64ToBytes(parts[2]);
	const expected = base64ToBytes(parts[3]);
	const derived = await deriveBits(password, salt, iterations);
	return { ok: timingSafeEqual(derived, expected), motivo: null };
}

function ask(rl, promptText) {
	return new Promise((resolve) => rl.question(promptText, (answer) => resolve(answer.trim())));
}

function buscarHashViaWrangler(email) {
	if (!existsSync(WRANGLER_JS)) {
		throw new Error(`Wrangler não encontrado em ${WRANGLER_JS}. Rode "npm install" na raiz do projeto.`);
	}
	const emailEscapado = email.replace(/'/g, "''");
	const sql = `SELECT senha_hash, length(senha_hash) AS tamanho, ativo, perfil FROM usuarios WHERE email = '${emailEscapado}'`;
	const saida = execFileSync(
		process.execPath,
		[WRANGLER_JS, "d1", "execute", DATABASE_NAME, ALVO, "--json", "--command", sql],
		{ encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
	);
	const parsed = JSON.parse(saida);
	const bloco = Array.isArray(parsed) ? parsed[0] : parsed;
	return bloco?.results?.[0] ?? null;
}

async function main() {
	console.log(`Alvo do banco (se buscar automaticamente): ${REMOTO_CONFIRMADO ? "REMOTO (voia-db --remote)" : "LOCAL (voia-db --local)"}`);
	if (!REMOTO_CONFIRMADO) {
		console.log('Passe "--remote" para buscar no banco remoto. Sem isso, busca automática vai no local.\n');
	} else {
		console.log("⚠ Busca automática vai consultar o REMOTO — só SELECT, nenhuma escrita.\n");
	}

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	try {
		const email = (await ask(rl, "E-mail do usuário a diagnosticar: ")) || "contato@voiaengenharia.com";

		const colarHash = (await ask(rl, "Colar o senha_hash manualmente em vez de buscar? (s/N): ")).toLowerCase() === "s";

		let hash;
		if (colarHash) {
			hash = await ask(rl, "Cole o senha_hash completo: ");
		} else {
			console.log("\nBuscando senha_hash...");
			const linha = buscarHashViaWrangler(email);
			if (!linha) {
				throw new Error(`Nenhum usuário encontrado com email = ${email} no banco ${ALVO}.`);
			}
			console.log(`Encontrado: ativo=${linha.ativo}, perfil=${linha.perfil}, tamanho(senha_hash)=${linha.tamanho}`);
			console.log(`Início do hash: ${String(linha.senha_hash).slice(0, 20)}...`);
			hash = linha.senha_hash;
		}

		if (!hash || typeof hash !== "string") {
			throw new Error("senha_hash vazio ou ausente — não há o que verificar.");
		}

		const senha = await ask(rl, "\nSenha a testar (fica visível ao digitar, nunca é impressa de volta): ");

		const resultado = await verifyPassword(senha, hash);

		console.log("\n=== RESULTADO ===");
		if (resultado.motivo) {
			console.log(`NO MATCH — ${resultado.motivo}`);
		} else {
			console.log(resultado.ok ? "MATCH ✓ (a senha digitada corresponde a este hash)" : "NO MATCH ✗ (a senha digitada NÃO corresponde a este hash)");
		}
	} finally {
		rl.close();
	}
}

main().catch((err) => {
	console.error(`\nErro: ${err.message}`);
	process.exitCode = 1;
});

#!/usr/bin/env node
// Gera o hash PBKDF2 de uma senha, para ativar um usuário em desenvolvimento
// (ex.: admin@voia.local, que nasce sem senha na migration 0002_auth.sql).
//
// A senha é digitada de forma interativa e oculta (nunca como argumento de
// linha de comando, para não ficar registrada no histórico do shell).
// Nada aqui é enviado pela rede nem gravado em arquivo — a saída é só o
// comando SQL, para você executar manualmente contra o D1 local (ou remoto,
// com autorização) e depois descartar do terminal.
//
// IMPORTANTE: os parâmetros abaixo (algoritmo, iterações, tamanhos) devem
// ficar em sincronia com src/worker/auth/hash.ts — são a mesma implementação
// duplicada aqui porque este script roda fora do bundle do Worker.

import readline from "node:readline";

const ALGORITHM = "pbkdf2-sha256";
const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

// Códigos de controle do terminal identificados por charCode, para não
// depender de bytes de controle literais no arquivo-fonte (frágeis ao
// serem transmitidos/versionados).
const KEY_ENTER = "\n";
const KEY_RETURN = "\r";
const KEY_EOF = String.fromCharCode(4); // Ctrl-D
const KEY_INTERRUPT = String.fromCharCode(3); // Ctrl-C
const KEY_BACKSPACE = String.fromCharCode(127); // Backspace/Delete

async function hashPassword(password) {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		KEY_BYTES * 8,
	);

	return [
		ALGORITHM,
		ITERATIONS,
		Buffer.from(salt).toString("base64"),
		Buffer.from(new Uint8Array(bits)).toString("base64"),
	].join("$");
}

function ask(promptText) {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) =>
		rl.question(promptText, (answer) => {
			rl.close();
			resolve(answer.trim());
		}),
	);
}

function askHidden(promptText) {
	if (!process.stdin.isTTY) {
		throw new Error("Este script precisa rodar num terminal interativo (stdin não é um TTY).");
	}

	return new Promise((resolve, reject) => {
		process.stdout.write(promptText);
		const stdin = process.stdin;
		stdin.resume();
		stdin.setRawMode(true);
		stdin.setEncoding("utf8");

		let input = "";

		const onData = (char) => {
			if (char === KEY_ENTER || char === KEY_RETURN || char === KEY_EOF) {
				stdin.setRawMode(false);
				stdin.pause();
				stdin.removeListener("data", onData);
				process.stdout.write("\n");
				resolve(input);
				return;
			}

			if (char === KEY_INTERRUPT) {
				stdin.setRawMode(false);
				stdin.pause();
				process.stdout.write("\n");
				reject(new Error("Cancelado."));
				return;
			}

			if (char === KEY_BACKSPACE) {
				input = input.slice(0, -1);
				return;
			}

			input += char;
		};

		stdin.on("data", onData);
	});
}

async function main() {
	const email = await ask("E-mail do usuário (ex.: admin@voia.local): ");
	if (!email) {
		throw new Error("E-mail é obrigatório.");
	}

	const senha = await askHidden("Nova senha (não será exibida): ");
	const confirmacao = await askHidden("Confirme a senha: ");

	if (senha.length < 8) {
		throw new Error("A senha precisa ter pelo menos 8 caracteres.");
	}
	if (senha !== confirmacao) {
		throw new Error("As senhas não conferem.");
	}

	const hash = await hashPassword(senha);
	const sql = `UPDATE usuarios SET senha_hash = '${hash}' WHERE email = '${email.replace(/'/g, "''")}';`;

	console.log("\nComando SQL gerado (não contém a senha em texto puro):\n");
	console.log(sql);
	console.log("\nExecute manualmente, por exemplo:\n");
	console.log(`  npx wrangler d1 execute voia-db --local --command "${sql.replace(/"/g, '\\"')}"`);
	console.log("\nPara aplicar no banco remoto, use --remote apenas com autorização explícita.");
	console.log("Não cole este comando em nenhum arquivo versionado.");
}

main().catch((err) => {
	console.error(`\nErro: ${err.message}`);
	process.exitCode = 1;
});

#!/usr/bin/env node
// Gera o hash PBKDF2 de uma senha, para ativar um usuário em desenvolvimento
// (ex.: admin@voia.local, que nasce sem senha na migration 0002_auth.sql).
//
// A senha é digitada de forma interativa (nunca como argumento de linha de
// comando, para não ficar registrada no histórico do shell). Os caracteres
// ficam VISÍVEIS no terminal ao digitar — intencional: este é um script
// administrativo rodado manualmente no seu computador, não a tela de login
// do VOIA APP. Nada aqui é enviado pela rede nem gravado em arquivo — a
// saída é só o comando SQL, para você executar manualmente contra o D1
// local (ou remoto, com autorização) e depois descartar do terminal.
//
// IMPORTANTE: os parâmetros abaixo (algoritmo, iterações, tamanhos) devem
// ficar em sincronia com src/worker/auth/hash.ts — são a mesma implementação
// duplicada aqui porque este script roda fora do bundle do Worker.

import readline from "node:readline";

const ALGORITHM = "pbkdf2-sha256";
// Precisa ficar em sincronia com src/worker/auth/hash.ts. Cloudflare
// Workers rejeita PBKDF2 com iterations acima de 100_000
// (NotSupportedError), então o limite é esse, não uma preferência.
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

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

function ask(rl, promptText) {
	return new Promise((resolve) => rl.question(promptText, (answer) => resolve(answer.trim())));
}

async function main() {
	// Uma única interface reaproveitada nas três perguntas: criar uma nova
	// a cada pergunta perde entrada em stdin não-interativo (pipe/arquivo),
	// já que a interface anterior pode consumir dados além da linha que
	// respondeu antes de ser fechada.
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

	try {
		const email = await ask(rl, "E-mail do usuário (ex.: admin@voia.local): ");
		if (!email) {
			throw new Error("E-mail é obrigatório.");
		}

		const senha = await ask(rl, "Nova senha (os caracteres ficam visíveis): ");
		const confirmacao = await ask(rl, "Confirme a senha: ");

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
	} finally {
		rl.close();
	}
}

main().catch((err) => {
	console.error(`\nErro: ${err.message}`);
	process.exitCode = 1;
});

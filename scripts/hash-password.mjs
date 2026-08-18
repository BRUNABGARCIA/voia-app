#!/usr/bin/env node
// Gera o hash PBKDF2 de uma senha, para ativar/redefinir um usuário
// administrativo (ex.: admin@voia.local, que nasce sem senha na migration
// 0002_auth.sql).
//
// A senha é digitada de forma interativa (nunca como argumento de linha de
// comando, para não ficar registrada no histórico do shell). Os caracteres
// ficam VISÍVEIS no terminal ao digitar — intencional: este é um script
// administrativo rodado manualmente no seu computador, não a tela de login
// do VOIA APP.
//
// IMPORTANTE: os parâmetros abaixo (algoritmo, iterações, tamanhos) devem
// ficar em sincronia com src/worker/auth/hash.ts — são a mesma implementação
// duplicada aqui porque este script roda fora do bundle do Worker.
//
// APLICAÇÃO OPCIONAL NO D1 REMOTO: depois de gerar o hash, o script sempre
// mostra o comando SQL (para revisão e para os fluxos manuais --local/
// --remote já existentes) e, opcionalmente, pode aplicá-lo diretamente no
// D1 remoto — SÓ com dupla confirmação explícita (a resposta "s" à
// pergunta inicial, seguida de digitar literalmente "APLICAR"). O padrão é
// NÃO aplicar; qualquer resposta que não seja exatamente essa sequência
// deixa o banco intocado e só imprime o SQL, como antes.
//
// EXECUÇÃO DO WRANGLER — mesmo padrão já corrigido em
// scripts/auditar-migrations-remotas.mjs: invoca node_modules/wrangler/
// bin/wrangler.js diretamente pelo node (via execFileSync com array de
// argumentos), nunca "npx", nunca shell — evita o ENOENT do Windows CMD e
// evita qualquer reinterpretação do SQL por um shell.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WRANGLER_JS = path.join(SCRIPT_DIR, "..", "node_modules", "wrangler", "bin", "wrangler.js");
const DATABASE_NAME = "voia-db";

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

/** Escapa um valor para uso como literal SQL (dobra aspas simples) — não há suporte a parâmetros ligados via "wrangler d1 execute --command", só --command/--file com SQL literal, então este é o mecanismo seguro disponível. Aplicado tanto ao e-mail quanto ao hash, mesmo o hash sendo só base64 (sem aspas possíveis) — defesa em profundidade. */
function escaparSqlString(valor) {
	return valor.replace(/'/g, "''");
}

function ask(rl, promptText) {
	return new Promise((resolve) => rl.question(promptText, (answer) => resolve(answer.trim())));
}

/** Executa o wrangler já instalado localmente, direto pelo node — sem npx, sem shell, argumentos passados como array (nunca concatenados em uma string de comando). */
function executarWrangler(args) {
	if (!existsSync(WRANGLER_JS)) {
		throw new Error(`Wrangler não encontrado em ${WRANGLER_JS}. Rode "npm install" na raiz do projeto.`);
	}
	try {
		return execFileSync(process.execPath, [WRANGLER_JS, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
	} catch (err) {
		// Node embute o argv completo (que inclui o SQL com o hash) na
		// mensagem padrão de erro de execFileSync — nunca deixamos isso
		// propagar. Relança só o stderr do próprio wrangler.
		const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr).trim() : "";
		throw new Error(stderr || "falha ao executar o wrangler (sem detalhes de stderr)");
	}
}

/** SELECT read-only pós-aplicação — nunca retorna/imprime o hash completo, só um prefixo curto (algoritmo + iterações, sem salt/derivado). */
function confirmarAplicacao(emailEscapado) {
	const sql = `SELECT length(senha_hash) AS tamanho, ativo, perfil, substr(senha_hash, 1, 21) AS prefixo FROM usuarios WHERE email = '${emailEscapado}'`;
	const saida = executarWrangler(["d1", "execute", DATABASE_NAME, "--remote", "--json", "--command", sql]);
	const parsed = JSON.parse(saida);
	const bloco = Array.isArray(parsed) ? parsed[0] : parsed;
	return bloco?.results?.[0] ?? null;
}

async function main() {
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
		const emailEscapado = escaparSqlString(email);
		const hashEscapado = escaparSqlString(hash);
		const sql = `UPDATE usuarios SET senha_hash = '${hashEscapado}' WHERE email = '${emailEscapado}';`;

		console.log("\nComando SQL gerado (não contém a senha em texto puro):\n");
		console.log(sql);
		console.log("\nPara aplicar manualmente, por exemplo:\n");
		console.log(`  node node_modules/wrangler/bin/wrangler.js d1 execute ${DATABASE_NAME} --local --command "${sql.replace(/"/g, '\\"')}"`);
		console.log("\nPara aplicar manualmente no remoto, troque --local por --remote, só com autorização explícita.");
		console.log("Não cole este comando em nenhum arquivo versionado.");

		const desejaAplicar = (await ask(rl, "\nDeseja aplicar esta nova senha diretamente no D1 remoto? (s/N): ")).toLowerCase();
		if (desejaAplicar !== "s") {
			console.log("\nNada foi aplicado. Use o comando acima manualmente quando quiser.");
			return;
		}

		const confirmacaoFinal = await ask(rl, 'Digite APLICAR para confirmar a alteração no banco REMOTO: ');
		if (confirmacaoFinal !== "APLICAR") {
			console.log("\nConfirmação não corresponde a \"APLICAR\" — nada foi aplicado.");
			return;
		}

		console.log("\nAplicando no D1 remoto...");
		executarWrangler(["d1", "execute", DATABASE_NAME, "--remote", "--command", sql]);
		console.log("Comando executado. Verificando o resultado (só leitura)...\n");

		const linha = confirmarAplicacao(emailEscapado);
		if (!linha) {
			console.log("ATENÇÃO: nenhum usuário encontrado com esse e-mail após a aplicação — confira o e-mail informado.");
			return;
		}

		console.log("=== Confirmação (sem expor o hash completo) ===");
		console.log(`ativo: ${linha.ativo}`);
		console.log(`perfil: ${linha.perfil}`);
		console.log(`tamanho(senha_hash): ${linha.tamanho}`);
		console.log(`início do hash: ${linha.prefixo}...`);
		console.log("\nSessões já existentes desse usuário NÃO são invalidadas automaticamente por esta troca de senha.");
	} finally {
		rl.close();
	}
}

main().catch((err) => {
	console.error(`\nErro: ${err.message}`);
	process.exitCode = 1;
});

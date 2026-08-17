#!/usr/bin/env node
// Semeia os modelos padrão de processo (etapas + tarefas) por Tipo de
// Serviço — Etapa F, Rodada F3.
//
// Usa a própria API administrativa já existente (/api/tipos-servico/*) em
// vez de escrever diretamente no D1: reaproveita toda a validação (Zod) e
// as regras de negócio (ordem automática, defaults de coluna, etc.) já
// implementadas no worker, em vez de duplicá-las em SQL solto que
// precisaria ser mantido em sincronia manualmente com o schema.
//
// IDEMPOTÊNCIA: para cada tipo de serviço, o script só cria etapas/tarefas
// se esse tipo ainda não tiver NENHUMA etapa modelo cadastrada
// (total_etapas_modelo === 0, já retornado por GET /api/tipos-servico).
// Rodar de novo não duplica nada — qualquer tipo que já tenha etapas
// (de qualquer origem, cadastradas por este script ou manualmente) é
// sempre pulado, sem nenhum caso especial por tipo. Nunca toca em
// projetos já criados (só existem etapas de PROJETO por cópia do modelo
// no momento da criação — editar o modelo depois não afeta projetos
// existentes, como já validado na Etapa E).
//
// Os tipos de serviço são resolvidos por NOME (não por id fixo) contra o
// catálogo real em tipos_servico — se um nome esperado não existir, o
// script para imediatamente com erro claro, sem deixar nenhum tipo
// parcialmente cadastrado.
//
// USO (local, padrão):
//   node scripts/seed-tipos-servico-modelos.mjs
//   (pede e-mail/senha do administrador interativamente se as variáveis
//   de ambiente abaixo não estiverem definidas)
//
//   VOIA_ADMIN_EMAIL=admin@voia.local VOIA_ADMIN_SENHA='...' node scripts/seed-tipos-servico-modelos.mjs
//
// USO (remoto, controlado — só com autorização explícita, nunca automático):
//   VOIA_BASE_URL=https://<worker-remoto> \
//   VOIA_ADMIN_EMAIL=... VOIA_ADMIN_SENHA=... \
//   VOIA_CONFIRMAR_REMOTO=SIM \
//   node scripts/seed-tipos-servico-modelos.mjs
// Sem VOIA_CONFIRMAR_REMOTO=SIM, o script recusa rodar contra qualquer URL
// que não seja localhost/127.0.0.1, para não haver execução remota
// acidental.
//
// MODO AUDITORIA (--check), Rodada F3.1: só faz GET, nunca escreve.
//   node scripts/seed-tipos-servico-modelos.mjs --check
// Compara a biblioteca versionada (seed-data) com o que está no banco
// alvo, tipo a tipo, e reporta: tipo ausente do catálogo, modelo ausente
// no banco (nunca semeado) e qualquer divergência de etapas/tarefas
// (quantidade, nome, ordem, prazo_dias, visivel_cliente) — útil tanto para
// conferir o D1 local quanto, mais tarde, para auditar um ambiente remoto
// sem nenhum risco de escrita. Sai com código 1 se encontrar qualquer
// problema, 0 se tudo estiver coerente.

import readline from "node:readline";
import { MODELOS } from "./seed-data/tipos-servico-modelos.mjs";

const BASE_URL = (process.env.VOIA_BASE_URL || "http://localhost:8788").trim().replace(/\/+$/, "");

function ehLocal(url) {
	try {
		const host = new URL(url).hostname;
		return host === "localhost" || host === "127.0.0.1";
	} catch {
		return false;
	}
}

if (!ehLocal(BASE_URL) && process.env.VOIA_CONFIRMAR_REMOTO !== "SIM") {
	console.error(
		`\nVOIA_BASE_URL (${BASE_URL}) não é local, e VOIA_CONFIRMAR_REMOTO=SIM não foi definido.\n` +
			"Por segurança, este script recusa rodar contra um ambiente que não seja localhost sem confirmação explícita.\n" +
			"Defina VOIA_CONFIRMAR_REMOTO=SIM apenas quando tiver autorização para aplicar os modelos remotamente.\n",
	);
	process.exit(1);
}

function ask(rl, promptText) {
	return new Promise((resolve) => rl.question(promptText, (answer) => resolve(answer.trim())));
}

async function obterCredenciais() {
	let email = process.env.VOIA_ADMIN_EMAIL?.trim();
	let senha = process.env.VOIA_ADMIN_SENHA;
	if (email && senha) return { email, senha };

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	try {
		if (!email) email = await ask(rl, "E-mail do administrador: ");
		if (!senha) senha = await ask(rl, "Senha: ");
	} finally {
		rl.close();
	}
	return { email, senha };
}

async function login(email, senha) {
	const res = await fetch(`${BASE_URL}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, senha }),
	});
	if (!res.ok) {
		throw new Error(`Login falhou (${res.status}). Confira e-mail/senha do administrador.`);
	}
	const setCookie =
		typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
	const sessao = setCookie.map((c) => c.split(";")[0]).find((c) => c.startsWith("voia_session="));
	if (!sessao) {
		throw new Error("Login OK, mas nenhum cookie de sessão foi retornado — não é possível continuar.");
	}
	return sessao;
}

async function api(cookie, method, path, body) {
	const res = await fetch(`${BASE_URL}${path}`, {
		method,
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		throw new Error(`${method} ${path} -> HTTP ${res.status}: ${JSON.stringify(data)}`);
	}
	return data;
}

function compararEtapa(esperada, real) {
	const problemas = [];
	if (esperada.nome !== real.nome) {
		problemas.push(`nome: esperado "${esperada.nome}", encontrado "${real.nome}"`);
	}
	const prazoEsperado = esperada.prazo_dias ?? null;
	const prazoReal = real.prazo_dias ?? null;
	if (prazoEsperado !== prazoReal) {
		problemas.push(`prazo_dias: esperado ${prazoEsperado}, encontrado ${prazoReal}`);
	}
	const visEsperado = esperada.visivel_cliente ? 1 : 0;
	const visReal = real.visivel_cliente ? 1 : 0;
	if (visEsperado !== visReal) {
		problemas.push(`visivel_cliente: esperado ${visEsperado}, encontrado ${visReal}`);
	}
	if (real.ativa !== 1) {
		problemas.push(`ativa: esperado 1, encontrado ${real.ativa}`);
	}
	return problemas;
}

function auditarModelo(modelo, etapasReais) {
	const problemas = [];
	if (etapasReais.length !== modelo.etapas.length) {
		problemas.push(`quantidade de etapas: esperado ${modelo.etapas.length}, encontrado ${etapasReais.length}`);
	}

	const n = Math.min(etapasReais.length, modelo.etapas.length);
	for (let i = 0; i < n; i++) {
		const esperada = modelo.etapas[i];
		const real = etapasReais[i];
		for (const d of compararEtapa(esperada, real)) {
			problemas.push(`etapa #${i} ("${esperada.nome}"): ${d}`);
		}

		if (real.tarefas.length !== esperada.tarefas.length) {
			problemas.push(
				`etapa #${i} ("${esperada.nome}"): quantidade de tarefas esperado ${esperada.tarefas.length}, encontrado ${real.tarefas.length}`,
			);
		}
		const nt = Math.min(real.tarefas.length, esperada.tarefas.length);
		for (let j = 0; j < nt; j++) {
			if (esperada.tarefas[j] !== real.tarefas[j].nome) {
				problemas.push(
					`etapa #${i} ("${esperada.nome}"), tarefa #${j}: esperado "${esperada.tarefas[j]}", encontrado "${real.tarefas[j].nome}"`,
				);
			}
		}
	}
	return problemas;
}

async function rodarCheck(cookie) {
	console.log("Modo --check: somente leitura, nenhuma escrita será feita.\n");

	const { tiposServico } = await api(cookie, "GET", "/api/tipos-servico");
	const porNome = new Map(tiposServico.map((t) => [t.nome, t]));

	const resumo = [];
	let algumProblema = false;

	for (const modelo of MODELOS) {
		const tipo = porNome.get(modelo.nomeTipoServico);
		if (!tipo) {
			console.log(`AUSENTE   ${modelo.nomeTipoServico} — tipo de serviço não encontrado no catálogo (tipos_servico).`);
			resumo.push({ tipo: modelo.nomeTipoServico, status: "tipo ausente do catálogo", problemas: 1 });
			algumProblema = true;
			continue;
		}

		if (tipo.total_etapas_modelo === 0) {
			console.log(`AUSENTE   ${modelo.nomeTipoServico} (id=${tipo.id}) — modelo nunca semeado neste banco (0 etapas).`);
			resumo.push({ tipo: modelo.nomeTipoServico, status: "modelo ausente do banco", problemas: 1 });
			algumProblema = true;
			continue;
		}

		const { etapasModelo } = await api(cookie, "GET", `/api/tipos-servico/${tipo.id}/modelo`);
		const problemas = auditarModelo(modelo, etapasModelo);

		if (problemas.length === 0) {
			console.log(`OK        ${modelo.nomeTipoServico} (id=${tipo.id}) — coerente com a biblioteca.`);
			resumo.push({ tipo: modelo.nomeTipoServico, status: "coerente", problemas: 0 });
		} else {
			console.log(`DIVERGENTE ${modelo.nomeTipoServico} (id=${tipo.id}) — ${problemas.length} divergência(s):`);
			for (const p of problemas) console.log(`    - ${p}`);
			resumo.push({ tipo: modelo.nomeTipoServico, status: "divergente", problemas: problemas.length });
			algumProblema = true;
		}
	}

	console.log("\n=== RESUMO (--check) ===");
	console.table(resumo);

	if (algumProblema) {
		console.log("\nResultado: HÁ DIVERGÊNCIAS entre a biblioteca versionada e o banco alvo.");
		process.exitCode = 1;
	} else {
		console.log("\nResultado: banco alvo 100% coerente com a biblioteca versionada.");
	}
}

async function rodarSeed(cookie) {
	const { tiposServico } = await api(cookie, "GET", "/api/tipos-servico");
	const porNome = new Map(tiposServico.map((t) => [t.nome, t]));

	const resumo = [];
	for (const modelo of MODELOS) {
		const tipo = porNome.get(modelo.nomeTipoServico);
		if (!tipo) {
			const disponiveis = tiposServico.map((t) => t.nome).join(", ");
			throw new Error(
				`Tipo de serviço "${modelo.nomeTipoServico}" não encontrado no catálogo (tipos_servico).\n` +
					`Tipos disponíveis: ${disponiveis}\n` +
					"Execução interrompida — nenhuma alteração parcial foi feita para este tipo.",
			);
		}

		if (tipo.total_etapas_modelo > 0) {
			console.log(`SKIP  ${modelo.nomeTipoServico} (id=${tipo.id}) — já possui ${tipo.total_etapas_modelo} etapa(s) modelo; preservado.`);
			resumo.push({ tipo: modelo.nomeTipoServico, status: "preservado (já existia)", etapas: tipo.total_etapas_modelo, tarefas: "-" });
			continue;
		}

		let totalTarefas = 0;
		for (const etapaDef of modelo.etapas) {
			const { etapaModelo } = await api(cookie, "POST", `/api/tipos-servico/${tipo.id}/modelo`, {
				nome: etapaDef.nome,
				prazo_dias: etapaDef.prazo_dias,
				visivel_cliente: etapaDef.visivel_cliente,
				ativa: true,
			});
			for (const nomeTarefa of etapaDef.tarefas) {
				await api(cookie, "POST", `/api/tipos-servico/${tipo.id}/modelo/${etapaModelo.id}/tarefas`, {
					nome: nomeTarefa,
					prioridade_padrao: "normal",
					responsavel_padrao_id: null,
					visivel_cliente: etapaDef.visivel_cliente,
					exige_aprovacao: false,
					ativa: true,
				});
				totalTarefas += 1;
			}
		}
		console.log(`OK    ${modelo.nomeTipoServico} (id=${tipo.id}) — ${modelo.etapas.length} etapas, ${totalTarefas} tarefas criadas.`);
		resumo.push({ tipo: modelo.nomeTipoServico, status: "criado", etapas: modelo.etapas.length, tarefas: totalTarefas });
	}

	console.log("\n=== RESUMO ===");
	console.table(resumo);
}

async function main() {
	const modoCheck = process.argv.includes("--check");

	console.log(`Alvo: ${BASE_URL}${modoCheck ? " (modo --check, somente leitura)" : ""}`);
	const { email, senha } = await obterCredenciais();
	const cookie = await login(email, senha);
	console.log(`Login OK (${email}).\n`);

	if (modoCheck) {
		await rodarCheck(cookie);
	} else {
		await rodarSeed(cookie);
	}
}

main().catch((err) => {
	console.error(`\nErro: ${err.message}`);
	process.exitCode = 1;
});

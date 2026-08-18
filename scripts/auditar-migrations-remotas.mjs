#!/usr/bin/env node
// Auditoria READ-ONLY do estado das migrations 0003–0020 num banco D1 —
// Rodada "Fechamento definitivo do VOIA App interno".
//
// CONTEXTO: a tabela de controle `d1_migrations` do D1 remoto só registra
// 0001_init_base.sql e 0002_auth.sql como aplicadas, embora o schema remoto
// já tenha as estruturas de todas as migrations até 0020 (0019/0020 foram
// aplicadas manualmente via `wrangler d1 execute --file`, que nunca grava
// em d1_migrations). Rodar `wrangler d1 migrations apply --remote` hoje
// trataria 0003–0020 como pendentes e tentaria reexecutá-las — algumas
// falhariam com erro de coluna/linha duplicada, mas 0003 e 0006 fazem
// rebuild de tabela e, se reaplicadas, podem apagar dado real em produção
// silenciosamente. Ver docs/RECONCILIACAO-D1-MIGRATIONS.md.
//
// Este script NUNCA escreve — só consultas SELECT/PRAGMA contra o banco
// (sqlite_master, PRAGMA table_info). Ele NÃO aplica nenhuma migration,
// NÃO grava em d1_migrations, NÃO altera schema nem dado nenhum. Serve
// só para comprovar, coluna a coluna e tabela a tabela, se o estado final
// de cada migration 0003–0020 já existe no banco consultado.
//
// USO (padrão, local — seguro, é o que valida o script nesta rodada):
//   node scripts/auditar-migrations-remotas.mjs
//
// USO (remoto — só com autorização explícita, nunca automático):
//   VOIA_D1_REMOTE=SIM node scripts/auditar-migrations-remotas.mjs
// Sem VOIA_D1_REMOTE=SIM, o script sempre consulta o banco D1 LOCAL
// (--local do wrangler), nunca o remoto — mesmo padrão de segurança já
// usado em scripts/seed-tipos-servico-modelos.mjs (recusa remoto por
// padrão, exige confirmação explícita via variável de ambiente).

import { execFileSync } from "node:child_process";

const DATABASE_NAME = "voia-db";
const REMOTO_CONFIRMADO = process.env.VOIA_D1_REMOTE === "SIM";
const ALVO = REMOTO_CONFIRMADO ? "--remote" : "--local";

function executarSql(sql) {
	const saida = execFileSync(
		"npx",
		["wrangler", "d1", "execute", DATABASE_NAME, ALVO, "--json", "--command", sql],
		{ encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
	);
	// wrangler --json emite um array de resultados (um por statement); cada
	// item tem "results". Aceitamos também um objeto único, por segurança
	// entre versões do wrangler.
	const parsed = JSON.parse(saida);
	const bloco = Array.isArray(parsed) ? parsed[0] : parsed;
	return bloco?.results ?? [];
}

async function tabelaExiste(nome) {
	const rows = await executarSql(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${nome}'`);
	return rows.length > 0;
}

async function indiceExiste(nome) {
	const rows = await executarSql(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = '${nome}'`);
	return rows.length > 0;
}

async function colunasDaTabela(nome) {
	const rows = await executarSql(`PRAGMA table_info(${nome})`);
	return new Set(rows.map((r) => r.name));
}

async function sqlDaTabela(nome) {
	const rows = await executarSql(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${nome}'`);
	return rows[0]?.sql ?? null;
}

async function contarLinhas(tabela, whereSql) {
	const rows = await executarSql(`SELECT COUNT(*) AS n FROM ${tabela} WHERE ${whereSql}`);
	return Number(rows[0]?.n ?? 0);
}

/**
 * Cada migration vira uma lista de "asserts". Um assert que não puder ser
 * verificado com segurança marca manual:true — a migration inteira vira
 * REVISÃO MANUAL nesse caso, nunca é assumida PRESENTE por omissão.
 */
const MIGRATIONS = [
	{
		id: "0001_init_base",
		asserts: [
			{ tipo: "tabela", nome: "usuarios" },
			{ tipo: "tabela", nome: "projetos" },
			{ tipo: "linhas_min", tabela: "usuarios", where: "email = 'admin@voia.local'", min: 1 },
		],
	},
	{
		id: "0002_auth",
		asserts: [
			{ tipo: "coluna", tabela: "usuarios", nome: "senha_hash" },
			{ tipo: "tabela", nome: "sessoes" },
		],
	},
	{
		id: "0003_equipe_permissoes",
		asserts: [
			{ tipo: "coluna", tabela: "usuarios", nome: "ultimo_login_em" },
			{ tipo: "check_texto", tabela: "usuarios", contem: "visualizador" },
		],
	},
	{
		id: "0004_configuracoes_aparencia",
		asserts: [
			{ tipo: "tabela", nome: "configuracoes_aparencia" },
			{ tipo: "linhas_min", tabela: "configuracoes_aparencia", where: "id = 1", min: 1 },
		],
	},
	{
		id: "0005_logo_escala",
		asserts: [{ tipo: "coluna", tabela: "configuracoes_aparencia", nome: "logo_escala" }],
	},
	{
		id: "0006_clientes_e_projetos",
		asserts: [
			{ tipo: "tabela", nome: "clientes" },
			{ tipo: "coluna", tabela: "projetos", nome: "cliente_id" },
			{ tipo: "manual", motivo: "rebuild de tabela (organizacoes → clientes, projetos) — confirmar ausência de organizacoes e integridade dos dados copiados manualmente antes de considerar reconciliado" },
		],
	},
	{
		id: "0007_tipos_servico_contadores",
		asserts: [
			{ tipo: "tabela", nome: "contadores" },
			{ tipo: "tabela", nome: "tipos_servico" },
			{ tipo: "tabela", nome: "projeto_tipos_servico" },
			{ tipo: "linhas_min", tabela: "tipos_servico", where: "nome IS NOT NULL", min: 16 },
		],
	},
	{ id: "0008_projeto_membros", asserts: [{ tipo: "tabela", nome: "projeto_membros" }] },
	{ id: "0009_projeto_etapas", asserts: [{ tipo: "tabela", nome: "projeto_etapas" }] },
	{
		id: "0010_aparencia_cores",
		asserts: [
			"cor_principal",
			"cor_destaque",
			"cor_fundo",
			"cor_superficie",
			"cor_sidebar",
			"cor_texto_principal",
			"cor_texto_secundario",
		].map((nome) => ({ tipo: "coluna", tabela: "configuracoes_aparencia", nome })),
	},
	{ id: "0011_tipo_servico_etapas_modelo", asserts: [{ tipo: "tabela", nome: "tipo_servico_etapas_modelo" }] },
	{
		id: "0012_projeto_etapas_processo",
		asserts: [
			"tipo_servico_id",
			"modelo_etapa_id",
			"peso",
			"data_inicio_prevista",
			"data_fim_prevista",
			"data_inicio_real",
			"observacao_interna",
			"visivel_cliente",
		].map((nome) => ({ tipo: "coluna", tabela: "projeto_etapas", nome })),
	},
	{ id: "0013_projeto_atualizacoes", asserts: [{ tipo: "tabela", nome: "projeto_atualizacoes" }] },
	{
		id: "0014_portal_cliente",
		asserts: [
			{ tipo: "tabela", nome: "cliente_contatos" },
			{ tipo: "tabela", nome: "cliente_contato_processos" },
			{ tipo: "tabela", nome: "sessoes_portal" },
		],
	},
	{ id: "0015_tipo_servico_modelo_ativa", asserts: [{ tipo: "coluna", tabela: "tipo_servico_etapas_modelo", nome: "ativa" }] },
	{ id: "0016_tipo_servico_modelo_tarefa", asserts: [{ tipo: "tabela", nome: "tipo_servico_modelo_tarefa" }] },
	{ id: "0017_projeto_tarefas", asserts: [{ tipo: "tabela", nome: "projeto_tarefas" }] },
	{
		id: "0018_projeto_atualizacoes_generico",
		asserts: ["entidade_tipo", "entidade_id", "tipo_evento"].map((nome) => ({
			tipo: "coluna",
			tabela: "projeto_atualizacoes",
			nome,
		})),
	},
	{ id: "0019_projeto_documentos", asserts: [{ tipo: "tabela", nome: "projeto_documentos" }] },
	{
		id: "0020_projeto_documentos_arquivo",
		asserts: ["nome_arquivo_original", "mime_type", "tamanho_bytes"].map((nome) => ({
			tipo: "coluna",
			tabela: "projeto_documentos",
			nome,
		})),
	},
];

async function avaliarAssert(assert) {
	switch (assert.tipo) {
		case "tabela":
			return { ok: await tabelaExiste(assert.nome), detalhe: `tabela "${assert.nome}"` };
		case "indice":
			return { ok: await indiceExiste(assert.nome), detalhe: `índice "${assert.nome}"` };
		case "coluna": {
			const colunas = await colunasDaTabela(assert.tabela);
			return { ok: colunas.has(assert.nome), detalhe: `coluna "${assert.tabela}.${assert.nome}"` };
		}
		case "linhas_min": {
			const n = await contarLinhas(assert.tabela, assert.where);
			return { ok: n >= assert.min, detalhe: `"${assert.tabela}" WHERE ${assert.where} (${n} linha(s), esperado >= ${assert.min})` };
		}
		case "check_texto": {
			const sql = await sqlDaTabela(assert.tabela);
			return { ok: !!sql && sql.includes(assert.contem), detalhe: `definição de "${assert.tabela}" contém "${assert.contem}"` };
		}
		case "manual":
			return { ok: null, detalhe: assert.motivo };
		default:
			return { ok: false, detalhe: `tipo de verificação desconhecido: ${assert.tipo}` };
	}
}

async function main() {
	console.log(`Alvo: ${REMOTO_CONFIRMADO ? "REMOTO (voia-db --remote)" : "LOCAL (voia-db --local)"}`);
	if (!REMOTO_CONFIRMADO) {
		console.log("Defina VOIA_D1_REMOTE=SIM para consultar o banco remoto. Sem isso, sempre consulta o local.\n");
	} else {
		console.log("⚠ Consultando o banco REMOTO — somente leitura (SELECT/PRAGMA), nenhuma escrita será feita.\n");
	}

	let algumaDivergente = false;
	let algumaManual = false;

	for (const migration of MIGRATIONS) {
		const resultados = [];
		for (const assert of migration.asserts) {
			try {
				resultados.push(await avaliarAssert(assert));
			} catch (err) {
				resultados.push({ ok: false, detalhe: `erro ao verificar: ${err instanceof Error ? err.message : String(err)}` });
			}
		}

		const temManual = resultados.some((r) => r.ok === null);
		const temFalha = resultados.some((r) => r.ok === false);

		let status;
		if (temManual) {
			status = "REVISÃO MANUAL";
			algumaManual = true;
		} else if (temFalha) {
			status = "DIVERGENTE";
			algumaDivergente = true;
		} else {
			status = "PRESENTE";
		}

		console.log(`${migration.id} — ${status}`);
		for (const r of resultados) {
			const marca = r.ok === true ? "  ✓" : r.ok === false ? "  ✗" : "  ?";
			console.log(`${marca} ${r.detalhe}`);
		}
		console.log("");
	}

	console.log("Resumo: nenhuma escrita foi feita — só SELECT/PRAGMA contra o banco consultado.");
	if (algumaDivergente || algumaManual) {
		console.log("Há migrations DIVERGENTE e/ou REVISÃO MANUAL — não prosseguir com bookkeeping até esclarecer cada uma.");
		process.exitCode = 1;
	} else {
		console.log("Todas as migrations 0003–0020 auditadas estão PRESENTES no banco consultado.");
	}
}

main().catch((err) => {
	console.error("Falha ao executar a auditoria:", err instanceof Error ? err.message : err);
	process.exitCode = 1;
});

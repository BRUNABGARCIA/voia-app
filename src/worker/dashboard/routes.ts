import { Hono } from "hono";
import { requireAuth, withSession, type AuthEnv } from "../auth/middleware";
import { sqlEtapaAtrasada, sqlProjetoAtrasado, sqlTarefaAtrasada } from "../projetos/atraso";
import { ehParceiro } from "../projetos/acesso";
import { fraseDoDia } from "./frase-do-dia";

interface Alerta {
	tipo: "tarefa_atrasada" | "tarefa_hoje" | "etapa_atrasada" | "projeto_sem_responsavel" | "projeto_proximo_prazo";
	titulo: string;
	projetoId: number;
	projetoNome: string;
	data: string | null;
}

const dashboard = new Hono<AuthEnv>();

/**
 * Dashboard pessoal do Parceiro — NUNCA reaproveita os KPIs globais da VOIA
 * (clientes ativos, projetos da empresa, etc.). Tudo aqui é escopado aos
 * projetos em que o usuário é membro (projeto_membros) ou às tarefas
 * atribuídas a ele (responsavel_id) — mesma régua de escopo usada em
 * projetos/acesso.ts, nunca um filtro só de frontend.
 */
async function resumoParceiro(db: D1Database, usuarioId: number, nome: string) {
	const [meusProjetos, minhasTarefas, proximasEntregas, pendencias, etapasAtrasadas] = await Promise.all([
		db
			.prepare(
				`SELECT p.id, p.codigo, p.nome, p.status, p.prazo_previsto, c.nome AS cliente_nome,
				        ${sqlProjetoAtrasado("p")} AS atrasado
				 FROM projetos p
				 JOIN clientes c ON c.id = p.cliente_id
				 JOIN projeto_membros pm ON pm.projeto_id = p.id
				 WHERE pm.usuario_id = ?
				 ORDER BY p.criado_em DESC`,
			)
			.bind(usuarioId)
			.all(),
		db
			.prepare(
				`SELECT t.id, t.nome, t.status, t.prioridade, t.prazo, t.projeto_id, p.nome AS projeto_nome,
				        ${sqlTarefaAtrasada("t")} AS atrasada
				 FROM projeto_tarefas t
				 JOIN projetos p ON p.id = t.projeto_id
				 WHERE t.responsavel_id = ? AND t.status NOT IN ('concluida', 'cancelada')
				 ORDER BY (t.prazo IS NULL), t.prazo ASC
				 LIMIT 8`,
			)
			.bind(usuarioId)
			.all(),
		db
			.prepare(
				`SELECT t.id, t.nome, t.prazo, t.projeto_id, p.nome AS projeto_nome
				 FROM projeto_tarefas t
				 JOIN projetos p ON p.id = t.projeto_id
				 WHERE t.responsavel_id = ? AND t.status NOT IN ('concluida', 'cancelada')
				   AND t.prazo IS NOT NULL AND t.prazo BETWEEN date('now') AND date('now', '+7 days')
				 ORDER BY t.prazo ASC
				 LIMIT 8`,
			)
			.bind(usuarioId)
			.all(),
		db
			.prepare("SELECT COUNT(*) AS n FROM projeto_tarefas WHERE responsavel_id = ? AND status NOT IN ('concluida', 'cancelada')")
			.bind(usuarioId)
			.first<{ n: number }>(),
		db
			.prepare(
				`SELECT e.id, e.nome, e.data_fim_prevista, e.projeto_id, p.nome AS projeto_nome
				 FROM projeto_etapas e
				 JOIN projetos p ON p.id = e.projeto_id
				 JOIN projeto_membros pm ON pm.projeto_id = p.id
				 WHERE pm.usuario_id = ? AND ${sqlEtapaAtrasada("e")}
				 ORDER BY e.data_fim_prevista ASC
				 LIMIT 8`,
			)
			.bind(usuarioId)
			.all(),
	]);

	return {
		tipo: "parceiro" as const,
		nome,
		fraseDoDia: fraseDoDia(),
		meusProjetos: meusProjetos.results,
		minhasProximasTarefas: minhasTarefas.results,
		proximasEntregas: proximasEntregas.results,
		minhasPendencias: pendencias?.n ?? 0,
		etapasAtrasadasRelacionadas: etapasAtrasadas.results,
	};
}

// Resumo operacional para a Início. Um único endpoint (em vez de várias
// requisições da página) — todas as consultas rodam em paralelo. Visível a
// qualquer usuário autenticado, mas o CONTEÚDO depende do perfil: Parceiro
// (perfil "colaborador") nunca recebe nenhum indicador global da empresa,
// só o resumo pessoal dele (resumoParceiro, acima) — administrador, gestor
// e visualizador continuam recebendo o resumo operacional completo, já
// existente, sem nenhuma mudança.
// "projetosAtrasados" usa a mesma regra de atraso do restante do sistema
// (worker/projetos/atraso.ts) — nunca diverge do que a Workspace mostra.
dashboard.get("/", withSession, requireAuth, async (c) => {
	const db = c.env.DB;
	const usuario = c.get("user")!;
	const usuarioId = usuario.id;

	if (ehParceiro(usuario.perfil)) {
		return c.json(await resumoParceiro(db, usuarioId, usuario.nome));
	}

	const [
		clientesAtivos,
		projetosEmAndamento,
		projetosAtrasados,
		projetosConcluidos,
		porStatus,
		proximosPrazos,
		recentes,
		tarefasAtrasadas,
		tarefasHoje,
		minhasTarefas,
		etapasAtrasadas,
		projetosSemResponsavel,
		obrasEmExecucao,
		ocorrenciasAbertas,
		alertaTarefasAtrasadas,
		alertaTarefasHoje,
		alertaEtapasAtrasadas,
		alertaProjetosSemResponsavel,
		alertaProjetosProximoPrazo,
	] = await Promise.all([
		db.prepare("SELECT COUNT(*) AS n FROM clientes WHERE status = 'ativo'").first<{ n: number }>(),
		db.prepare("SELECT COUNT(*) AS n FROM projetos WHERE status = 'em_andamento'").first<{ n: number }>(),
		db.prepare(`SELECT COUNT(*) AS n FROM projetos p WHERE ${sqlProjetoAtrasado("p")}`).first<{ n: number }>(),
		db.prepare("SELECT COUNT(*) AS n FROM projetos WHERE status = 'concluido'").first<{ n: number }>(),
		db.prepare("SELECT status, COUNT(*) AS total FROM projetos GROUP BY status").all<{
			status: string;
			total: number;
		}>(),
		db
			.prepare(
				`SELECT p.id, p.codigo, p.nome, p.status, p.prazo_previsto, c.nome AS cliente_nome, u.nome AS gerente_nome
				 FROM projetos p
				 JOIN clientes c ON c.id = p.cliente_id
				 LEFT JOIN usuarios u ON u.id = p.gerente_id
				 WHERE p.prazo_previsto IS NOT NULL AND p.status NOT IN ('concluido', 'cancelado')
				 ORDER BY p.prazo_previsto ASC
				 LIMIT 5`,
			)
			.all(),
		db
			.prepare(
				`SELECT p.id, p.codigo, p.nome, p.status, p.criado_em, c.nome AS cliente_nome, u.nome AS gerente_nome
				 FROM projetos p
				 JOIN clientes c ON c.id = p.cliente_id
				 LEFT JOIN usuarios u ON u.id = p.gerente_id
				 ORDER BY p.criado_em DESC
				 LIMIT 5`,
			)
			.all(),
		db
			.prepare(`SELECT COUNT(*) AS n FROM projeto_tarefas t WHERE ${sqlTarefaAtrasada("t")}`)
			.first<{ n: number }>(),
		db
			.prepare(
				"SELECT COUNT(*) AS n FROM projeto_tarefas WHERE status NOT IN ('concluida', 'cancelada') AND prazo = date('now')",
			)
			.first<{ n: number }>(),
		// Minhas próximas tarefas: sempre pessoais (atribuídas ao usuário
		// autenticado), independente de perfil — administrador/gestor têm os
		// KPIs gerais acima como visão adicional, além desta.
		db
			.prepare(
				`SELECT t.id, t.nome, t.status, t.prioridade, t.prazo, t.projeto_id, p.nome AS projeto_nome,
				        ${sqlTarefaAtrasada("t")} AS atrasada
				 FROM projeto_tarefas t
				 JOIN projetos p ON p.id = t.projeto_id
				 WHERE t.responsavel_id = ? AND t.status NOT IN ('concluida', 'cancelada')
				 ORDER BY (t.prazo IS NULL), t.prazo ASC
				 LIMIT 8`,
			)
			.bind(usuarioId)
			.all(),
		db.prepare(`SELECT COUNT(*) AS n FROM projeto_etapas e WHERE ${sqlEtapaAtrasada("e")}`).first<{ n: number }>(),
		db
			.prepare("SELECT COUNT(*) AS n FROM projetos WHERE gerente_id IS NULL AND status NOT IN ('concluido', 'cancelado')")
			.first<{ n: number }>(),
		// Obras/ocorrências (Rodada 04) — mesma régua: contagem direta,
		// nunca um indicador inventado sem fonte real.
		db.prepare("SELECT COUNT(*) AS n FROM obras WHERE status = 'em_execucao'").first<{ n: number }>(),
		db.prepare("SELECT COUNT(*) AS n FROM obra_ocorrencias WHERE status IN ('aberta', 'em_tratamento')").first<{ n: number }>(),
		// Alertas operacionais — cada consulta já limitada, combinadas abaixo
		// num único feed curto (não é um sistema de notificações, só uma
		// leitura direta dos mesmos dados já existentes).
		db
			.prepare(
				`SELECT t.nome AS titulo, t.projeto_id AS projetoId, p.nome AS projetoNome, t.prazo AS data
				 FROM projeto_tarefas t JOIN projetos p ON p.id = t.projeto_id
				 WHERE ${sqlTarefaAtrasada("t")} ORDER BY t.prazo ASC LIMIT 5`,
			)
			.all<{ titulo: string; projetoId: number; projetoNome: string; data: string }>(),
		db
			.prepare(
				`SELECT t.nome AS titulo, t.projeto_id AS projetoId, p.nome AS projetoNome, t.prazo AS data
				 FROM projeto_tarefas t JOIN projetos p ON p.id = t.projeto_id
				 WHERE t.status NOT IN ('concluida', 'cancelada') AND t.prazo = date('now') LIMIT 5`,
			)
			.all<{ titulo: string; projetoId: number; projetoNome: string; data: string }>(),
		db
			.prepare(
				`SELECT e.nome AS titulo, e.projeto_id AS projetoId, p.nome AS projetoNome, e.data_fim_prevista AS data
				 FROM projeto_etapas e JOIN projetos p ON p.id = e.projeto_id
				 WHERE ${sqlEtapaAtrasada("e")} ORDER BY e.data_fim_prevista ASC LIMIT 5`,
			)
			.all<{ titulo: string; projetoId: number; projetoNome: string; data: string }>(),
		db
			.prepare(
				`SELECT p.nome AS titulo, p.id AS projetoId, p.nome AS projetoNome
				 FROM projetos p
				 WHERE p.gerente_id IS NULL AND p.status NOT IN ('concluido', 'cancelado')
				 ORDER BY p.criado_em DESC LIMIT 5`,
			)
			.all<{ titulo: string; projetoId: number; projetoNome: string }>(),
		db
			.prepare(
				`SELECT p.nome AS titulo, p.id AS projetoId, p.nome AS projetoNome, p.prazo_previsto AS data
				 FROM projetos p
				 WHERE p.prazo_previsto IS NOT NULL
				   AND p.prazo_previsto BETWEEN date('now') AND date('now', '+3 days')
				   AND p.status NOT IN ('concluido', 'cancelado')
				 ORDER BY p.prazo_previsto ASC LIMIT 5`,
			)
			.all<{ titulo: string; projetoId: number; projetoNome: string; data: string }>(),
	]);

	const alertas: Alerta[] = [
		...alertaTarefasAtrasadas.results.map((r) => ({ tipo: "tarefa_atrasada" as const, ...r })),
		...alertaEtapasAtrasadas.results.map((r) => ({ tipo: "etapa_atrasada" as const, ...r })),
		...alertaTarefasHoje.results.map((r) => ({ tipo: "tarefa_hoje" as const, ...r })),
		...alertaProjetosProximoPrazo.results.map((r) => ({ tipo: "projeto_proximo_prazo" as const, ...r })),
		...alertaProjetosSemResponsavel.results.map((r) => ({ tipo: "projeto_sem_responsavel" as const, ...r, data: null })),
	].slice(0, 10);

	return c.json({
		tipo: "admin" as const,
		clientesAtivos: clientesAtivos?.n ?? 0,
		projetosEmAndamento: projetosEmAndamento?.n ?? 0,
		projetosAtrasados: projetosAtrasados?.n ?? 0,
		projetosConcluidos: projetosConcluidos?.n ?? 0,
		projetosPorStatus: porStatus.results,
		proximosPrazos: proximosPrazos.results,
		projetosRecentes: recentes.results,
		tarefasAtrasadas: tarefasAtrasadas?.n ?? 0,
		tarefasHoje: tarefasHoje?.n ?? 0,
		minhasProximasTarefas: minhasTarefas.results,
		etapasAtrasadas: etapasAtrasadas?.n ?? 0,
		projetosSemResponsavel: projetosSemResponsavel?.n ?? 0,
		obrasEmExecucao: obrasEmExecucao?.n ?? 0,
		ocorrenciasAbertas: ocorrenciasAbertas?.n ?? 0,
		alertas,
	});
});

export default dashboard;

import { Hono } from "hono";
import { requireAuth, withSession, type AuthEnv } from "../auth/middleware";
import { sqlEtapaAtrasada, sqlProjetoAtrasado, sqlTarefaAtrasada } from "../projetos/atraso";

interface Alerta {
	tipo: "tarefa_atrasada" | "tarefa_hoje" | "etapa_atrasada" | "projeto_sem_responsavel" | "projeto_proximo_prazo";
	titulo: string;
	projetoId: number;
	projetoNome: string;
	data: string | null;
}

const dashboard = new Hono<AuthEnv>();

// Resumo operacional para a Início. Um único endpoint (em vez de várias
// requisições da página) — todas as consultas rodam em paralelo. Visível a
// qualquer usuário autenticado: é um agregado dos mesmos clientes/projetos
// que a pessoa já pode ver individualmente em /clientes e /projetos.
// "projetosAtrasados" usa a mesma regra de atraso do restante do sistema
// (worker/projetos/atraso.ts) — nunca diverge do que a Workspace mostra.
dashboard.get("/", withSession, requireAuth, async (c) => {
	const db = c.env.DB;
	const usuarioId = c.get("user")!.id;

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
		alertas,
	});
});

export default dashboard;

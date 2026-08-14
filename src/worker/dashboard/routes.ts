import { Hono } from "hono";
import { requireAuth, withSession, type AuthEnv } from "../auth/middleware";
import { sqlProjetoAtrasado, sqlTarefaAtrasada } from "../projetos/atraso";

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
	]);

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
	});
});

export default dashboard;

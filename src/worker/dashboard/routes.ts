import { Hono } from "hono";
import { requireAuth, withSession, type AuthEnv } from "../auth/middleware";

const dashboard = new Hono<AuthEnv>();

// Resumo operacional para a Início. Um único endpoint (em vez de várias
// requisições da página) — todas as consultas rodam em paralelo. Visível a
// qualquer usuário autenticado: é um agregado dos mesmos clientes/projetos
// que a pessoa já pode ver individualmente em /clientes e /projetos.
dashboard.get("/", withSession, requireAuth, async (c) => {
	const db = c.env.DB;

	const [clientesAtivos, projetosEmAndamento, projetosAtrasados, projetosConcluidos, porStatus, proximosPrazos, recentes] =
		await Promise.all([
			db.prepare("SELECT COUNT(*) AS n FROM clientes WHERE status = 'ativo'").first<{ n: number }>(),
			db.prepare("SELECT COUNT(*) AS n FROM projetos WHERE status = 'em_andamento'").first<{ n: number }>(),
			db
				.prepare(
					"SELECT COUNT(*) AS n FROM projetos WHERE prazo_previsto IS NOT NULL AND prazo_previsto < date('now') AND status NOT IN ('concluido', 'cancelado')",
				)
				.first<{ n: number }>(),
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
		]);

	return c.json({
		clientesAtivos: clientesAtivos?.n ?? 0,
		projetosEmAndamento: projetosEmAndamento?.n ?? 0,
		projetosAtrasados: projetosAtrasados?.n ?? 0,
		projetosConcluidos: projetosConcluidos?.n ?? 0,
		projetosPorStatus: porStatus.results,
		proximosPrazos: proximosPrazos.results,
		projetosRecentes: recentes.results,
	});
});

export default dashboard;

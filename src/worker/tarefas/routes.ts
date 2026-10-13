import { Hono } from "hono";
import { requireAuth, withSession, type AuthEnv } from "../auth/middleware";
import { ehParceiro, sqlProjetosDoParceiro } from "../projetos/acesso";
import { sqlTarefaAtrasada } from "../projetos/atraso";

// Central de Tarefas — "Meu Dia" e Kanban (Rodada 04). Módulo cross-projeto
// de LEITURA apenas: toda mutação (criar/editar/excluir tarefa) continua
// nas rotas aninhadas em /api/projetos/:id/tarefas* (já auditadas,
// escopadas por requireProjectAccess) — este módulo nunca escreve, só
// agrega. Isso evita duplicar a superfície de autorização: o frontend
// chama esta rota para listar e a rota aninhada do projeto (que já conhece
// o projeto de cada tarefa) para mutar.
const tarefas = new Hono<AuthEnv>();

const SELECT_TAREFA_AGREGADA = `
	SELECT t.id, t.projeto_id, p.nome AS projeto_nome, t.etapa_id, e.nome AS etapa_nome,
	       t.nome, t.descricao, t.status, t.prioridade, t.responsavel_id, u.nome AS responsavel_nome,
	       t.prazo, t.data_conclusao, t.criado_em,
	       ${sqlTarefaAtrasada("t")} AS atrasada
	FROM projeto_tarefas t
	JOIN projetos p ON p.id = t.projeto_id
	LEFT JOIN projeto_etapas e ON e.id = t.etapa_id
	LEFT JOIN usuarios u ON u.id = t.responsavel_id
`;

/**
 * "Meu Dia": tarefas atribuídas ao usuário autenticado, categorizadas.
 * Sempre pessoal (responsavel_id = eu) — não depende de perfil para a
 * régua de escopo, porque uma tarefa só pode estar atribuída a alguém que
 * already tem acesso ao projeto dela (checado na criação/edição). Também
 * devolve as próximas entregas (etapas) do universo do usuário: para
 * Parceiro, só dos projetos em que é membro; para os demais, sem filtro
 * extra (visão administrativa já existente no dashboard).
 */
tarefas.get("/meu-dia", withSession, requireAuth, async (c) => {
	const usuario = c.get("user")!;
	const db = c.env.DB;

	const [atrasadas, hoje, proximas, entregas] = await Promise.all([
		db
			.prepare(
				`${SELECT_TAREFA_AGREGADA} WHERE t.responsavel_id = ? AND ${sqlTarefaAtrasada("t")} ORDER BY t.prazo ASC`,
			)
			.bind(usuario.id)
			.all(),
		db
			.prepare(
				`${SELECT_TAREFA_AGREGADA} WHERE t.responsavel_id = ? AND t.status NOT IN ('concluida', 'cancelada')
				 AND t.prazo = date('now') ORDER BY t.prioridade DESC`,
			)
			.bind(usuario.id)
			.all(),
		db
			.prepare(
				`${SELECT_TAREFA_AGREGADA} WHERE t.responsavel_id = ? AND t.status NOT IN ('concluida', 'cancelada')
				 AND (t.prazo IS NULL OR t.prazo > date('now')) ORDER BY (t.prazo IS NULL), t.prazo ASC LIMIT 15`,
			)
			.bind(usuario.id)
			.all(),
		ehParceiro(usuario.perfil)
			? db
					.prepare(
						`SELECT e.id, e.nome, e.data_fim_prevista, e.projeto_id, p.nome AS projeto_nome
						 FROM projeto_etapas e
						 JOIN projetos p ON p.id = e.projeto_id
						 WHERE ${sqlProjetosDoParceiro("p", usuario.id)} AND e.status <> 'concluida'
						   AND e.data_fim_prevista IS NOT NULL
						   AND e.data_fim_prevista BETWEEN date('now') AND date('now', '+7 days')
						 ORDER BY e.data_fim_prevista ASC LIMIT 10`,
					)
					.all()
			: db
					.prepare(
						`SELECT e.id, e.nome, e.data_fim_prevista, e.projeto_id, p.nome AS projeto_nome
						 FROM projeto_etapas e
						 JOIN projetos p ON p.id = e.projeto_id
						 WHERE e.status <> 'concluida' AND e.data_fim_prevista IS NOT NULL
						   AND e.data_fim_prevista BETWEEN date('now') AND date('now', '+7 days')
						 ORDER BY e.data_fim_prevista ASC LIMIT 10`,
					)
					.all(),
	]);

	return c.json({
		atrasadas: atrasadas.results,
		hoje: hoje.results,
		proximas: proximas.results,
		proximasEntregas: entregas.results,
	});
});

/**
 * Kanban: tarefas filtráveis por projeto/responsável/prioridade/status.
 * Parceiro só vê tarefas dos projetos em que é membro (mesma régua de
 * projetos/acesso.ts) — nunca confia em "projeto_id" vindo da query sem
 * reconferir o vínculo; os demais perfis mantêm a visão administrativa.
 */
tarefas.get("/", withSession, requireAuth, async (c) => {
	const usuario = c.get("user")!;
	const db = c.env.DB;

	const condicoes: string[] = [];
	const binds: unknown[] = [];

	if (ehParceiro(usuario.perfil)) {
		condicoes.push(sqlProjetosDoParceiro("p", usuario.id));
	}

	const projetoId = Number(c.req.query("projeto_id"));
	if (Number.isInteger(projetoId) && projetoId > 0) {
		condicoes.push("t.projeto_id = ?");
		binds.push(projetoId);
	}

	const responsavelId = Number(c.req.query("responsavel_id"));
	if (Number.isInteger(responsavelId) && responsavelId > 0) {
		condicoes.push("t.responsavel_id = ?");
		binds.push(responsavelId);
	}

	const prioridade = c.req.query("prioridade");
	if (prioridade && ["baixa", "normal", "alta", "urgente"].includes(prioridade)) {
		condicoes.push("t.prioridade = ?");
		binds.push(prioridade);
	}

	const status = c.req.query("status");
	if (status && ["pendente", "em_andamento", "aguardando", "concluida", "cancelada"].includes(status)) {
		condicoes.push("t.status = ?");
		binds.push(status);
	} else {
		// Default do Kanban: não mostra canceladas nas colunas principais
		// (ficam disponíveis via filtro explícito status=cancelada, pedido
		// desta rodada — "canceladas podem ficar em filtro/histórico").
		condicoes.push("t.status <> 'cancelada'");
	}

	const prazoAte = c.req.query("prazo_ate");
	if (prazoAte && /^\d{4}-\d{2}-\d{2}$/.test(prazoAte)) {
		condicoes.push("t.prazo IS NOT NULL AND t.prazo <= ?");
		binds.push(prazoAte);
	}

	const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
	const { results } = await db
		.prepare(`${SELECT_TAREFA_AGREGADA} ${where} ORDER BY (t.prazo IS NULL), t.prazo ASC, t.id DESC`)
		.bind(...binds)
		.all();

	return c.json({ tarefas: results });
});

export default tarefas;

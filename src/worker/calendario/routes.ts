import { Hono } from "hono";
import { requireAuth, withSession, type AuthEnv } from "../auth/middleware";
import { ehParceiro, sqlProjetosDoParceiro } from "../projetos/acesso";

// Calendário Operacional (Rodada 04) — composição de datas que já existem
// em outras tabelas (tarefas, etapas, pagamentos do parceiro, obras), NUNCA
// uma tabela própria de eventos (exigência explícita: "não duplicar os
// dados em outra tabela só para calendário"). Só LEITURA.
//
// Escopo: Parceiro nunca vê pagamento de outro parceiro (a query de
// pagamentos é sempre parceiro_id = sessão) nem etapa/obra fora dos
// projetos em que é membro. Administrador/gestor/visualizador mantêm a
// visão operacional já existente no resto do sistema (dashboard/projetos).
const calendario = new Hono<AuthEnv>();

interface EventoCalendario {
	data: string;
	tipo: "tarefa" | "etapa" | "pagamento" | "obra";
	titulo: string;
	projetoId: number | null;
	projetoNome: string | null;
}

calendario.get("/", withSession, requireAuth, async (c) => {
	const usuario = c.get("user")!;
	const db = c.env.DB;
	const parceiro = ehParceiro(usuario.perfil);

	const [tarefas, etapas, obras, pagamentos] = await Promise.all([
		db
			.prepare(
				`SELECT t.prazo AS data, t.nome AS titulo, t.projeto_id AS projetoId, p.nome AS projetoNome
				 FROM projeto_tarefas t
				 JOIN projetos p ON p.id = t.projeto_id
				 WHERE t.responsavel_id = ? AND t.status NOT IN ('concluida', 'cancelada')
				   AND t.prazo IS NOT NULL AND t.prazo BETWEEN date('now', '-14 days') AND date('now', '+60 days')`,
			)
			.bind(usuario.id)
			.all<{ data: string; titulo: string; projetoId: number; projetoNome: string }>(),
		db
			.prepare(
				`SELECT e.data_fim_prevista AS data, e.nome AS titulo, e.projeto_id AS projetoId, p.nome AS projetoNome
				 FROM projeto_etapas e
				 JOIN projetos p ON p.id = e.projeto_id
				 WHERE e.status <> 'concluida' AND e.data_fim_prevista IS NOT NULL
				   AND e.data_fim_prevista BETWEEN date('now', '-14 days') AND date('now', '+60 days')
				   ${parceiro ? `AND ${sqlProjetosDoParceiro("p", usuario.id)}` : ""}`,
			)
			.all<{ data: string; titulo: string; projetoId: number; projetoNome: string }>(),
		db
			.prepare(
				`SELECT COALESCE(o.data_inicio_prevista, o.data_fim_prevista) AS data, o.nome AS titulo,
				        o.projeto_id AS projetoId, p.nome AS projetoNome
				 FROM obras o
				 JOIN projetos p ON p.id = o.projeto_id
				 WHERE o.status NOT IN ('concluida', 'cancelada')
				   AND (o.data_inicio_prevista IS NOT NULL OR o.data_fim_prevista IS NOT NULL)
				   AND COALESCE(o.data_inicio_prevista, o.data_fim_prevista) BETWEEN date('now', '-14 days') AND date('now', '+60 days')
				   ${parceiro ? `AND ${sqlProjetosDoParceiro("p", usuario.id)}` : ""}`,
			)
			.all<{ data: string; titulo: string; projetoId: number; projetoNome: string }>(),
		// Pagamentos: só quando o usuário é Parceiro, e sempre filtrados pela
		// própria remuneração — nunca de outro parceiro (mesma régua do
		// módulo financeiro).
		parceiro
			? db
					.prepare(
						`SELECT COALESCE(pg.data_programada, pg.data_pagamento) AS data,
						        ('Pagamento — ' || p.nome) AS titulo, r.projeto_id AS projetoId, p.nome AS projetoNome
						 FROM projeto_parceiro_pagamentos pg
						 JOIN projeto_parceiro_remuneracoes r ON r.id = pg.remuneracao_id
						 JOIN projetos p ON p.id = r.projeto_id
						 WHERE r.parceiro_id = ? AND pg.status IN ('programado', 'pago')
						   AND COALESCE(pg.data_programada, pg.data_pagamento) IS NOT NULL
						   AND COALESCE(pg.data_programada, pg.data_pagamento) BETWEEN date('now', '-14 days') AND date('now', '+60 days')`,
					)
					.bind(usuario.id)
					.all<{ data: string; titulo: string; projetoId: number; projetoNome: string }>()
			: Promise.resolve({ results: [] as { data: string; titulo: string; projetoId: number; projetoNome: string }[] }),
	]);

	const eventos: EventoCalendario[] = [
		...tarefas.results.map((r) => ({ ...r, tipo: "tarefa" as const })),
		...etapas.results.map((r) => ({ ...r, tipo: "etapa" as const })),
		...obras.results.map((r) => ({ ...r, tipo: "obra" as const })),
		...pagamentos.results.map((r) => ({ ...r, tipo: "pagamento" as const })),
	]
		.map((e) => ({ data: e.data, tipo: e.tipo, titulo: e.titulo, projetoId: e.projetoId, projetoNome: e.projetoNome }))
		.sort((a, b) => a.data.localeCompare(b.data));

	return c.json({ eventos });
});

export default calendario;

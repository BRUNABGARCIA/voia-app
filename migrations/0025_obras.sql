-- Migration: 0025_obras
-- Rodada 04 - Gestão de Obras, fundação real
--
-- Uma obra está SEMPRE ligada a um projeto já existente (nunca um cadastro
-- paralelo de cliente/projeto, exigência explícita desta rodada) — 1:N
-- (um projeto pode ter mais de uma obra: fases, frentes de execução
-- diferentes), nunca o contrário. ON DELETE CASCADE segue o mesmo padrão
-- já usado em projeto_etapas/projeto_tarefas/projeto_documentos (obra é um
-- sub-recurso operacional do projeto, não um registro financeiro
-- independente como projeto_parceiro_remuneracoes, que usa RESTRICT).
--
-- Equipe: REUTILIZA projeto_membros (já modela "usuário + função neste
-- projeto") — não há tabela de equipe própria da obra. responsavel_tecnico
-- e responsavel_operacional são campos informativos da obra em si (quem
-- assina tecnicamente / quem acompanha no campo), não um novo mecanismo de
-- permissão: acesso continua decidido por projeto_membros via o projeto
-- da obra (worker/obras/acesso.ts reaproveita worker/projetos/acesso.ts).
--
-- progresso é SEMPRE manual nesta rodada (INTEGER 0-100, documentado em
-- código) — não é derivado de etapas/tarefas/cronograma porque uma obra
-- pode ter um ritmo físico diferente do progresso administrativo do
-- projeto (ex.: etapas de projeto incluem fases de aprovação/documentação
-- que não refletem execução física). Nunca inventado: nasce 0.
--
-- Não altera 0001-0024, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS obras (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	projeto_id INTEGER NOT NULL REFERENCES projetos (id) ON DELETE CASCADE,
	nome TEXT NOT NULL,
	endereco TEXT,
	responsavel_tecnico_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	responsavel_operacional_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	data_inicio_prevista TEXT,
	data_fim_prevista TEXT,
	data_inicio_real TEXT,
	data_fim_real TEXT,
	status TEXT NOT NULL DEFAULT 'planejamento' CHECK (
		status IN ('planejamento', 'aguardando_inicio', 'em_execucao', 'pausada', 'concluida', 'cancelada')
	),
	-- Percentual manual administrativo — ver comentário acima. 0-100.
	progresso INTEGER NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
	observacoes TEXT,
	criado_por_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_obras_projeto_id ON obras (projeto_id);
CREATE INDEX IF NOT EXISTS idx_obras_status ON obras (status);

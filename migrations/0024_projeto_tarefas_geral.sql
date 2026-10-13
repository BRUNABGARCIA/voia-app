-- Migration: 0024_projeto_tarefas_geral
-- Rodada 04 - Central Operacional VOIA + "Meu Dia"
--
-- Auditoria prévia (obrigatória por instrução desta rodada): projeto_tarefas
-- (0017) já tem nome, descricao, status, prioridade, responsavel_id, prazo,
-- data_conclusao, criado_em/atualizado_em — tudo que "Meu Dia"/Kanban
-- precisa, EXCETO duas coisas:
--
--   1. etapa_id é NOT NULL hoje, mas "Meu Dia" precisa permitir criar uma
--      tarefa de projeto sem amarrar a uma etapa específica (etapa
--      opcional, pedido explícito desta rodada). SQLite não altera um NOT
--      NULL in-place, então o ajuste é feito pelo mesmo rebuild de tabela
--      já usado em 0003_equipe_permissoes.sql (recriar, copiar dados pelos
--      mesmos IDs, descartar a antiga, renomear) — os IDs são preservados,
--      então nenhuma FK em outra tabela (nenhuma referencia
--      projeto_tarefas.id hoje) precisa ser tocada. Linhas existentes
--      mantêm o etapa_id que já tinham.
--   2. Não existe "criado por" — adicionado como coluna nova (ADD COLUMN,
--      sem rebuild), nullable: tarefas já existentes não têm essa
--      informação e ficam com NULL (nunca inventado retroativamente).
--
-- Esta migration NÃO altera o arquivo 0017_projeto_tarefas.sql (que
-- permanece imutável) — é um ajuste aditivo igual ao já feito em
-- 0012 sobre 0009.
--
-- Não altera 0001-0023, que permanecem imutáveis.

PRAGMA foreign_keys = OFF;

CREATE TABLE projeto_tarefas_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	projeto_id INTEGER NOT NULL REFERENCES projetos (id) ON DELETE CASCADE,
	etapa_id INTEGER REFERENCES projeto_etapas (id) ON DELETE CASCADE,
	nome TEXT NOT NULL,
	descricao TEXT,
	ordem INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'pendente' CHECK (
		status IN ('pendente', 'em_andamento', 'aguardando', 'concluida', 'cancelada')
	),
	prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
	responsavel_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	data_inicio TEXT,
	prazo TEXT,
	data_conclusao TEXT,
	visivel_cliente INTEGER NOT NULL DEFAULT 1 CHECK (visivel_cliente IN (0, 1)),
	origem_modelo_id INTEGER REFERENCES tipo_servico_modelo_tarefa (id) ON DELETE SET NULL,
	criado_por_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

INSERT INTO projeto_tarefas_new (
	id, projeto_id, etapa_id, nome, descricao, ordem, status, prioridade,
	responsavel_id, data_inicio, prazo, data_conclusao, visivel_cliente,
	origem_modelo_id, criado_em, atualizado_em
)
SELECT
	id, projeto_id, etapa_id, nome, descricao, ordem, status, prioridade,
	responsavel_id, data_inicio, prazo, data_conclusao, visivel_cliente,
	origem_modelo_id, criado_em, atualizado_em
FROM projeto_tarefas;

DROP TABLE projeto_tarefas;
ALTER TABLE projeto_tarefas_new RENAME TO projeto_tarefas;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_projeto_id ON projeto_tarefas (projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_etapa_id ON projeto_tarefas (etapa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_responsavel_id ON projeto_tarefas (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_status ON projeto_tarefas (status);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_prazo ON projeto_tarefas (prazo);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_criado_por_id ON projeto_tarefas (criado_por_id);

PRAGMA foreign_keys = ON;

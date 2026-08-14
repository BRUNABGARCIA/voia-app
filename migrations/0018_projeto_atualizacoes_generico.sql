-- Migration: 0018_projeto_atualizacoes_generico
-- Etapa E - Tarefas, cronograma e automação por tipo de serviço
--
-- Reaproveita projeto_atualizacoes (0013) como o histórico de eventos
-- automáticos pedido nesta etapa, em vez de criar uma segunda tabela quase
-- idêntica: já tem projeto_id, titulo, descricao, visivel_cliente,
-- criado_por_id/criado_em, e já alimenta a timeline "Andamento" (interna) e
-- o Portal do Cliente (visivel_cliente = 1).
--
-- Três colunas novas, nullable, sem CHECK (formato livre — só descritivas,
-- não usadas em filtro de segurança nem exibidas como badge principal):
--   entidade_tipo: 'etapa' | 'tarefa' | 'projeto' (o que o evento descreve).
--   entidade_id: id da etapa/tarefa/projeto relacionada.
--   tipo_evento: chave específica do evento (ex.: "etapa_concluida",
--     "tarefa_concluida", "prazo_alterado", "responsavel_alterado",
--     "status_projeto_alterado") — mais granular que a coluna "tipo"
--     existente (que continua com seu CHECK de 0013, reaproveitada como
--     categoria ampla: eventos automáticos usam 'etapa'/'sistema').
--
-- Eventos manuais (já existentes, via POST /api/projetos/:id/atualizacoes)
-- continuam funcionando sem preencher estas colunas.
--
-- Não altera 0001-0017, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

ALTER TABLE projeto_atualizacoes ADD COLUMN entidade_tipo TEXT;
ALTER TABLE projeto_atualizacoes ADD COLUMN entidade_id INTEGER;
ALTER TABLE projeto_atualizacoes ADD COLUMN tipo_evento TEXT;

CREATE INDEX IF NOT EXISTS idx_projeto_atualizacoes_entidade ON projeto_atualizacoes (entidade_tipo, entidade_id);

-- Migration: 0015_tipo_servico_modelo_ativa
-- Etapa E - Tarefas, cronograma e automação por tipo de serviço
--
-- Adiciona "ativa" à etapa padrão do modelo (tipo_servico_etapas_modelo,
-- criada em 0011). Uma etapa padrão inativa continua no cadastro (histórico
-- de configuração, não perde nada), mas a geração automática de estrutura
-- (worker/projetos/geracao-etapas.ts) passa a considerar só modelos com
-- ativa = 1 — "carregar os modelos ativos", conforme pedido nesta etapa.
--
-- Não altera 0001-0014, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

ALTER TABLE tipo_servico_etapas_modelo ADD COLUMN ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1));

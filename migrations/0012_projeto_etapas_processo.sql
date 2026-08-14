-- Migration: 0012_projeto_etapas_processo
-- Evolução VOIA - Geração automática de etapas + prazos previstos
--
-- Estende projeto_etapas (criada em 0009) de forma aditiva, via ALTER TABLE
-- ADD COLUMN — não recria a tabela, então os dados existentes (e a coluna
-- id/ordem/status já usadas pela API/telas atuais) permanecem intactos.
--
-- Novas colunas:
--   tipo_servico_id / modelo_etapa_id: origem da etapa quando ela foi
--     gerada automaticamente a partir de um modelo (0011). Preservados
--     para indicadores futuros ("quantas etapas de Aprovação atrasam em
--     média?"), mas NUNCA usados para deduplicar etapas com nomes iguais —
--     etapas de processos diferentes podem ter nomes coincidentes de
--     propósito (ex.: "Protocolo" em Aprovação e em Regularização).
--     ON DELETE SET NULL: excluir o tipo de serviço ou a etapa-modelo não
--     pode apagar/quebrar uma etapa de projeto já gerada.
--   peso: preparado para cálculo de progresso ponderado (não usado ainda,
--     mesma decisão de 0011).
--   data_inicio_prevista / data_fim_prevista: cronograma calculado na
--     geração automática (prazo_dias do modelo, em dias corridos — ver
--     src/worker/projetos/prazos.ts) e editável manualmente depois.
--   data_inicio_real: quando a etapa de fato começou (distinto de
--     data_conclusao, que já existia e marca o fim real).
--   observacao_interna: nota visível somente à equipe, nunca ao cliente.
--   visivel_cliente: controla o Portal do Cliente (0014) — etapa só
--     aparece lá quando 1. Herdado do modelo na geração automática;
--     etapas criadas manualmente nascem visíveis (default 1), ajustável
--     depois.
--
-- As colunas antigas data_inicio/prazo (de 0009) NÃO são removidas nem
-- reaproveitadas — ficam paradas, mesmo precedente de projetos.progresso
-- em 0009 (nunca descartar uma coluna existente). A aba Etapas passa a
-- usar exclusivamente as colunas novas (mais expressivas: previsto vs.
-- real) a partir desta migration.
--
-- Não altera 0001-0011, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

ALTER TABLE projeto_etapas ADD COLUMN tipo_servico_id INTEGER REFERENCES tipos_servico (id) ON DELETE SET NULL;
ALTER TABLE projeto_etapas ADD COLUMN modelo_etapa_id INTEGER REFERENCES tipo_servico_etapas_modelo (id) ON DELETE SET NULL;
ALTER TABLE projeto_etapas ADD COLUMN peso INTEGER NOT NULL DEFAULT 1;
ALTER TABLE projeto_etapas ADD COLUMN data_inicio_prevista TEXT;
ALTER TABLE projeto_etapas ADD COLUMN data_fim_prevista TEXT;
ALTER TABLE projeto_etapas ADD COLUMN data_inicio_real TEXT;
ALTER TABLE projeto_etapas ADD COLUMN observacao_interna TEXT;
ALTER TABLE projeto_etapas ADD COLUMN visivel_cliente INTEGER NOT NULL DEFAULT 1 CHECK (visivel_cliente IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_projeto_etapas_tipo_servico_id ON projeto_etapas (tipo_servico_id);
CREATE INDEX IF NOT EXISTS idx_projeto_etapas_modelo_etapa_id ON projeto_etapas (modelo_etapa_id);

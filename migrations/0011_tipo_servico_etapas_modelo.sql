-- Migration: 0011_tipo_servico_etapas_modelo
-- Evolução VOIA - Modelos de processo por Tipo de Serviço
--
-- Cada Tipo de Serviço pode ter um MODELO PADRÃO de processo, composto por
-- etapas padrão configuráveis pelo painel administrativo (Configurações >
-- Tipos de Serviço). Nenhum modelo é semeado automaticamente aqui — de
-- propósito, conforme pedido: os modelos reais (Regularização, Aprovação
-- etc.) são cadastrados pelo administrador, não fabricados como dado fixo
-- de exemplo.
--
-- "peso" já nasce presente no schema (default 1, aplicado uniformemente)
-- para permitir que o cálculo de progresso passe a ser ponderado no
-- futuro sem exigir uma nova migration — mas o cálculo de progresso
-- (src/worker/projetos/progresso.ts) continua ignorando esta coluna nesta
-- rodada, somando etapas concluídas / total, como já era.
--
-- Alterações no modelo NÃO afetam projetos já criados: a geração
-- automática (projetos.post "/") apenas COPIA os dados do modelo para
-- projeto_etapas no momento da criação — depois disso as duas estruturas
-- são independentes.
--
-- Não altera 0001-0010, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tipo_servico_etapas_modelo (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tipo_servico_id INTEGER NOT NULL REFERENCES tipos_servico (id) ON DELETE CASCADE,
	nome TEXT NOT NULL,
	descricao TEXT,
	ordem INTEGER NOT NULL DEFAULT 0,
	prazo_dias INTEGER,
	peso INTEGER NOT NULL DEFAULT 1,
	visivel_cliente INTEGER NOT NULL DEFAULT 1 CHECK (visivel_cliente IN (0, 1)),
	notificar_cliente INTEGER NOT NULL DEFAULT 0 CHECK (notificar_cliente IN (0, 1)),
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_tipo_servico_etapas_modelo_tipo_servico_id ON tipo_servico_etapas_modelo (tipo_servico_id);
CREATE INDEX IF NOT EXISTS idx_tipo_servico_etapas_modelo_tipo_ordem ON tipo_servico_etapas_modelo (tipo_servico_id, ordem);

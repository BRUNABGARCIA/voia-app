-- Migration: 0028_obra_ocorrencias
-- Rodada 04 - Ocorrências/Pendências da Obra
--
-- Workflow próprio (status de resolução, responsável, prazo) — por isso
-- CRIAR NOVO em vez de só estender projeto_atualizacoes (que é histórico
-- de eventos, sem conceito de "aberta/em_tratamento/resolvida" nem
-- responsável/prazo). Quando uma ocorrência é aberta/resolvida, um evento
-- é registrado em projeto_atualizacoes (histórico unificado do projeto),
-- mas a ocorrência em si — com seu estado — vive aqui.
--
-- categoria é uma lista fechada (CHECK) com as categorias já sugeridas
-- nesta rodada; "execucao" é o default genérico.
--
-- criado_por_id é NOT NULL/RESTRICT (mesma régua de obra_rdo.criado_por_id
-- — toda ocorrência tem autoria obrigatória). responsavel_id é opcional
-- (pode nascer sem atribuição e ser atribuída depois).
--
-- Não altera 0001-0027, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS obra_ocorrencias (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	obra_id INTEGER NOT NULL REFERENCES obras (id) ON DELETE CASCADE,
	titulo TEXT NOT NULL,
	descricao TEXT,
	categoria TEXT NOT NULL DEFAULT 'execucao' CHECK (
		categoria IN (
			'incompatibilidade', 'atraso', 'material', 'qualidade',
			'seguranca', 'cliente', 'projeto', 'execucao'
		)
	),
	prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
	status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_tratamento', 'resolvida', 'cancelada')),
	responsavel_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	prazo TEXT,
	criado_por_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
	resolvido_em TEXT,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_obra_ocorrencias_obra_id ON obra_ocorrencias (obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_ocorrencias_status ON obra_ocorrencias (status);
CREATE INDEX IF NOT EXISTS idx_obra_ocorrencias_responsavel_id ON obra_ocorrencias (responsavel_id);

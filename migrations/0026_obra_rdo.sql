-- Migration: 0026_obra_rdo
-- Rodada 04 - Diário de Obra / RDO
--
-- Estrutura própria (clima, mão de obra do dia, serviços executados,
-- ocorrências do dia) sem equivalente em nenhuma tabela existente — por
-- isso CRIAR NOVO, 1:N com obras. Campos de texto livre nesta rodada
-- (equipe/equipamentos/materiais como string) — nunca um ERP de estoque,
-- exigência explícita. criado_por_id é NOT NULL/RESTRICT: todo RDO tem
-- autoria obrigatória (é um registro formal de diário de obra), diferente
-- de responsavel_tecnico em "obras", que é só informativo e pode faltar.
--
-- Não altera 0001-0025, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS obra_rdo (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	obra_id INTEGER NOT NULL REFERENCES obras (id) ON DELETE CASCADE,
	data TEXT NOT NULL,
	criado_por_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
	condicoes_climaticas TEXT,
	mao_de_obra TEXT,
	servicos_executados TEXT,
	equipamentos TEXT,
	materiais TEXT,
	ocorrencias TEXT,
	observacoes TEXT,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_obra_rdo_obra_id ON obra_rdo (obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_obra_data ON obra_rdo (obra_id, data);

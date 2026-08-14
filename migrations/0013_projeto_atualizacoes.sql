-- Migration: 0013_projeto_atualizacoes
-- Evolução VOIA - Histórico de andamento do processo
--
-- Timeline de atualizações do projeto ("Projeto protocolado.", "Documentação
-- complementar solicitada." etc.), exibida na Workspace do Projeto (aba
-- Andamento) e, quando visivel_cliente = 1, também no Portal do Cliente.
--
-- etapa_id é opcional: uma atualização pode estar amarrada a uma etapa
-- específica (ex.: publicar o andamento junto de uma mudança de status) ou
-- ser um evento solto do projeto como um todo. ON DELETE SET NULL: excluir
-- a etapa não apaga o histórico, só desvincula.
--
-- "tipo" é um rótulo simples para a UI (ícone/cor), não um mecanismo de
-- automação nesta rodada.
--
-- Não altera 0001-0012, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projeto_atualizacoes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	projeto_id INTEGER NOT NULL REFERENCES projetos (id) ON DELETE CASCADE,
	etapa_id INTEGER REFERENCES projeto_etapas (id) ON DELETE SET NULL,
	titulo TEXT NOT NULL,
	descricao TEXT,
	tipo TEXT NOT NULL DEFAULT 'geral' CHECK (
		tipo IN ('geral', 'protocolo', 'pendencia', 'aprovacao', 'etapa', 'sistema')
	),
	visivel_cliente INTEGER NOT NULL DEFAULT 0 CHECK (visivel_cliente IN (0, 1)),
	criado_por_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_projeto_atualizacoes_projeto_id ON projeto_atualizacoes (projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_atualizacoes_projeto_criado ON projeto_atualizacoes (projeto_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_projeto_atualizacoes_etapa_id ON projeto_atualizacoes (etapa_id);

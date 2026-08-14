-- Migration: 0009_projeto_etapas
-- Evolução VOIA - Modais responsivos, progresso derivado de etapas
--
-- Etapas do projeto (Projeto 1:N Etapas). O progresso do projeto deixa de
-- ser um valor manual (projetos.progresso, criada em 0007) e passa a ser
-- calculado a partir da proporção de etapas com status "concluida" — ver
-- src/worker/projetos/progresso.ts. A coluna projetos.progresso NÃO é
-- removida (evolução aditiva seguindo o padrão já usado no projeto: nunca
-- descartar uma coluna existente só porque ela deixou de ser a fonte de
-- verdade) — ela simplesmente para de ser escrita pela aplicação.
--
-- Nomes de coluna (criado_em/atualizado_em) seguem a convenção já usada em
-- toda tabela existente (usuarios, clientes, projetos, projeto_membros...),
-- em vez de created_at/updated_at, para manter o schema consistente.
--
-- Não altera 0001-0008, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projeto_etapas (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	projeto_id INTEGER NOT NULL REFERENCES projetos (id) ON DELETE CASCADE,
	nome TEXT NOT NULL,
	descricao TEXT,
	ordem INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
	data_inicio TEXT,
	prazo TEXT,
	data_conclusao TEXT,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_projeto_etapas_projeto_id ON projeto_etapas (projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_etapas_projeto_ordem ON projeto_etapas (projeto_id, ordem);
CREATE INDEX IF NOT EXISTS idx_projeto_etapas_status ON projeto_etapas (status);

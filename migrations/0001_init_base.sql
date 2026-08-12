-- Migration: 0001_init_base
-- Etapa A - Fundação do VOIA APP
--
-- Cria a base mínima de dados para suportar o restante do produto sem
-- exigir reconstrução futura das foreign keys:
--   usuarios      -> pessoas que acessam o sistema (sem autenticação ainda)
--   organizacoes  -> clientes/empresas (PF ou PJ)
--   projetos      -> projetos de engenharia vinculados a uma organização
--
-- Escopo desta etapa: NÃO inclui autenticação, senha, CRM completo,
-- financeiro, documentos, tarefas, etapas ou IA. Apenas a fundação.

PRAGMA foreign_keys = ON;

-- =============================================================
-- usuarios
-- =============================================================
CREATE TABLE IF NOT EXISTS usuarios (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	nome TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE,
	perfil TEXT NOT NULL CHECK (
		perfil IN ('administrador', 'gestor', 'engenheiro', 'colaborador', 'financeiro')
	),
	ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios (perfil);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios (ativo);

-- =============================================================
-- organizacoes (clientes/empresas, PF ou PJ)
-- =============================================================
CREATE TABLE IF NOT EXISTS organizacoes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tipo TEXT NOT NULL CHECK (tipo IN ('PF', 'PJ')),
	nome TEXT NOT NULL,
	nome_fantasia TEXT,
	documento TEXT NOT NULL UNIQUE, -- CPF (PF) ou CNPJ (PJ), apenas dígitos
	email TEXT,
	telefone TEXT,
	ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_organizacoes_tipo ON organizacoes (tipo);

-- =============================================================
-- projetos
-- =============================================================
CREATE TABLE IF NOT EXISTS projetos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	organizacao_id INTEGER NOT NULL REFERENCES organizacoes (id) ON DELETE RESTRICT,
	nome TEXT NOT NULL,
	descricao TEXT,
	status TEXT NOT NULL DEFAULT 'planejamento' CHECK (
		status IN ('planejamento', 'em_andamento', 'pausado', 'concluido', 'cancelado')
	),
	gerente_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	criado_por_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_projetos_organizacao_id ON projetos (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos (status);
CREATE INDEX IF NOT EXISTS idx_projetos_gerente_id ON projetos (gerente_id);

-- =============================================================
-- Usuário administrativo de desenvolvimento
-- Sem senha/autenticação nesta etapa. Dado fictício, sem PII real.
-- Necessário como referência mínima para FKs (criado_por_id) desde já.
-- =============================================================
INSERT INTO usuarios (nome, email, perfil, ativo)
VALUES ('Administrador VOIA (dev)', 'admin@voia.local', 'administrador', 1);

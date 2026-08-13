-- Migration: 0003_equipe_permissoes
-- Etapa C - Usuários, equipe e permissões
--
-- Não altera 0001_init_base.sql nem 0002_auth.sql, que permanecem
-- imutáveis. Amplia (não substitui) o CHECK de usuarios.perfil para
-- incluir 'visualizador', mantendo os valores já existentes
-- ('engenheiro'/'financeiro'), e adiciona usuarios.ultimo_login_em.
--
-- SQLite não permite alterar um CHECK constraint in-place, então é feito
-- via rebuild da tabela (recriar, copiar dados pelos mesmos IDs,
-- descartar a antiga, renomear). Como os IDs são preservados, as foreign
-- keys existentes em sessoes/projetos continuam válidas sem tocar
-- nessas tabelas.
--
-- Sem tabela de permissões por módulo nesta etapa (mantido simples,
-- de propósito): controle de acesso via usuarios.perfil, igual já
-- funciona hoje com requireRole().

PRAGMA foreign_keys = OFF;

CREATE TABLE usuarios_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	nome TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE,
	perfil TEXT NOT NULL CHECK (
		perfil IN ('administrador', 'gestor', 'engenheiro', 'colaborador', 'financeiro', 'visualizador')
	),
	ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	senha_hash TEXT,
	ultimo_login_em TEXT
);

INSERT INTO usuarios_new (id, nome, email, perfil, ativo, criado_em, atualizado_em, senha_hash)
SELECT id, nome, email, perfil, ativo, criado_em, atualizado_em, senha_hash FROM usuarios;

DROP TABLE usuarios;
ALTER TABLE usuarios_new RENAME TO usuarios;

CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios (perfil);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios (ativo);

PRAGMA foreign_keys = ON;

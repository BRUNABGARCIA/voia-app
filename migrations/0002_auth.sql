-- Migration: 0002_auth
-- Etapa B - Autenticação, usuários e estrutura base
--
-- Adiciona a coluna de senha (hash) em usuarios e a tabela de sessões
-- server-side. Não altera 0001_init_base.sql, que permanece imutável.
--
-- usuarios.senha_hash fica nullable: um usuário sem hash definido não
-- consegue autenticar (tratado como credencial inválida na aplicação),
-- o que permite que admin@voia.local exista sem senha até ser ativado
-- manualmente em desenvolvimento (veja scripts/hash-password.mjs).

PRAGMA foreign_keys = ON;

ALTER TABLE usuarios ADD COLUMN senha_hash TEXT;

-- =============================================================
-- sessoes
-- =============================================================
CREATE TABLE IF NOT EXISTS sessoes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	expira_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_id ON sessoes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira_em ON sessoes (expira_em);

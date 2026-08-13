-- Migration: 0004_configuracoes_aparencia
-- Etapa C (complemento) - Configurações > Aparência
--
-- Não altera 0001_init_base.sql, 0002_auth.sql nem 0003_equipe_permissoes.sql,
-- que permanecem imutáveis.
--
-- Tabela singleton (uma única linha, id fixo em 1): logo, favicon (como
-- BLOB, nunca Base64) e nome do sistema, editáveis pelo administrador em
-- tempo de execução, sem precisar de deploy. Enquanto logo_blob/
-- favicon_blob forem NULL, a aplicação usa os assets estáticos em
-- public/branding/ como fallback.

CREATE TABLE IF NOT EXISTS configuracoes_aparencia (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	nome_sistema TEXT NOT NULL DEFAULT 'VOIA Engenharia',
	logo_blob BLOB,
	logo_mime TEXT,
	favicon_blob BLOB,
	favicon_mime TEXT,
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_por_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL
);

INSERT INTO configuracoes_aparencia (id, nome_sistema)
VALUES (1, 'VOIA Engenharia');

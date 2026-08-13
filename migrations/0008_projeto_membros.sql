-- Migration: 0008_projeto_membros
-- Etapa D - Clientes + Projetos
--
-- Equipe do projeto: usuários existentes vinculados a um projeto, cada um
-- com uma função ESPECÍFICA NESTE projeto — não confundir com
-- usuarios.perfil, que é a permissão global do usuário no sistema.
--
-- O responsável principal continua sendo só projetos.gerente_id (já
-- existe desde 0001_init_base.sql); não é duplicado aqui como membro,
-- para não manter duas fontes de verdade sincronizadas manualmente.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projeto_membros (
	projeto_id INTEGER NOT NULL REFERENCES projetos (id) ON DELETE CASCADE,
	usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
	funcao TEXT NOT NULL DEFAULT 'colaborador' CHECK (
		funcao IN ('responsavel', 'projetista', 'fiscal', 'orcamentista', 'colaborador')
	),
	adicionado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (projeto_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_membros_usuario_id ON projeto_membros (usuario_id);

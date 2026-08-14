-- Migration: 0014_portal_cliente
-- Evolução VOIA - Base segura do Portal do Cliente
--
-- IMPORTANTE (decisão de arquitetura): a autenticação externa NUNCA é
-- amarrada só a clientes.id. Um cliente (empresa ou PF) pode ter várias
-- pessoas de contato, e cada uma só enxerga os processos que lhe foram
-- explicitamente concedidos — nunca "todos os projetos do cliente" por
-- padrão. Por isso a modelagem é em três tabelas:
--
--   cliente_contatos            -> pessoas com (potencial) acesso externo,
--                                   vinculadas a um cliente.
--   cliente_contato_processos   -> concessão explícita, por pessoa, de
--                                   quais projetos ela pode acompanhar.
--   sessoes_portal               -> sessões do Portal, numa tabela própria,
--                                   completamente separada de "sessoes"
--                                   (login interno). Nunca compartilha
--                                   linha, cookie ou middleware com a
--                                   autenticação administrativa.
--
-- cliente_contatos.senha_hash fica nullable (mesmo padrão de
-- usuarios.senha_hash em 0002): um contato pode ser cadastrado (nome,
-- e-mail, processos autorizados) antes de ter uma senha definida —
-- só consegue entrar no Portal depois de ativado.
--
-- Não altera 0001-0013, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cliente_contatos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	cliente_id INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
	nome TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE,
	telefone TEXT,
	senha_hash TEXT,
	ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
	ultimo_login_em TEXT,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_cliente_contatos_cliente_id ON cliente_contatos (cliente_id);

CREATE TABLE IF NOT EXISTS cliente_contato_processos (
	contato_id INTEGER NOT NULL REFERENCES cliente_contatos (id) ON DELETE CASCADE,
	projeto_id INTEGER NOT NULL REFERENCES projetos (id) ON DELETE CASCADE,
	concedido_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (contato_id, projeto_id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_contato_processos_projeto_id ON cliente_contato_processos (projeto_id);

CREATE TABLE IF NOT EXISTS sessoes_portal (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	contato_id INTEGER NOT NULL REFERENCES cliente_contatos (id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	expira_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessoes_portal_contato_id ON sessoes_portal (contato_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_portal_expira_em ON sessoes_portal (expira_em);

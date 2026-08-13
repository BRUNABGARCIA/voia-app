-- Migration: 0006_clientes_e_projetos
-- Etapa D - Clientes + Projetos
--
-- Evolui organizacoes -> clientes e projetos juntas, na MESMA migration,
-- de propósito: organizacoes é referenciada por projetos.organizacao_id
-- via foreign key, e D1 não confiabilmente respeita
-- "PRAGMA foreign_keys = OFF" para a verificação implícita que
-- "DROP TABLE" faz quando a tabela ainda tem referências ao vivo
-- (testado localmente: um DROP TABLE organizacoes nessas condições falha
-- com FOREIGN KEY constraint mesmo com o pragma desligado). A ordem
-- abaixo evita o problema view: nunca dropamos uma tabela que ainda tem
-- algo apontando para ela.
--
-- Ordem:
--   1. cria "clientes" (schema novo) e copia os dados de organizacoes;
--   2. cria "projetos_new" já apontando para "clientes" (cliente_id) e
--      copia os dados de "projetos" (organizacao_id vira cliente_id, os
--      IDs são preservados);
--   3. dropa "projetos" (antiga) e renomeia projetos_new -> projetos —
--      neste ponto nada mais referencia "organizacoes";
--   4. só então dropa "organizacoes", já sem nenhum referenciador.
--
-- Mudanças em clientes: documento vira opcional (não é mais NOT NULL —
-- exige rebuild, SQLite não remove NOT NULL via ALTER), e adiciona
-- whatsapp, endereço, status (lead/ativo/inativo), origem, responsável
-- interno e observações.
--
-- Mudanças em projetos: cliente_id (renomeado de organizacao_id), CHECK
-- de status ampliado, e adiciona codigo, prioridade, progresso,
-- valor_contratado, datas e endereço da obra.
--
-- Não altera 0001-0005, que permanecem imutáveis. Todos os IDs são
-- preservados nas duas tabelas.

PRAGMA foreign_keys = OFF;

-- =============================================================
-- clientes (evolução de organizacoes)
-- =============================================================
CREATE TABLE clientes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tipo TEXT NOT NULL CHECK (tipo IN ('PF', 'PJ')),
	nome TEXT NOT NULL,
	nome_fantasia TEXT,
	documento TEXT UNIQUE, -- CPF (PF) ou CNPJ (PJ), apenas dígitos; opcional
	email TEXT,
	telefone TEXT,
	whatsapp TEXT,
	cep TEXT,
	logradouro TEXT,
	numero TEXT,
	complemento TEXT,
	bairro TEXT,
	cidade TEXT,
	estado TEXT,
	status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'ativo', 'inativo')),
	origem TEXT,
	responsavel_interno_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	observacoes TEXT,
	ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ativo=1 (dado herdado de 0001_init_base.sql) vira status='ativo'; não
-- havia representação de "lead" antes desta migration.
INSERT INTO clientes (id, tipo, nome, nome_fantasia, documento, email, telefone, ativo, criado_em, atualizado_em, status)
SELECT id, tipo, nome, nome_fantasia, documento, email, telefone, ativo, criado_em, atualizado_em,
	CASE WHEN ativo = 1 THEN 'ativo' ELSE 'inativo' END
FROM organizacoes;

-- =============================================================
-- projetos (aponta para a nova "clientes" desde já)
-- =============================================================
CREATE TABLE projetos_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	cliente_id INTEGER NOT NULL REFERENCES clientes (id) ON DELETE RESTRICT,
	codigo TEXT UNIQUE,
	nome TEXT NOT NULL,
	descricao TEXT,
	status TEXT NOT NULL DEFAULT 'planejamento' CHECK (
		status IN (
			'prospeccao', 'planejamento', 'em_andamento', 'aguardando_cliente',
			'aguardando_terceiro', 'pausado', 'concluido', 'cancelado'
		)
	),
	prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
	progresso INTEGER NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
	valor_contratado INTEGER, -- centavos; resumo operacional, não é o módulo Financeiro
	data_inicio TEXT,
	prazo_previsto TEXT,
	cep TEXT,
	logradouro TEXT,
	numero TEXT,
	complemento TEXT,
	bairro TEXT,
	cidade TEXT,
	estado TEXT,
	gerente_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	criado_por_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
	observacoes TEXT,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

INSERT INTO projetos_new (id, cliente_id, nome, descricao, status, gerente_id, criado_por_id, criado_em, atualizado_em)
SELECT id, organizacao_id, nome, descricao, status, gerente_id, criado_por_id, criado_em, atualizado_em
FROM projetos;

DROP TABLE projetos;
ALTER TABLE projetos_new RENAME TO projetos;

-- Só agora "organizacoes" fica sem nenhum referenciador.
DROP TABLE organizacoes;

CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON clientes (tipo);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON clientes (status);
CREATE INDEX IF NOT EXISTS idx_clientes_responsavel_interno_id ON clientes (responsavel_interno_id);

CREATE INDEX IF NOT EXISTS idx_projetos_cliente_id ON projetos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos (status);
CREATE INDEX IF NOT EXISTS idx_projetos_gerente_id ON projetos (gerente_id);
CREATE INDEX IF NOT EXISTS idx_projetos_prioridade ON projetos (prioridade);

PRAGMA foreign_keys = ON;

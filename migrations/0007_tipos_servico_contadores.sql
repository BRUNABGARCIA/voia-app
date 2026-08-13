-- Migration: 0007_tipos_servico_contadores
-- Etapa D - Clientes + Projetos
--
-- contadores: sequência atômica genérica usada para gerar o código
-- automático do projeto (PRJ-{ANO}-0001, reiniciado a cada ano), via
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING em um único statement —
-- evita a corrida de "SELECT MAX+1" seguido de "INSERT" em dois passos.
--
-- tipos_servico: catálogo de tipos de serviço de engenharia. Semeado com
-- a lista inicial pedida, mas como tabela (não CHECK fixo) de propósito:
-- o VOIA não deve ficar preso só a Arquitetura, e outras empresas de
-- engenharia podem precisar de catálogos diferentes no futuro.
--
-- projeto_tipos_servico: relação muitos-para-muitos entre projetos e
-- tipos_servico (um projeto pode ter mais de um tipo de serviço).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contadores (
	chave TEXT PRIMARY KEY,
	valor INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tipos_servico (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	nome TEXT NOT NULL UNIQUE,
	ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

INSERT INTO tipos_servico (nome) VALUES
	('Arquitetônico'),
	('Interiores'),
	('Estrutural'),
	('Elétrico'),
	('Hidrossanitário'),
	('Prevenção e Combate a Incêndio'),
	('Regularização'),
	('Aprovação'),
	('Vistoria'),
	('Laudo'),
	('Orçamento'),
	('Medição'),
	('Gestão de Obra'),
	('Execução'),
	('Consultoria'),
	('Outros');

CREATE TABLE IF NOT EXISTS projeto_tipos_servico (
	projeto_id INTEGER NOT NULL REFERENCES projetos (id) ON DELETE CASCADE,
	tipo_servico_id INTEGER NOT NULL REFERENCES tipos_servico (id) ON DELETE RESTRICT,
	PRIMARY KEY (projeto_id, tipo_servico_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_tipos_servico_tipo ON projeto_tipos_servico (tipo_servico_id);

-- Migration: 0016_tipo_servico_modelo_tarefa
-- Etapa E - Tarefas, cronograma e automação por tipo de serviço
--
-- Tarefas padrão dentro de uma etapa padrão do modelo de processo
-- (tipo_servico_etapas_modelo, 0011). Continua sendo TEMPLATE — nunca
-- confundir com projeto_tarefas (instância real, 0017): editar aqui não
-- afeta projetos já criados, só a próxima geração automática.
--
-- prioridade_padrao e responsavel_padrao_id são só sugestões copiadas para
-- a tarefa do projeto no momento da geração — o responsável real do
-- projeto pode ser trocado depois sem tocar no modelo.
--
-- exige_aprovacao nasce presente (default 0) para deixar a estrutura
-- preparada para uma evolução futura (fluxo de aprovação/validação da
-- tarefa) sem exigir nova migration quando isso for implementado — não há
-- lógica de aprovação nesta rodada.
--
-- Não altera 0001-0015, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tipo_servico_modelo_tarefa (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	modelo_etapa_id INTEGER NOT NULL REFERENCES tipo_servico_etapas_modelo (id) ON DELETE CASCADE,
	nome TEXT NOT NULL,
	descricao TEXT,
	ordem INTEGER NOT NULL DEFAULT 0,
	prazo_dias INTEGER,
	prioridade_padrao TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade_padrao IN ('baixa', 'normal', 'alta', 'urgente')),
	responsavel_padrao_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	visivel_cliente INTEGER NOT NULL DEFAULT 1 CHECK (visivel_cliente IN (0, 1)),
	exige_aprovacao INTEGER NOT NULL DEFAULT 0 CHECK (exige_aprovacao IN (0, 1)),
	ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_tipo_servico_modelo_tarefa_modelo_etapa_id ON tipo_servico_modelo_tarefa (modelo_etapa_id);
CREATE INDEX IF NOT EXISTS idx_tipo_servico_modelo_tarefa_modelo_ordem ON tipo_servico_modelo_tarefa (modelo_etapa_id, ordem);

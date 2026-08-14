-- Migration: 0017_projeto_tarefas
-- Etapa E - Tarefas, cronograma e automação por tipo de serviço
--
-- Tarefas do projeto, vinculadas a uma etapa do projeto (projeto_etapas,
-- 0009/0012). São instâncias independentes do modelo: geradas por cópia a
-- partir de tipo_servico_modelo_tarefa (0016) quando a estrutura do tipo de
-- serviço é gerada, mas editáveis livremente depois sem qualquer efeito no
-- template. origem_modelo_id preserva só a referência de origem
-- (indicadores futuros / evitar duplicar geração), igual ao padrão já usado
-- em projeto_etapas.modelo_etapa_id.
--
-- Status inclui "aguardando" (ex.: aguardando insumo externo) além dos já
-- usados em projeto_etapas; "cancelada" existe aqui mas não em
-- projeto_etapas — cancelar uma tarefa não cancela a etapa, e o cálculo de
-- progresso (worker/projetos/progresso.ts) explicitamente exclui tarefas
-- canceladas do denominador.
--
-- etapa_id é NOT NULL (toda tarefa pertence a uma etapa) — diferente de
-- projeto_atualizacoes.etapa_id, que é opcional.
--
-- Não altera 0001-0016, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projeto_tarefas (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	projeto_id INTEGER NOT NULL REFERENCES projetos (id) ON DELETE CASCADE,
	etapa_id INTEGER NOT NULL REFERENCES projeto_etapas (id) ON DELETE CASCADE,
	nome TEXT NOT NULL,
	descricao TEXT,
	ordem INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'pendente' CHECK (
		status IN ('pendente', 'em_andamento', 'aguardando', 'concluida', 'cancelada')
	),
	prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
	responsavel_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	data_inicio TEXT,
	prazo TEXT,
	data_conclusao TEXT,
	visivel_cliente INTEGER NOT NULL DEFAULT 1 CHECK (visivel_cliente IN (0, 1)),
	origem_modelo_id INTEGER REFERENCES tipo_servico_modelo_tarefa (id) ON DELETE SET NULL,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_projeto_id ON projeto_tarefas (projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_etapa_id ON projeto_tarefas (etapa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_responsavel_id ON projeto_tarefas (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_status ON projeto_tarefas (status);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_prazo ON projeto_tarefas (prazo);

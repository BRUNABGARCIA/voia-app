-- Migration: 0023_projeto_parceiro_financeiro
-- Rodada 03 (revisão) — Financeiro do Parceiro ("Meus Recebimentos")
--
-- Auditoria prévia (obrigatória por instrução desta rodada): nenhuma
-- tabela financeira existe hoje — a única coluna monetária em todo o
-- schema é projetos.valor_contratado (INTEGER, centavos). Esta migration
-- segue o MESMO padrão monetário já em uso: todo valor é INTEGER em
-- centavos (nunca REAL/float, que introduz erro de arredondamento em
-- dinheiro) — valor_acordado e projeto_parceiro_pagamentos.valor incluídos.
--
-- Duas tabelas, de propósito, em vez de uma só (pedido explícito desta
-- rodada): o ACORDO (quanto e como foi combinado com o parceiro) é um
-- registro estável; os PAGAMENTOS (cada parcela, programada ou já feita)
-- mudam de status com frequência. Misturar as duas numa linha só
-- obrigaria a reescrever o acordo a cada pagamento, ou a duplicar o
-- acordo por pagamento — nenhuma das duas opções é correta aqui.
--
-- projeto_parceiro_remuneracoes — o que foi combinado com o parceiro:
--   - tipo: fixo, percentual, por_etapa, por_entrega, bonus, adiantamento
--     ou reembolso (catálogo pedido nesta rodada).
--   - valor_acordado: SEMPRE o valor final em centavos que o parceiro vai
--     receber, mesmo quando tipo = 'percentual'. Nunca é derivado no
--     payload do Parceiro a partir de um valor-base comercial (esse
--     valor-base nunca é persistido aqui nem enviado ao parceiro — ver
--     comentário de arquitetura em src/worker/financeiro/routes.ts).
--   - percentual: só informativo/de exibição ("seu percentual é X%"),
--     REAL (ex.: 12.5) porque nunca participa de cálculo monetário no
--     servidor — quem decide o valor_acordado final é o administrador,
--     fora desta coluna. NULL quando tipo != 'percentual'.
--   - etapa_id: só relevante quando tipo = 'por_etapa'; ON DELETE SET NULL
--     (excluir a etapa não pode apagar o acordo financeiro, só perder a
--     referência a ela — mesmo padrão já usado em
--     projeto_atualizacoes.etapa_id).
--   - referencia_entrega: texto livre curto, só relevante quando tipo =
--     'por_entrega' (ex.: "Entrega do projeto executivo - torre B").
--   - ativo: permite desativar um acordo superado (renegociação) sem
--     apagar o histórico de pagamentos já vinculados a ele.
--   - projeto_id e parceiro_id usam ON DELETE RESTRICT (não CASCADE):
--     diferente de projeto_etapas/tarefas/atualizacoes/documentos (que
--     cascateiam a partir de projetos.id — risco já documentado na Rodada
--     02), um registro financeiro nunca deve desaparecer silenciosamente
--     junto com o projeto ou o usuário; qualquer exclusão futura desses
--     dois precisaria tratar o financeiro explicitamente antes.
--
-- projeto_parceiro_pagamentos — cada pagamento (programado ou realizado):
--   - remuneracao_id: ON DELETE CASCADE — um pagamento só existe no
--     contexto do acordo que o gerou; sem o acordo, a parcela não tem
--     mais sentido isolada (diferente da relação projeto/parceiro acima).
--   - status: pendente (ainda sem data definida) -> programado (com
--     data_programada) -> pago (com data_pagamento e confirmado_por_id) —
--     ou cancelado, em qualquer ponto antes de pago.
--   - confirmado_por_id: quem confirmou o pagamento como "pago" —
--     sempre administrador, aplicado em src/worker/financeiro/routes.ts,
--     nunca o próprio parceiro (ele é read-only sobre status/valores).
--   - comprovante_documento_id: reaproveita projeto_documentos (já
--     existente, com storage_key/R2) em vez de criar uma segunda tabela
--     de arquivo — mesmo padrão já recomendado em
--     docs/ARQUITETURA-VOIA-2.md.
--
-- Saldo a receber (valor_acordado - soma dos pagamentos com status
-- 'pago') é sempre CALCULADO a partir destas duas tabelas, nunca
-- armazenado — e nunca depende de projetos.valor_contratado.
--
-- Não altera 0001-0022, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projeto_parceiro_remuneracoes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	projeto_id INTEGER NOT NULL REFERENCES projetos (id) ON DELETE RESTRICT,
	parceiro_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
	tipo TEXT NOT NULL CHECK (
		tipo IN ('fixo', 'percentual', 'por_etapa', 'por_entrega', 'bonus', 'adiantamento', 'reembolso')
	),
	valor_acordado INTEGER NOT NULL CHECK (valor_acordado >= 0),
	percentual REAL,
	etapa_id INTEGER REFERENCES projeto_etapas (id) ON DELETE SET NULL,
	referencia_entrega TEXT,
	ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_remuneracoes_projeto_id ON projeto_parceiro_remuneracoes (projeto_id);
CREATE INDEX IF NOT EXISTS idx_remuneracoes_parceiro_id ON projeto_parceiro_remuneracoes (parceiro_id);

CREATE TABLE IF NOT EXISTS projeto_parceiro_pagamentos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	remuneracao_id INTEGER NOT NULL REFERENCES projeto_parceiro_remuneracoes (id) ON DELETE CASCADE,
	valor INTEGER NOT NULL CHECK (valor >= 0),
	data_programada TEXT,
	data_pagamento TEXT,
	status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'programado', 'pago', 'cancelado')),
	confirmado_por_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	observacao TEXT,
	comprovante_documento_id INTEGER REFERENCES projeto_documentos (id) ON DELETE SET NULL,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_remuneracao_id ON projeto_parceiro_pagamentos (remuneracao_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON projeto_parceiro_pagamentos (status);

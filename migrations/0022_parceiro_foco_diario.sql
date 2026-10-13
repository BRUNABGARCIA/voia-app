-- Migration: 0022_parceiro_foco_diario
-- Rodada 03 (revisão) — "Meu foco de hoje"
--
-- Auditoria prévia (obrigatória por instrução desta rodada): não existe
-- hoje nenhuma tabela de preferência/anotação pessoal por usuário+data.
-- "Meu foco de hoje" precisa ficar amarrado ao usuário autenticado (nunca
-- visível a outro usuário, inclusive outro Parceiro) e à data — por isso
-- exige persistência real no servidor, não localStorage (que não
-- garantiria "nunca aparece para outro parceiro" num computador
-- compartilhado, por exemplo).
--
-- Modelo mínimo, sem perfil específico na tabela: qualquer usuário
-- autenticado (não só Parceiro) PODE ter um foco do dia — a feature foi
-- pedida para Parceiro, mas nada na tabela amarra isso a um perfil
-- específico; a regra "só lê/escreve o próprio foco" é de autorização
-- (src/worker/foco/routes.ts: sempre usuario_id = usuário da sessão,
-- nunca aceito do corpo da requisição), não de schema.
--
-- PRIMARY KEY (usuario_id, data): atualizar o foco do mesmo dia substitui
-- o registro daquele dia (INSERT ... ON CONFLICT DO UPDATE, nunca duplica);
-- uma data diferente é sempre um registro novo. "data" é TEXT no formato
-- YYYY-MM-DD (mesmo padrão de todas as colunas de data do projeto, nunca
-- DATETIME/TIMESTAMP para dia civil).
--
-- ON DELETE CASCADE em usuario_id: se um usuário for removido, seu
-- histórico de foco diário (dado pessoal, sem valor para auditoria ou
-- terceiros) é removido com ele — mesmo tratamento já usado em
-- sessoes.usuario_id.
--
-- Não altera 0001-0021, que permanecem imutáveis.

CREATE TABLE IF NOT EXISTS parceiro_foco_diario (
	usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
	data TEXT NOT NULL,
	texto TEXT NOT NULL,
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (usuario_id, data)
);

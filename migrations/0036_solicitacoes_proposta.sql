-- Snapshot externo independente dos snapshots comerciais da planilha.
-- A sequência global AUTOINCREMENT evita reutilização e corridas de numeração.
CREATE TABLE obra_solicitacoes_proposta (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 chave TEXT NOT NULL UNIQUE,
 requisicao_hash TEXT NOT NULL CHECK(length(requisicao_hash)=64),
 planilha_id INTEGER NOT NULL REFERENCES obra_planilhas(id) ON DELETE RESTRICT,
 versao INTEGER NOT NULL CHECK(versao > 0),
 itens_origem TEXT NOT NULL CHECK(json_valid(itens_origem)),
 documento TEXT NOT NULL CHECK(json_valid(documento)),
 criada_por INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 emitida_em TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'emitida' CHECK(status IN ('emitida','cancelada')),
 cancelada_em TEXT,
 cancelada_por INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
 motivo_cancelamento TEXT,
 CHECK((status='emitida' AND cancelada_em IS NULL AND cancelada_por IS NULL AND motivo_cancelamento IS NULL)
 OR (status='cancelada' AND cancelada_em IS NOT NULL AND cancelada_por IS NOT NULL AND length(motivo_cancelamento)>0))
);
CREATE INDEX idx_solicitacoes_planilha ON obra_solicitacoes_proposta(planilha_id,id DESC);
CREATE TRIGGER solicitacao_conteudo_imutavel BEFORE UPDATE ON obra_solicitacoes_proposta
WHEN NEW.id IS NOT OLD.id OR NEW.chave IS NOT OLD.chave OR NEW.requisicao_hash IS NOT OLD.requisicao_hash OR NEW.planilha_id IS NOT OLD.planilha_id
 OR NEW.versao IS NOT OLD.versao OR NEW.itens_origem IS NOT OLD.itens_origem OR NEW.documento IS NOT OLD.documento
 OR NEW.criada_por IS NOT OLD.criada_por OR NEW.emitida_em IS NOT OLD.emitida_em OR OLD.status='cancelada'
BEGIN SELECT RAISE(ABORT,'Solicitação emitida é imutável'); END;
CREATE TRIGGER solicitacao_sem_exclusao BEFORE DELETE ON obra_solicitacoes_proposta
BEGIN SELECT RAISE(ABORT,'Cancele a solicitação; preserve o histórico'); END;

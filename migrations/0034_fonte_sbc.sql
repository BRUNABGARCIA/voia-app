-- Expands the accepted source set only. SQLite requires rebuilding the CHECK owner.
-- Run as one migration transaction. Existing IDs, values, timestamps and sequence survive.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE _0034_sequence(value INTEGER);
INSERT INTO _0034_sequence SELECT seq FROM sqlite_sequence WHERE name='bases_referencia';
DROP TRIGGER sicro_contexto_fonte;
DROP TRIGGER sinapi_item_unico;
CREATE TABLE bases_referencia_0034(
 id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,tipo TEXT NOT NULL CHECK(tipo IN('VOIA','SINAPI','SICRO','SBC','PROPRIA','IMPORTADA','OUTRA')),
 descricao TEXT NOT NULL,origem TEXT NOT NULL,competencia TEXT NOT NULL,uf TEXT NOT NULL,data_referencia TEXT NOT NULL,versao TEXT NOT NULL,regime TEXT NOT NULL,observacoes TEXT NOT NULL,
 ativa INTEGER NOT NULL DEFAULT 1 CHECK(ativa IN(0,1)),criada_por INTEGER REFERENCES usuarios(id),criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,atualizada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(nome,tipo,competencia,uf,versao,regime)
);
INSERT INTO bases_referencia_0034 SELECT * FROM bases_referencia;
DROP TABLE bases_referencia;
ALTER TABLE bases_referencia_0034 RENAME TO bases_referencia;
UPDATE sqlite_sequence SET seq=MAX(seq,COALESCE((SELECT value FROM _0034_sequence),seq)) WHERE name='bases_referencia';
DROP TABLE _0034_sequence;
CREATE INDEX idx_bases_fonte ON bases_referencia(ativa,tipo,competencia,uf);
CREATE TRIGGER sinapi_base_unica BEFORE INSERT ON bases_referencia WHEN NEW.tipo='SINAPI'
BEGIN
 SELECT RAISE(ABORT,'SINAPI: uma base por competência, UF e versão; ambos os regimes pertencem ao item')
 WHERE NEW.regime<>'' OR EXISTS(SELECT 1 FROM bases_referencia WHERE tipo='SINAPI' AND competencia=NEW.competencia AND uf=NEW.uf AND versao=NEW.versao);
END;
CREATE TRIGGER sinapi_item_unico BEFORE INSERT ON base_itens
WHEN EXISTS(SELECT 1 FROM bases_referencia WHERE id=NEW.base_id AND tipo='SINAPI')
BEGIN
 SELECT RAISE(ABORT,'SINAPI: código e tipo já existem nesta referência')
 WHERE EXISTS(SELECT 1 FROM base_itens WHERE base_id=NEW.base_id AND codigo=NEW.codigo AND tipo=NEW.tipo);
END;
CREATE TRIGGER sicro_base_unica BEFORE INSERT ON bases_referencia WHEN NEW.tipo='SICRO'
BEGIN
 SELECT RAISE(ABORT,'SICRO: uma referência por UF, competência e versão') WHERE NEW.regime<>'' OR EXISTS(SELECT 1 FROM bases_referencia WHERE tipo='SICRO' AND uf=NEW.uf AND competencia=NEW.competencia AND versao=NEW.versao);
END;
CREATE TRIGGER sicro_contexto_fonte BEFORE INSERT ON base_item_sicro BEGIN
 SELECT RAISE(ABORT,'Contexto SICRO exige item SICRO') WHERE NOT EXISTS(SELECT 1 FROM base_itens i JOIN bases_referencia b ON b.id=i.base_id WHERE i.id=NEW.item_id AND b.tipo='SICRO');
END;
-- Verify the actual FK graph before clearing deferred DROP/rename bookkeeping.
CREATE TABLE _0034_fk_guard(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO _0034_fk_guard SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM pragma_foreign_key_check) THEN 1 ELSE 0 END;
DROP TABLE _0034_fk_guard;
PRAGMA defer_foreign_keys=OFF;

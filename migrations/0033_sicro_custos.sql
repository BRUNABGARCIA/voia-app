-- Additive only. No existing row, SINAPI regime or worksheet is rewritten.
CREATE TABLE base_item_sicro (
 item_id INTEGER PRIMARY KEY REFERENCES base_itens(id) ON DELETE RESTRICT,
 subtipo TEXT NOT NULL CHECK(subtipo IN('composicao','material','equipamento','mao_de_obra')),
 memorias TEXT NOT NULL CHECK(json_valid(memorias))
);
CREATE TABLE base_item_custos (
 id INTEGER PRIMARY KEY,
 item_id INTEGER NOT NULL REFERENCES base_item_sicro(item_id) ON DELETE RESTRICT,
 tipo TEXT NOT NULL,edicao TEXT NOT NULL,valor_decimal TEXT,
 unidade TEXT NOT NULL,selecionavel INTEGER NOT NULL CHECK(selecionavel IN(0,1)),
 dados TEXT NOT NULL CHECK(json_valid(dados)),
 CHECK(valor_decimal IS NULL OR (length(valor_decimal) BETWEEN 1 AND 60 AND json_valid(valor_decimal) AND valor_decimal NOT GLOB '*[^0-9.]*' AND valor_decimal GLOB '[0-9]*')),
 UNIQUE(item_id,tipo,edicao)
);
CREATE INDEX idx_sicro_subtipo_item ON base_item_sicro(subtipo,item_id);
CREATE TRIGGER sicro_base_unica BEFORE INSERT ON bases_referencia WHEN NEW.tipo='SICRO'
BEGIN
 SELECT RAISE(ABORT,'SICRO: uma referência por UF, competência e versão') WHERE NEW.regime<>'' OR EXISTS(SELECT 1 FROM bases_referencia WHERE tipo='SICRO' AND uf=NEW.uf AND competencia=NEW.competencia AND versao=NEW.versao);
END;
CREATE TRIGGER sicro_contexto_fonte BEFORE INSERT ON base_item_sicro BEGIN
 SELECT RAISE(ABORT,'Contexto SICRO exige item SICRO') WHERE NOT EXISTS(SELECT 1 FROM base_itens i JOIN bases_referencia b ON b.id=i.base_id WHERE i.id=NEW.item_id AND b.tipo='SICRO');
END;
CREATE TRIGGER sicro_contexto_update BEFORE UPDATE ON base_item_sicro BEGIN SELECT RAISE(ABORT,'publique nova versão da base'); END;
CREATE TRIGGER sicro_contexto_delete BEFORE DELETE ON base_item_sicro BEGIN SELECT RAISE(ABORT,'preserve a referência'); END;
CREATE TRIGGER sicro_custo_update BEFORE UPDATE ON base_item_custos BEGIN SELECT RAISE(ABORT,'publique nova versão da base'); END;
CREATE TRIGGER sicro_custo_delete BEFORE DELETE ON base_item_custos BEGIN SELECT RAISE(ABORT,'preserve a referência'); END;

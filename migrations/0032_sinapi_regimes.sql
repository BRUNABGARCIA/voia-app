-- Additive: existing prices, references, library and worksheet snapshots are untouched.
ALTER TABLE base_itens ADD COLUMN preco_nao_desonerado_centavos INTEGER CHECK(preco_nao_desonerado_centavos IS NULL OR preco_nao_desonerado_centavos>0);
ALTER TABLE base_itens ADD COLUMN preco_desonerado_centavos INTEGER CHECK(preco_desonerado_centavos IS NULL OR preco_desonerado_centavos>0);
ALTER TABLE base_itens ADD COLUMN metadados TEXT CHECK(metadados IS NULL OR (json_valid(metadados) AND length(metadados)<=12000));
-- Legacy SINAPI editions are retained. New editions cannot split their identity by regime.
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
CREATE INDEX idx_base_itens_tipo_codigo ON base_itens(base_id,tipo,codigo);

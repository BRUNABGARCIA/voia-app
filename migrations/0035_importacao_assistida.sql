-- Additive only: monthly imports reuse existing staging and immutable catalog.
ALTER TABLE bases_importacoes ADD COLUMN manifesto TEXT CHECK(manifesto IS NULL OR json_valid(manifesto));
ALTER TABLE bases_importacoes ADD COLUMN resumo TEXT CHECK(resumo IS NULL OR json_valid(resumo));
ALTER TABLE bases_importacoes ADD COLUMN nova_base INTEGER NOT NULL DEFAULT 0 CHECK(nova_base IN(0,1));
ALTER TABLE bases_importacoes ADD COLUMN erro TEXT;
CREATE TABLE bases_importacao_arquivos(
 importacao_id TEXT NOT NULL REFERENCES bases_importacoes(id) ON DELETE RESTRICT,
 sha256 TEXT NOT NULL,nome TEXT NOT NULL,bytes INTEGER NOT NULL CHECK(bytes>0),storage_key TEXT NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(importacao_id,sha256)
);

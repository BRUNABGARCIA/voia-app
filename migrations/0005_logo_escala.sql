-- Aditiva: tamanho visual da logo na sidebar (percentual, 60-130), configurável
-- pelo painel Aparência. Não altera nem recria as colunas da migration 0004.
ALTER TABLE configuracoes_aparencia ADD COLUMN logo_escala INTEGER NOT NULL DEFAULT 100;

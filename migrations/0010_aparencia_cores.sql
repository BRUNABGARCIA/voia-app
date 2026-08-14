-- Migration: 0010_aparencia_cores
-- Evolução VOIA - Cores personalizáveis em Configurações > Aparência
--
-- Adiciona os campos de tema (cores) à configuracoes_aparencia (linha
-- única, id=1, criada em 0004). Aditiva: nenhuma coluna existente é
-- alterada ou removida. Os valores padrão preservam a identidade VOIA
-- (preto/dourado) mas com um fundo mais claro e neutro do que o
-- bege usado até aqui (pedido explícito de deixar o visual padrão mais
-- leve).
--
-- Formato esperado: hex de 6 dígitos ("#rrggbb"). Uma tentativa de CHECK
-- com GLOB (validação do formato hex direto no schema) foi testada e
-- rejeitada pelo D1 local com "LIKE or GLOB pattern too complex" — é uma
-- limitação da própria plataforma (a mesma classe de caractere repetida
-- 6x já ultrapassa o limite de complexidade aceito), não um erro de
-- sintaxe. Seguindo o mesmo padrão já usado em logo_escala (migration
-- 0005 — NOT NULL DEFAULT, sem CHECK de formato), a validação de formato
-- e contraste fica inteiramente na API (zod) e no frontend.
--
-- Não altera 0001-0009, que permanecem imutáveis.

ALTER TABLE configuracoes_aparencia ADD COLUMN cor_principal TEXT NOT NULL DEFAULT '#124435';
ALTER TABLE configuracoes_aparencia ADD COLUMN cor_destaque TEXT NOT NULL DEFAULT '#F7C94A';
ALTER TABLE configuracoes_aparencia ADD COLUMN cor_fundo TEXT NOT NULL DEFAULT '#F7F7F5';
ALTER TABLE configuracoes_aparencia ADD COLUMN cor_superficie TEXT NOT NULL DEFAULT '#FFFFFF';
ALTER TABLE configuracoes_aparencia ADD COLUMN cor_sidebar TEXT NOT NULL DEFAULT '#000000';
ALTER TABLE configuracoes_aparencia ADD COLUMN cor_texto_principal TEXT NOT NULL DEFAULT '#1B1F1C';
ALTER TABLE configuracoes_aparencia ADD COLUMN cor_texto_secundario TEXT NOT NULL DEFAULT '#3D443F';

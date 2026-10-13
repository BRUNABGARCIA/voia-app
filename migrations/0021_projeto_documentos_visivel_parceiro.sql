-- Migration: 0021_projeto_documentos_visivel_parceiro
-- Rodada 03 (revisão) — Visibilidade de documentos para o Parceiro
--
-- Auditoria prévia (obrigatória por instrução desta rodada): projeto_documentos
-- (0019) já tem "visivel_cliente" (0/1, nasce 0 — oculto por padrão), que
-- controla exclusivamente o que o Portal do Cliente pode baixar
-- (src/worker/portal/processos.ts, buscarDocumentoBaixavel). Não existe
-- hoje nenhuma coluna equivalente para o Parceiro (perfil "colaborador"):
-- antes desta migration, todo documento de um projeto era visível a
-- qualquer membro desse projeto (projeto_membros), sem controle explícito.
--
-- visivel_parceiro segue EXATAMENTE o mesmo padrão de visivel_cliente —
-- nasce 0 (oculto, DEFAULT DENY): um documento só aparece para o Parceiro
-- quando alguém com permissão (administrador/gestor) marcar explicitamente
-- esse campo como 1. É uma coluna independente de visivel_cliente — as
-- duas são ortogonais de propósito:
--   - liberar para Cliente (visivel_cliente=1) NÃO libera para Parceiro;
--   - liberar para Parceiro (visivel_parceiro=1) NÃO libera para Cliente;
--   - um documento pode estar liberado para nenhum, um ou os dois ao
--     mesmo tempo, sem nenhuma relação de implicação entre as colunas.
--
-- administrador e gestor continuam vendo/gerenciando todos os documentos
-- do projeto independente deste campo (mesma régua já existente de
-- requireProjectAccess + requireRole em projetos/routes.ts) — esta coluna
-- só é consultada quando o perfil autenticado é "colaborador"
-- (src/worker/projetos/acesso.ts).
--
-- Documentos já cadastrados antes desta migration nascem com
-- visivel_parceiro = 0 (comportamento seguro por padrão: nada que já
-- existia vira visível ao Parceiro sem decisão explícita de quem
-- administra o projeto).
--
-- Não altera 0001-0020, que permanecem imutáveis.

ALTER TABLE projeto_documentos ADD COLUMN visivel_parceiro INTEGER NOT NULL DEFAULT 0 CHECK (visivel_parceiro IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_projeto_documentos_visivel_parceiro ON projeto_documentos (visivel_parceiro);

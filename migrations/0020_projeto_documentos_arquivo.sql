-- Migration: 0020_projeto_documentos_arquivo
-- Rodada R2 — Armazenamento real de documentos
--
-- Auditoria prévia (obrigatória por instrução desta rodada): a migration
-- 0019 já criou "storage_key" (sempre NULL até aqui, nenhum binding R2
-- configurado). Esta migration só ADICIONA as colunas necessárias para
-- guardar metadados do arquivo real quando ele existir — nunca o conteúdo
-- do arquivo em si, que passa a viver no Cloudflare R2 (binding
-- "DOCUMENTOS_BUCKET", adicionado em wrangler.json nesta mesma rodada).
--
-- nome_arquivo_original: nome do arquivo como o usuário enviou (a chave em
-- si, "storage_key", é um UUID + nome sanitizado, nunca o nome original
-- puro, para evitar colisão e path traversal — ver src/worker/storage).
-- mime_type: Content-Type reportado pelo navegador no upload, usado ao
-- servir o download (best-effort; a extensão + assinatura de bytes é
-- validada no upload, não neste campo).
-- tamanho_bytes: tamanho real do arquivo, para exibir na interface sem
-- precisar consultar o R2 a cada listagem.
--
-- Todas as três colunas ficam NULL para documentos que não têm arquivo
-- anexado (nem os cadastrados antes desta rodada, nem os cadastrados só
-- como metadado daqui em diante) — a interface trata isso como "arquivo
-- não anexado", nunca quebra.
--
-- Não altera 0001-0019, que permanecem imutáveis.

ALTER TABLE projeto_documentos ADD COLUMN nome_arquivo_original TEXT;
ALTER TABLE projeto_documentos ADD COLUMN mime_type TEXT;
ALTER TABLE projeto_documentos ADD COLUMN tamanho_bytes INTEGER;

-- Migration: 0027_obra_fotos
-- Rodada 04 - Fotos da Obra
--
-- Reaproveita o R2 existente (binding "DOCUMENTOS_BUCKET", bucket
-- "voia-documentos") e o mesmo padrão de chave/metadados já validado em
-- projeto_documentos (0019/0020) — storage_key sempre um UUID + nome
-- sanitizado (nunca o nome original puro), nunca o conteúdo do arquivo no
-- D1. Tabela própria (em vez de reaproveitar projeto_documentos
-- diretamente) porque foto tem metadado específico (obra_id, rdo_id
-- opcional, legenda, data) que não cabe bem no modelo de "documento" sem
-- forçar colunas nullable-por-tipo ali; mas o storage em si é o mesmo R2 e
-- os mesmos helpers (src/worker/storage/documentos.ts).
--
-- rdo_id é opcional: uma foto pode estar amarrada a um RDO específico
-- (registro do dia) ou só à obra em geral. ON DELETE SET NULL — excluir o
-- RDO não apaga a foto, só desvincula (mesmo padrão de
-- projeto_documentos.etapa_id).
--
-- Não altera 0001-0026, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS obra_fotos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	obra_id INTEGER NOT NULL REFERENCES obras (id) ON DELETE CASCADE,
	rdo_id INTEGER REFERENCES obra_rdo (id) ON DELETE SET NULL,
	legenda TEXT,
	data TEXT NOT NULL,
	enviado_por_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	storage_key TEXT NOT NULL,
	nome_arquivo_original TEXT,
	mime_type TEXT,
	tamanho_bytes INTEGER,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_obra_fotos_obra_id ON obra_fotos (obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_fotos_rdo_id ON obra_fotos (rdo_id);

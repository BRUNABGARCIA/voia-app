-- Migration: 0019_projeto_documentos
-- Etapa H - Camada de domínio de Documentos do Projeto
--
-- Auditoria prévia (obrigatória por instrução desta rodada): não existe
-- nenhum binding R2, nenhuma tabela de arquivos, nenhum endpoint de
-- upload/download em nenhum lugar do projeto (wrangler.json só declara o
-- binding D1). Esta migration cria SOMENTE a camada de domínio (metadados)
-- do documento — nunca o conteúdo do arquivo em si. Não é permitido guardar
-- o arquivo como base64/BLOB no D1 (armazenamento improvisado e inseguro
-- para esse volume/tipo de dado); por isso "storage_key" nasce sempre NULL
-- nesta rodada e só passa a ser preenchido quando um binding R2 for
-- configurado em uma rodada futura — a esse ponto, só os endpoints de
-- upload/download precisam ser adicionados, o modelo já está pronto.
--
-- categoria é uma lista fechada e simples (CHECK), pedida nesta rodada —
-- evita "GED complexo" com taxonomia livre.
--
-- etapa_id é opcional (documento pode estar solto no projeto ou amarrado a
-- uma etapa específica), ON DELETE SET NULL — excluir a etapa não pode
-- apagar o registro do documento, só perder a referência a ela (mesmo
-- padrão de projeto_atualizacoes.etapa_id).
--
-- visivel_cliente nasce 0 (oculto) por padrão — nunca expõe documento ao
-- Portal do Cliente sem decisão explícita de quem cadastrou.
--
-- Não altera 0001-0018, que permanecem imutáveis.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projeto_documentos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	projeto_id INTEGER NOT NULL REFERENCES projetos (id) ON DELETE CASCADE,
	etapa_id INTEGER REFERENCES projeto_etapas (id) ON DELETE SET NULL,
	nome TEXT NOT NULL,
	categoria TEXT NOT NULL DEFAULT 'outros' CHECK (
		categoria IN (
			'contrato', 'proposta', 'projeto', 'levantamento', 'relatorio',
			'art_rrt', 'aprovacao', 'documento_cliente', 'outros'
		)
	),
	descricao TEXT,
	visivel_cliente INTEGER NOT NULL DEFAULT 0 CHECK (visivel_cliente IN (0, 1)),
	-- Chave do objeto no storage (Cloudflare R2) quando o arquivo existir de
	-- fato. Sempre NULL nesta rodada — reservado para quando o binding R2
	-- for configurado.
	storage_key TEXT,
	autor_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
	criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_projeto_documentos_projeto_id ON projeto_documentos (projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_documentos_categoria ON projeto_documentos (categoria);
CREATE INDEX IF NOT EXISTS idx_projeto_documentos_etapa_id ON projeto_documentos (etapa_id);

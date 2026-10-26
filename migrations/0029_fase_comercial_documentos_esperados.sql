-- Rodada 3: somente colunas aditivas. Não presume fase de projetos legados
-- nem converte registros documentais antigos em documentos esperados.
-- Reversão conceitual: versão anterior pode ignorar estas colunas; preservar
-- dados antes de qualquer remoção de coluna em uma migration futura revisada.
ALTER TABLE projetos ADD COLUMN fase_comercial TEXT CHECK (
  fase_comercial IS NULL OR fase_comercial IN (
    'levantamento', 'proposta_em_elaboracao', 'proposta_enviada',
    'aguardando_retorno', 'aprovada', 'perdida', 'preparacao',
    'em_andamento', 'concluida', 'cancelada'
  )
);
ALTER TABLE projeto_documentos ADD COLUMN esperado INTEGER NOT NULL DEFAULT 0 CHECK (esperado IN (0, 1));
ALTER TABLE projeto_documentos ADD COLUMN estado_documental TEXT CHECK (
  estado_documental IS NULL OR estado_documental IN (
    'pendente', 'pendente_emissao', 'aguardando_etapa', 'emitido',
    'recebido', 'anexado', 'nao_aplicavel'
  )
);
ALTER TABLE projeto_documentos ADD COLUMN prazo TEXT;

-- Additive to 0030. Existing work items and historical snapshots remain untouched.
CREATE TABLE bases_referencia(
 id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,tipo TEXT NOT NULL CHECK(tipo IN('VOIA','SINAPI','SICRO','PROPRIA','IMPORTADA','OUTRA')),
 descricao TEXT NOT NULL,origem TEXT NOT NULL,competencia TEXT NOT NULL,uf TEXT NOT NULL,data_referencia TEXT NOT NULL,versao TEXT NOT NULL,regime TEXT NOT NULL,observacoes TEXT NOT NULL,
 ativa INTEGER NOT NULL DEFAULT 1 CHECK(ativa IN(0,1)),criada_por INTEGER REFERENCES usuarios(id),criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,atualizada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(nome,tipo,competencia,uf,versao,regime)
);
CREATE TABLE bases_importacoes(
 id TEXT PRIMARY KEY,base_id INTEGER NOT NULL REFERENCES bases_referencia(id) ON DELETE RESTRICT,arquivo_nome TEXT NOT NULL,arquivo_hash TEXT NOT NULL,
 total INTEGER NOT NULL CHECK(total BETWEEN 1 AND 50000),lotes INTEGER NOT NULL CHECK(lotes BETWEEN 1 AND 1000),status TEXT NOT NULL CHECK(status IN('preparando','concluida','cancelada')),
 token TEXT,criada_por INTEGER NOT NULL REFERENCES usuarios(id),criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,concluida_em TEXT
);
CREATE UNIQUE INDEX idx_base_arquivo_importado ON bases_importacoes(base_id,arquivo_hash) WHERE status<>'cancelada';
CREATE UNIQUE INDEX idx_base_importacao_aberta ON bases_importacoes(base_id) WHERE status='preparando';
CREATE TABLE bases_importacao_lotes(
 importacao_id TEXT NOT NULL REFERENCES bases_importacoes(id) ON DELETE RESTRICT,sequencia INTEGER NOT NULL,hash TEXT NOT NULL,dados TEXT NOT NULL CHECK(json_valid(dados)),quantidade INTEGER NOT NULL,
 PRIMARY KEY(importacao_id,sequencia)
);
CREATE TABLE base_itens(
 id INTEGER PRIMARY KEY AUTOINCREMENT,base_id INTEGER NOT NULL REFERENCES bases_referencia(id) ON DELETE RESTRICT,importacao_id TEXT REFERENCES bases_importacoes(id) ON DELETE RESTRICT,
 codigo TEXT NOT NULL,descricao TEXT NOT NULL,unidade TEXT NOT NULL,preco_centavos INTEGER CHECK(preco_centavos IS NULL OR preco_centavos>=0),tipo TEXT NOT NULL CHECK(tipo IN('servico','composicao','insumo')),
 classificacao TEXT NOT NULL,grupo TEXT NOT NULL,categoria TEXT NOT NULL,subcategoria TEXT NOT NULL,tags TEXT NOT NULL,observacoes TEXT NOT NULL,busca TEXT NOT NULL,assinatura TEXT NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(base_id,codigo,tipo,classificacao)
);
CREATE INDEX idx_base_itens_filtros ON base_itens(base_id,grupo,unidade,id);
CREATE INDEX idx_bases_fonte ON bases_referencia(ativa,tipo,competencia,uf);
CREATE TRIGGER base_item_imutavel_update BEFORE UPDATE ON base_itens BEGIN SELECT RAISE(ABORT,'publique nova versão da base'); END;
CREATE TRIGGER base_item_imutavel_delete BEFORE DELETE ON base_itens BEGIN SELECT RAISE(ABORT,'inative a base; preserve as referências'); END;
ALTER TABLE voia_biblioteca_servicos ADD COLUMN busca_normalizada TEXT NOT NULL DEFAULT '';
ALTER TABLE voia_biblioteca_servicos ADD COLUMN atualizada_em TEXT;
-- New semantic services actually present in the supplied Skill example / official workbook.
INSERT INTO voia_biblioteca_servicos(codigo,nome,grupo,categoria,subcategoria,unidade,escopo,tags,observacoes,origem) VALUES
('REF-PINT-TETO','Pintura de teto de gesso','01','Pintura','Ambientes internos','amb','Pintura do teto de gesso, com tratamento das manchas identificadas.','pintura teto gesso','Confirmar o ambiente e separar paredes quando não contratadas.','quantitativo-reforma.skill/references/exemplo_obra.json'),
('REF-JANELA-INF','Diagnóstico e correção de infiltração em janela','02','Civil','Recuperação','amb','Diagnóstico e correção da infiltração na janela, conforme verificação de vedação, peitoril e rejunte.','infiltração janela vedação','Não presumir a solução antes do diagnóstico.','quantitativo-reforma.skill/references/exemplo_obra.json'),
('REF-FORRO-MAN','Manutenção de forro de gesso','03','Forro','Manutenção','amb','Recuperação dos trechos do forro de gesso danificados.','forro gesso manutenção','Confirmar a origem do dano; pintura é serviço distinto.','quantitativo-reforma.skill/references/exemplo_obra.json'),
('REF-RUFO-VIDRO','Serviço de rufo em cobertura envidraçada','04','Cobertura','Rufos','amb','Serviço de rufo na extensão com cobertura de vidro.','rufo cobertura vidro','Prestador confirma medidas e se é instalação nova ou correção.','quantitativo-reforma.skill/references/exemplo_obra.json'),
('REF-LAMPADA','Troca de lâmpada e verificação do ponto','05','Elétrica','Iluminação','un','Troca da lâmpada e verificação do ponto existente.','lâmpada iluminação ponto','Se o defeito não for da lâmpada, confirmar o reparo adicional.','quantitativo-reforma.skill/references/exemplo_obra.json'),
('REF-ELET-ACAB','Revisão de acabamentos elétricos','05','Elétrica','Acabamentos','amb','Revisão de tomadas, interruptores e espelhos, com troca do que for necessário.','elétrica tomada interruptor espelho','Confirmar peças e ambiente.','quantitativo-reforma.skill/references/exemplo_obra.json'),
('REF-ELET-INSPEC','Inspeção elétrica geral','05','Elétrica','Revisão geral','vb','Verificação geral da instalação elétrica para identificar defeitos.','elétrica inspeção diagnóstico','Cotar preço fechado ou inspeção; reparos adicionais dependem de confirmação.','quantitativo-reforma.skill/references/exemplo_obra.json'),
('REF-GUARNICAO','Troca de guarnição de porta','08','Esquadrias','Guarnições','un','Troca de alisar/guarnição da porta identificada.','alisar portal guarnição porta','Confirmar portas, peças e origem de umidade quando existente.','quantitativo-reforma.skill/references/exemplo_obra.json'),
('REF-PINT-EXT','Pintura geral externa','01','Pintura','Área externa','amb','Pintura geral externa com tratamento de fissuras, lixamento e correções necessárias.','pintura fachada muro portão','Confirmar quais fachadas, muros, marquises, rufos e portões pertencem ao escopo.','002_Quantitativo.xlsx; 002_Solicitacao_Proposta_Mao_de_Obra_Q32_L10.pdf');

UPDATE voia_biblioteca_servicos SET busca_normalizada=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(codigo||' '||nome||' '||descricao||' '||escopo||' '||categoria||' '||subcategoria||' '||tags),'á','a'),'à','a'),'â','a'),'ã','a'),'ä','a'),'Á','a'),'À','a'),'Â','a'),'Ã','a'),'Ä','a'),'é','e'),'è','e'),'ê','e'),'ë','e'),'É','e'),'È','e'),'Ê','e'),'Ë','e'),'í','i'),'ì','i'),'î','i'),'ï','i'),'Í','i'),'Ì','i'),'Î','i'),'Ï','i'),'ó','o'),'ò','o'),'ô','o'),'õ','o'),'ö','o'),'Ó','o'),'Ò','o'),'Ô','o'),'Õ','o'),'Ö','o'),'ú','u'),'ù','u'),'û','u'),'ü','u'),'Ú','u'),'Ù','u'),'Û','u'),'Ü','u'),'ç','c'),'Ç','c');

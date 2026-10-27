-- Fundação de quantitativos. Nenhuma alteração nas tabelas existentes.
-- Serviços globais não contêm quantidades, ambientes nem preços de obras reais.
CREATE TABLE voia_planilha_modelos (
 id TEXT PRIMARY KEY, nome TEXT NOT NULL, tipo TEXT NOT NULL, configuracao TEXT NOT NULL CHECK(json_valid(configuracao)), ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN(0,1))
);
CREATE TABLE voia_biblioteca_servicos (
 id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT NOT NULL UNIQUE, nome TEXT NOT NULL,
 grupo TEXT NOT NULL, categoria TEXT NOT NULL DEFAULT '', subcategoria TEXT NOT NULL DEFAULT '',
 unidade TEXT NOT NULL DEFAULT '', descricao TEXT NOT NULL DEFAULT '', escopo TEXT NOT NULL DEFAULT '',
 tags TEXT NOT NULL DEFAULT '', observacoes TEXT NOT NULL DEFAULT '', origem TEXT NOT NULL,
 ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN(0,1)), criada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
 criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE obra_planilhas (
 id INTEGER PRIMARY KEY AUTOINCREMENT, obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE RESTRICT,
 nome TEXT NOT NULL, tipo TEXT NOT NULL CHECK(tipo IN('livre','reforma')), descricao TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN('rascunho','em_revisao','aprovada','arquivada')),
 somente_mao_de_obra INTEGER CHECK(somente_mao_de_obra IN(0,1)), versao INTEGER NOT NULL DEFAULT 1 CHECK(versao>0),
 operacao TEXT NOT NULL, criada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
 criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_planilhas_obra ON obra_planilhas(obra_id,atualizada_em);
CREATE TABLE obra_planilha_grupos (
 planilha_id INTEGER NOT NULL REFERENCES obra_planilhas(id) ON DELETE RESTRICT, codigo TEXT NOT NULL, nome TEXT NOT NULL, ordem INTEGER NOT NULL,
 PRIMARY KEY(planilha_id,codigo)
);
CREATE TABLE obra_planilha_itens (
 id TEXT PRIMARY KEY, planilha_id INTEGER NOT NULL REFERENCES obra_planilhas(id) ON DELETE RESTRICT,
 codigo TEXT NOT NULL, grupo TEXT NOT NULL, ordem INTEGER NOT NULL, ativo INTEGER NOT NULL CHECK(ativo IN(0,1)),
 biblioteca_id INTEGER REFERENCES voia_biblioteca_servicos(id) ON DELETE RESTRICT,
 quantidade REAL CHECK(quantidade IS NULL OR quantidade>=0), valor_unit_centavos INTEGER CHECK(valor_unit_centavos IS NULL OR valor_unit_centavos>=0),
 memoria TEXT NOT NULL, dados TEXT NOT NULL CHECK(json_valid(dados)), UNIQUE(planilha_id,codigo)
);
CREATE INDEX idx_planilha_itens_ordem ON obra_planilha_itens(planilha_id,ativo,ordem);
CREATE TRIGGER planilha_item_identidade_insert BEFORE INSERT ON obra_planilha_itens
WHEN EXISTS(SELECT 1 FROM obra_planilha_itens WHERE id=NEW.id AND (planilha_id<>NEW.planilha_id OR codigo<>NEW.codigo))
BEGIN SELECT RAISE(ABORT,'identidade de item imutável'); END;
CREATE TRIGGER planilha_item_identidade_update BEFORE UPDATE OF id,planilha_id,codigo,grupo ON obra_planilha_itens
WHEN NEW.id<>OLD.id OR NEW.planilha_id<>OLD.planilha_id OR NEW.codigo<>OLD.codigo OR NEW.grupo<>OLD.grupo
BEGIN SELECT RAISE(ABORT,'identidade de item imutável'); END;
-- Deleted items remain inactive: codes and identities cannot be recycled.
CREATE TABLE obra_planilha_snapshots (
 id TEXT PRIMARY KEY, planilha_id INTEGER NOT NULL REFERENCES obra_planilhas(id) ON DELETE RESTRICT,
 versao INTEGER NOT NULL, finalidade TEXT NOT NULL, dados TEXT NOT NULL CHECK(json_valid(dados)),
 criada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL, criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_planilha_snapshots ON obra_planilha_snapshots(planilha_id,criada_em);
CREATE TRIGGER planilha_snapshot_imutavel_update BEFORE UPDATE ON obra_planilha_snapshots BEGIN SELECT RAISE(ABORT,'snapshot imutável'); END;
CREATE TRIGGER planilha_snapshot_imutavel_delete BEFORE DELETE ON obra_planilha_snapshots BEGIN SELECT RAISE(ABORT,'snapshot imutável'); END;
INSERT INTO voia_planilha_modelos(id,nome,tipo,configuracao) VALUES('reforma-voia-v1','Quantitativo de reforma VOIA','reforma','{"versao":1,"origem":"quantitativo-reforma.skill","etapas":[["01","Pintura"],["02","Civil / calçadas / muros"],["03","Forro / gesso"],["04","Cobertura / rufos / marquises"],["05","Instalações elétricas"],["06","Telecomunicações"],["07","Hidráulica / metais"],["08","Esquadrias / serralheria / ferragens"],["09","Marcenaria"],["10","Acabamentos"],["11","Limpeza"],["12","Climatização"]]}');
-- Deliberate generic technical templates grounded in the supplied methodology.
-- No client, room, dimensions, quantities or invented prices are seeded.
INSERT INTO voia_biblioteca_servicos(codigo,nome,grupo,categoria,subcategoria,unidade,escopo,tags,observacoes,origem) VALUES
('REF-PINT-AMB','Pintura geral por ambiente','01','Pintura','Ambientes internos','amb','Pintura de paredes e teto do ambiente selecionado, com tratamento de fissuras, lixamento e correções necessárias.','pintura paredes teto','Confirmar ambientes, condições existentes e regime de contratação. Não acrescentar fator de perda à mão de obra.','quantitativo-reforma.skill; 002_Quantitativo.xlsx'),
('REF-INFILTR','Diagnóstico da origem das infiltrações','02','Civil','Recuperação','vb','Inspeção técnica para identificar a origem das infiltrações.','infiltração diagnóstico','Levantar pontos e origem provável. Definir escopo após inspeção; não presumir impermeabilização como solução.','quantitativo-reforma.skill; 002_Quantitativo.xlsx'),
('REF-ELET-AMB','Elétrica geral por ambiente','05','Elétrica','Revisão geral','amb','Revisão de tomadas, interruptores, pontos e circuitos do ambiente selecionado.','elétrica tomadas circuitos','Confirmar pontos e escopo em vistoria.','quantitativo-reforma.skill; 002_Quantitativo.xlsx'),
('REF-HIDR-AMB','Hidráulica geral por ambiente','07','Hidráulica','Revisão de acabamentos','amb','Revisão dos acabamentos hidráulicos do ambiente selecionado.','hidráulica metais','Confirmar peças e intervenções necessárias em vistoria.','quantitativo-reforma.skill; 002_Quantitativo.xlsx'),
('REF-PORTAS','Revisão de portas e guarnições','08','Esquadrias','Portas','amb','Revisão, ajustes de portas e guarnições e pintura das folhas conforme escopo confirmado.','portas alisar portal guarnição','Alisar/portal corresponde à guarnição. Confirmar portas existentes.','quantitativo-reforma.skill; 002_Quantitativo.xlsx'),
('REF-CAS-INST','Instalação de ar-condicionado cassete','12','Climatização','Ar-condicionado','un','Instalação do equipamento e tubulação frigorígena, conforme projeto e vistoria.','cassete climatização','Elétrica exclusiva pertence à etapa 05; dreno à etapa 07. Não presumir trajetos ou capacidades.','quantitativo-reforma.skill; 002_Quantitativo.xlsx'),
('REF-CAS-ELET','Elétrica do ar-condicionado cassete','05','Elétrica','Climatização','un','Circuito elétrico exclusivo do quadro ao equipamento, conforme dimensionamento confirmado.','cassete elétrica','Confirmar trajeto, capacidade e dimensionamento.','quantitativo-reforma.skill; 002_Quantitativo.xlsx'),
('REF-CAS-DRENO','Dreno do ar-condicionado cassete','07','Hidráulica','Climatização','un','Execução do dreno até ponto de descarte confirmado.','cassete dreno','Confirmar trajeto e ponto de descarte.','quantitativo-reforma.skill; 002_Quantitativo.xlsx');
INSERT INTO voia_biblioteca_servicos(codigo,nome,grupo,categoria,subcategoria,unidade,escopo,tags,observacoes,origem) VALUES
('REF-PINT-CALC','Pintura de calçada','01','Pintura','Piso externo','m²','Pintura dos trechos de calçada levantados em vistoria.','pintura piso calçada','Registrar as medidas e a memória de cálculo; prestador informa sistema de tinta e demãos.','002_Quantitativo.xlsx'),
('REF-CAIMENTO','Correção de caimento de calçada','02','Civil','Calçadas','amb','Correção do caimento conforme diagnóstico e escopo confirmado.','calçada escoamento','Verificar área, pontos de escoamento e empoçamentos antes de definir a solução.','002_Quantitativo.xlsx'),
('REF-BALDRAME','Viga baldrame de muro','02','Civil','Muros','m','Execução de viga baldrame conforme especificação e dimensões confirmadas.','muro baldrame','Não presumir seção, dimensões ou solução estrutural.','002_Quantitativo.xlsx'),
('REF-ALVENARIA','Alvenaria de muro','02','Civil','Muros','m²','Execução de alvenaria conforme levantamento e especificação confirmados.','alvenaria muro','Registrar comprimento, altura e critérios de medição.','002_Quantitativo.xlsx'),
('REF-DRYWALL','Rebaixo de forro em drywall','03','Forro','Rebaixamento','m²','Execução de rebaixo em drywall conforme dimensões, recortes e arremates confirmados.','forro drywall cassete','Drywall e gesso convencional são soluções distintas; confirmar antes da contratação.','quantitativo-reforma.skill; 002_Quantitativo.xlsx'),
('REF-FORRO-MIN','Substituição de placas de forro mineral','03','Forro','Forro mineral','un','Substituição das placas danificadas identificadas em vistoria.','forro mineral placas','Confirmar quantidade, dimensões e origem da infiltração.','002_Quantitativo.xlsx'),
('REF-GESSO','Correção de acabamento de gesso do cortineiro','03','Forro','Arremates','amb','Correção do acabamento do cortineiro no ambiente selecionado.','gesso cortineiro','Confirmar material, extensão e condições existentes.','002_Quantitativo.xlsx'),
('REF-RUFOS','Revisão de rufos','04','Cobertura','Rufos','amb','Revisão dos rufos e diagnóstico dos vazamentos identificados.','rufo vazamento','Inspecionar comprimento, material e pontos de vazamento; não presumir solução.','quantitativo-reforma.skill; 002_Quantitativo.xlsx'),
('REF-MARQUISE','Manutenção de marquises','04','Cobertura','Marquises','amb','Inspeção e manutenção conforme escopo confirmado.','marquise manutenção','Levantar quantidade, dimensões e problemas. Evitar sobreposição com pintura externa.','002_Quantitativo.xlsx'),
('REF-TELHADO','Revisão geral do telhado','04','Cobertura','Telhado','vb','Inspeção do telhado e revisão conforme diagnóstico confirmado.','telhado vazamento calha','Verificar telhas, cumeeiras, calhas e vedações; discriminar adicionais após inspeção.','002_Quantitativo.xlsx'),
('REF-QUADRO','Revisão do quadro geral','05','Elétrica','Quadro geral','un','Revisão técnica do quadro de distribuição.','quadro distribuição disjuntores','Confirmar condições, circuitos, proteções e intervenções em vistoria.','002_Quantitativo.xlsx'),
('REF-LED','Instalação de fita LED na sanca','05','Elétrica','Iluminação','m','Instalação de fita LED conforme extensão e especificações confirmadas.','led iluminação sanca','Confirmar retirada de luminária, driver/fonte e acionamento.','002_Quantitativo.xlsx'),
('REF-INTERNET','Ponto de internet','06','Telecomunicações','Rede de dados','pt','Passagem de cabo e instalação do ponto de rede conforme trajeto confirmado.','internet rede rj45','Confirmar origem, destino e percurso.','002_Quantitativo.xlsx'),
('REF-SOLDA','Revisão de solda em portão','08','Serralheria','Portões','un','Revisão de solda no portão identificado em vistoria.','portão solda','Confirmar portão e pontos a recuperar; não duplicar pintura geral.','002_Quantitativo.xlsx'),
('REF-PRATELEIRA','Instalação de prateleira','09','Marcenaria','Mobiliário fixo','m','Instalação de prateleira conforme medidas e modelo confirmados.','prateleira suporte','Confirmar material, comprimento e tipo de fixação.','002_Quantitativo.xlsx'),
('REF-PUXADORES','Instalação de puxadores de móveis','09','Marcenaria','Ferragens','vb','Instalação dos puxadores nos móveis identificados.','puxadores ferragens','Confirmar peças e escopo antes de cotar.','002_Quantitativo.xlsx'),
('REF-PAPEL','Substituição de papel de parede','10','Acabamentos','Revestimento de parede','amb','Verificar revestimento existente, remover, preparar a parede e aplicar o novo conforme escopo confirmado.','papel parede revestimento','Solicitar vistoria especializada e medidas das paredes pertinentes.','002_Quantitativo.xlsx'),
('REF-CAIXA','Limpeza de reservatório de água','11','Limpeza','Reservatórios','vb','Limpeza e higienização dos reservatórios identificados.','caixa água reservatório','Confirmar quantidade, capacidade e condições de acesso.','002_Quantitativo.xlsx'),
('REF-SOLAR','Limpeza de placas solares','11','Limpeza','Energia solar','conj','Limpeza das placas solares conforme condições confirmadas.','placa solar limpeza','Confirmar quantidade e condições de acesso.','002_Quantitativo.xlsx'),
('REF-LUSTRE','Limpeza de lustre','11','Limpeza','Luminárias','un','Limpeza do lustre identificado.','lustre luminária limpeza','Confirmar peça, acesso e cuidados necessários. Não substitui limpeza do próprio serviço.','002_Quantitativo.xlsx');

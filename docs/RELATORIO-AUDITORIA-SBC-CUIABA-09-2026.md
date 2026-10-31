# Auditoria SBC Cuiabá/MT 09/2026

Auditoria exclusivamente local em 30/10/2026. **200 composições + 200 insumos = 400 referências distintas do conjunto fornecido. Extração integral do conteúdo tabular dos PDFs conferida por dois mecanismos; isso não comprova completude do catálogo SBC.** Não foi implementada importação, criada base ou migration, acessado D1 remoto, feito deploy, commit ou push.

## 1. Estado do repositório

Pasta `C:\Users\Bruna Braz Garcia\Downloads\voia-app-visual-v2\voia-app`; branch `claude-modelos-processos-v2`; commit `82e8ad8 integra SICRO MT 07-2026 com custos tipados`. Working tree inicialmente limpo. Migrations locais 0001–0033, última `0033_sicro_custos.sql`. O estado de produção informado pela usuária é Worker `voia-app`, Version ID `d32667d1-b68e-4694-8647-3d837be7f12c`, SINAPI 15.477, SICRO 9.017/18.495 custos e Biblioteca 37. Nesta auditoria não houve consulta ou alteração remota; não apresentar esses números como uma nova medição de produção.

## 2. Arquivos localizados e hashes

Localizados os dois candidatos SBC na raiz de Downloads. Busca por nomes SBC no projeto e nos arquivos locais de referência não encontrou outro par. Não houve varredura indiscriminada de todo o disco. O nome `ISUMOS` do arquivo é preservado como está; o título interno correto é “Insumos”.

- `C:\Users\Bruna Braz Garcia\Downloads\Informativo SBC _ O melhor banco de composições analíticas COMPOSIÇÕES.pdf`
  - 395,218 bytes; 4 páginas PDF.
  - SHA-256: `5431a82bf9cc76a98272e141e667600c2b3d3e37a10a408abab7a6ad28a32636`.

- `C:\Users\Bruna Braz Garcia\Downloads\Informativo SBC _ O melhor banco de composições analíticas ISUMOS.pdf`
  - 396,360 bytes; 4 páginas PDF.
  - SHA-256: `71a0cf4fc26db2f7786fda092952c96cc5e24a597b6cc5e323aa7f2eb6e414fa`.

Os arquivos originais foram apenas lidos. Scripts, extrações JSON/texto e imagens locais estão em `.wrangler/auditoria-sbc/`, ignorada pelo Git; nenhum PDF grande foi copiado para arquivos versionados. Não foi criado script permanente no repositório.

## 3. Identidade documental

O logo renderizado é “Informativo SBC”; o título de metadados é “Informativo SBC | O melhor banco de composições analíticas”. Os títulos internos dos relatórios são **Composições** e **Insumos**. O conteúdo tabular é sintético, não memória analítica de coeficientes/componentes. A marca/título identificam a fonte declarada SBC, mas não provam que o arquivo é um catálogo integral ou uma distribuição oficial assinada.

Cabeçalho de ambos, na primeira página: **Região CBA - Cuiabá - MT** e **Data de Atualização 01/09/2026**. Cidade Cuiabá, UF MT, identificador regional CBA. Não há versão/edição oficial adicional ou regime desonerado/não desonerado declarado. Não transplantar conceitos SINAPI ou SICRO para esses preços.

Metadados indicam impressão pelo Chrome 156, produtor Skia/PDF m156 e criação em 28/10/2026: 13:47:13 UTC (composições) e 13:47:31 UTC (insumos). A criação do PDF não substitui a data de atualização comercial dos registros.

## 4. Competência recomendada

Usar **09/2026**, derivada do mês/ano da atualização explicitamente impressa **01/09/2026**. Preservar também essa data completa e o texto regional original. É competência de referência normalizada pelo VOIA, não afirmação de uma edição mensal completa publicada pelo SBC. A impressão em outubro não justifica trocar para 10/2026.

## 5. Estrutura e paginação

| Documento | Páginas físicas | Registros por página | Cabeçalhos de tabela | Encerramento |
|---|---:|---|---|---|
| Composições | 4 | 64 / 69 / 67 / 0 | páginas 1–3 | “Listados 200 composições” na p. 3; só “Página 1” na p. 4 |
| Insumos | 4 | 63 / 63 / 60 / 14 | páginas 1–4 | “Listados 200 insumos” e “Página 1” na p. 4 |

Colunas reais: **Código, Descrição, Unidade, Preço Unit.** Não há colunas de grupo/categoria, coeficiente, composição analítica, quantidade, custo produtivo/improdutivo, regime fiscal ou moeda declarada no cabeçalho. Os códigos são strings numéricas com comprimento variável e não devem receber padding ou conversão para número.

A tabela tende à ordenação alfabética por descrição após alguns registros iniciais fora dessa ordem: composições começam por bancada/barra/disjuntor/leitos antes de EPI e dos itens A; insumos começam por um kit fixador antes das abraçadeiras. Não há ordenação numérica global dos códigos, intervalos completos ou sequência que demonstre cobertura do catálogo. Não interpretar a ordem inicial como seleção explicitamente confirmada: o PDF não explica sua razão.

## 6. Completude: conclusão principal

Ambos imprimem **Filtro CONTÉM**, **Palavra Chave** sem valor visível, **Listados 200** e **Página 1**. Não há total geral de resultados, quantidade de páginas da consulta, marcador “todos”, intervalo completo ou comprovação de ausência de limite. A abrangência textual fica nos primeiros blocos alfabéticos até ADAPTADOR; vários termos solicitados não aparecem. São indícios fortes de uma página/exportação limitada da consulta, não prova de um catálogo integral.

**Só é defensável afirmar:** “Estes PDFs representam um conjunto/exportação de registros SBC Cuiabá atualizado em 01/09/2026”. Não é defensável chamar de “base SBC completa”, nem extrapolar os 200 itens de cada relatório para o total do fornecedor. O parser recuperou completamente a tabela presente nos documentos, não registros fora desses documentos.

Nome recomendado para futura integração: **SBC · Cuiabá/MT · 09/2026 · Relatório importado**. A descrição da base deve dizer “200 composições + 200 insumos fornecidos em dois PDFs; completude do catálogo não comprovada”. Pedir novos relatórios/páginas ou exportação estruturada ao fornecedor, se o objetivo passar a ser catálogo completo; isso não impede avaliar a importação do recorte declarado.

## 7. Parser local e extração

Primeiro mecanismo: **pdfplumber/pdfminer**, usando posições dos caracteres e colunas efetivamente observadas, âncoras de código e bandas de registro. As colunas dos dois PDFs têm larguras diferentes. Agrupa linhas da mesma descrição sem reescrever o texto, preservando quebras, capitalização, abreviações, números e caracteres especiais. Preços guardados como texto original e decimal textual exato; Decimal é usado apenas para estatística. Não foi usado OCR.

Por registro foram extraídos código, descrição oficial, unidade, preço original, valor decimal, tipo segundo o título do relatório, região, atualização e página física de origem. Não se inventaram moeda, categoria, grupo ou regime. Cada linha/célula vem do documento concreto; espaços externos de célula são tratados como separadores, mantendo o conteúdo interno.

## 8. Volumetria completa

“Linhas brutas de texto” abaixo significa linhas não vazias de `pdfplumber.extract_text()`, incluindo cabeçalhos/rodapés; é uma medida de extração, não quantidade de itens. “Linhas de descrição” conta as linhas físicas dentro das células de descrição. Não somar palavras, cabeçalhos ou quebras como registros.

| Medida | Composições | Insumos |
|---|---:|---:|
| Linhas brutas de texto | 210 | 251 |
| Faixas/candidatos de registro | 200 | 200 |
| Registros válidos | 200 | 200 |
| Códigos únicos | 200 | 200 |
| Códigos repetidos | 0 | 0 |
| Sem preço | 0 | 0 |
| Preço zero | 0 | 0 |
| Preço negativo | 0 | 0 |
| Sem unidade | 0 | 0 |
| Sem descrição | 0 | 0 |
| Registros não interpretados | 0 | 0 |
| Descrições em várias linhas | 0 | 16 |
| Linhas físicas de descrição | 200 | 217 |

**400 referências potenciais**, sem interseção de códigos entre os tipos nestes arquivos. Se futuramente aprovadas, seriam 24.894 referências combinadas SINAPI+SICRO+SBC e 37 serviços VOIA, sem misturar suas identidades. Esses totais combinados são projeção sobre o estado informado, não leitura nova do D1.

## 9. Preços: formato, limites e precisão

Formato brasileiro: ponto para milhares, vírgula decimal, exatamente **duas casas decimais em todos os 400 preços**. Não há ausência, zero ou negativo neste conjunto; o futuro parser ainda deve distinguir NULL de zero e rejeitar preço ilegível, nunca preencher por inferência. Não foi encontrado código com mais de um preço dentro do seu tipo. Não foram encontrados deslocamentos de preço após a conferência independente.

| Tipo | Menor positivo | Código | Maior preço | Código |
|---|---:|---|---:|---|
| Composição | 0,63 | 20011 | 8.813,04 | 56292 |
| Insumo | 0,43 | 49203 | 4.670,00 | 20082 |

Os cabeçalhos/documentos extraídos não explicitam “R$” ou uma coluna de moeda. O padrão numérico e a região são brasileiros, mas não afirmar moeda como um campo impresso. Confirmar a interpretação BRL na próxima rodada, pois o VOIA representa os valores monetários em BRL. Também não inferir BDI, tributos, inclusão de mão de obra ou regimes a partir do nome “Preço Unit.”.

Como todos os preços têm duas casas, `preco_centavos` existente comporta a precisão publicada **exatamente**, mediante conversão decimal textual/inteira; não há necessidade de arredondamento nem da estrutura de custos SICRO. Preservar paralelamente a string `preco_original` para rastreabilidade.

## 10. Duplicidades e identidade

Zero códigos repetidos dentro de cada relatório, zero códigos presentes nos dois tipos e zero casos de mesmo código com preços distintos. Há duas descrições repetidas nas composições, com códigos diferentes:

| Descrição literal | Código | Preço | Página |
|---|---|---:|---:|
| LEITO PARA CABOS TIPO PESADO 900x100mm C/FIXACAO/EMENDA S/T | 63641 | 584,45 | 1 |
| LEITO PARA CABOS TIPO PESADO 900x100mm C/FIXACAO/EMENDA S/T | 65112 | 584,45 | 1 |
| ACABAMENTO PARA VALVULA DE DESCARGA BENEFIT 00184906 DOCOL | 23610 | 738,99 | 2 |
| ACABAMENTO PARA VALVULA DE DESCARGA BENEFIT 00184906 DOCOL | 190874 | 732,50 | 2 |
| ACABAMENTO PARA VALVULA DE DESCARGA BENEFIT 00184906 DOCOL | 202164 | 732,86 | 2 |

Entre Composição e Insumo, **5 descrições literais** coincidem, com códigos/preços próprios:
- ABRACADEIRA PARA CONDUTOR DE PVC: composicao 53149 = 21,30; insumo 3547 = 12,90.
- ABRACADEIRA PERFIL COM PARAFUSO 3.1/2": composicao 78388 = 4,53; insumo 10133 = 3,67.
- ABRACADEIRA PVC 1" CINZA CLARO CEMAR: composicao 78116 = 4,24; insumo 66469 = 3,81.
- ACABAMENTO PARA VALVULA DE DESCARGA BENEFIT 00184906 DOCOL: composicao 23610 = 738,99; composicao 190874 = 732,50; composicao 202164 = 732,86; insumo 65246 = 683,47.
- ACIONADOR MANUAL ENDERECAVEL AME 520 INTELBRAS: composicao 58610 = 228,07; insumo 203018 = 198,61.

Não deduplicar por descrição, preço ou semelhança textual. Identidade recomendada: **fonte SBC + região CBA/Cuiabá/MT + competência + edição técnica do conjunto + tipo + código**. Região precisa distinguir outras cidades da mesma UF. Na identidade de item atual, `base_id + codigo + tipo + classificacao` suporta isso se a base representar corretamente o conjunto/edição e classificação ficar vazia quando não informada.

## 11. Anomalias literais que devem ser preservadas

Quatro descrições de composição começam com números. A concatenação linear do PDF engana um regex de código inicial:

| Código real na coluna | Descrição literal | Código falso que um parser ingênuo poderia produzir |
|---|---|---|
| 67104 | 14201SENSOR INFRAVERM SEMI EXTERNO PET 30KG DUAL TEC-550 JFL | 6710414201 |
| 100200 | 1TELHA TRAPEZOIDAL CONFORT TERMICA SEMI-SANDUICHE PIR20mm 7m | 1002001 |
| 57590 | 20MURO GABIAO, ENCHIMENTO PEDRA DE MAO, H= 6,00m GAIOLA 2x1m | 5759020 |
| 61209 | 7825CONDULETE ALUMINIO "LL" 1/2" SEM TAMPA | 612097825 |

Esses prefixos estão também no layout renderizado; não foram transferidos para o código ou removidos da descrição. Uma unidade de insumo é **UNN**, código **20677**, página 1, preço **1,50**. Deve permanecer UNN, não ser “corrigida” automaticamente para UN. Aspas, apóstrofos, Ø, ”, maiúsculas e abreviações originais também são dados da fonte. Se for desejada uma normalização futura, conservar o original e exigir decisão explícita, não fazê-la nesta auditoria.

## 12. Amostras distribuídas e termos solicitados

Todas as amostras são região **CBA - Cuiabá - MT**, atualização **01/09/2026**, competência normalizada proposta **09/2026**. A coluna preço reproduz o PDF, sem afirmar uma moeda não impressa. `<br>` abaixo apenas representa a quebra de linha original.

| Tipo | Código | Descrição oficial | Unidade | Preço | Página |
|---|---|---|---|---:|---:|
| composicao | 190243 | BANCADA ACO INOX GHEL PLUS 1,20x0,53cm 1 CUBA + METAIS | UN | 3.372,64 | 1 |
| composicao | 67104 | 14201SENSOR INFRAVERM SEMI EXTERNO PET 30KG DUAL TEC-550 JFL | UN | 175,54 | 1 |
| composicao | 100200 | 1TELHA TRAPEZOIDAL CONFORT TERMICA SEMI-SANDUICHE PIR20mm 7m | M2 | 180,31 | 1 |
| composicao | 22627 | ABERTURA MECAN. VAOS PORTAS/JANELAS - ESTRU. CONCRETO ARMADO | M3 | 218,67 | 1 |
| composicao | 53042 | ABERTURA E FECHAMENTO DE RASGOS EM ALVENARIA | M | 19,82 | 1 |
| composicao | 20011 | ABERTURA DE RUAS COM UTILIZACAO TRATOR D6N ESTEIRA COM LAMINA | M3 | 0,63 | 1 |
| composicao | 56292 | ABRIGO ALVENARIA BLOCO CONCR P/ 4 BOTIJOES DE 45 KG | UN | 8.813,04 | 2 |
| composicao | 23610 | ACABAMENTO PARA VALVULA DE DESCARGA BENEFIT 00184906 DOCOL | UN | 738,99 | 2 |
| composicao | 30091 | ACO CA-50 8,0mm P/CINTAS/VIGAS/BALDRAME CORTE/DOBRA EM FORMA | KG | 14,18 | 3 |
| composicao | 53421 | ADAPTADOR PVC SAIDA VASO SANITARIO DN 100mm | UN | 126,34 | 3 |
| insumo | 22134 | KIT FIXADOR DE GRADIL C/ PARAFUSO AUTO BROCANTE INOX | UN | 266,61 | 1 |
| insumo | 20677 | ABRACADEIRA ACO P/ ELETRODUTO TIPO "D" C/ CUNHA 3/4" | UNN | 1,50 | 1 |
| insumo | 25843 | ACESSIBILIDADE - ALARME AUDIOVISUAL WIFI PARA BANHEIRO PCD COM BOTOEIRA, MODELO 0498<br>LEVEVIDA | UN | 450,00 | 2 |
| insumo | 43721 | ACESSIBILIDADE - PEDESTAL EM ACO CARBONO COM PINTURA ESMALTE SINTETICO PARA MAPA TATIL<br>40x80cm | UN | 630,00 | 2 |
| insumo | 49203 | ABRACADEIRA TIPO UNHA 3/4" | UN | 0,43 | 2 |
| insumo | 28090 | ACIONADOR DE FECHADURA ELETRICA 12V POR CONTROLE REMOTO AGL | UN | 87,04 | 3 |
| insumo | 20082 | ACESSIBILIDADE - POLTRONA ESIBIRE ESPECIAL PARA OBESOS - AUDITORIO NBR 9050 | UN | 4.670,00 | 3 |
| insumo | 57 | ADAPTADOR CAIXA CONCRETO 200mm GALVANIZADO 2" | UN | 112,53 | 3 |
| insumo | 37412 | ADAPTADOR DE SAIDA PARA VASO SANITARIO 100mm TIGRE | UN | 85,69 | 4 |

Contagem por ocorrência literal do termo na descrição, ignorando acentos/caixa; não é classificação técnica nem busca semântica:

| Termo | Composições | Insumos |
|---|---:|---:|
| concreto | 7 | 3 |
| pintura | 0 | 1 |
| alvenaria | 4 | 0 |
| impermeabilização | 0 | 0 |
| elétrica | 0 | 1 |
| hidráulica | 0 | 0 |
| acessibilidade | 0 | 62 |
| cobertura | 0 | 0 |
| demolição | 0 | 0 |
| revestimento | 0 | 0 |

Pintura aparece somente dentro da descrição de um pedestal de acessibilidade; isso não fornece um serviço de pintura autônomo. “Elétrica” aparece no acionador de fechadura. Existem descrições de tubulações/registros e telha que podem estar relacionadas a hidráulica/cobertura, mas esses termos literais não constam e não foram adicionados como categoria. Não inventar resultados para os termos ausentes.

## 13. Riscos da origem PDF e inspeção visual

Texto estruturado extraível, não PDF escaneado. Renderizados e inspecionados: composição p. 1 (identidade/códigos com números na descrição), composição p. 3 (final da tabela e Listados 200), insumo p. 2 (descrições de duas/três linhas) e insumo p. 4 (final e Página 1). Todas as oito páginas foram lidas pelas duas extrações, incluindo a página de composição que contém só o rodapé.

16 descrições de insumos se distribuem em duas ou três linhas (217 linhas para 200 células de descrição). Não foram encontrados registros divididos entre páginas: cada registro tem código, unidade e preço na sua página em ambas as extrações; o resíduo fora dos registros consiste somente em cabeçalhos/rodapés. A quebra extra que deixa “Página 1” sozinha no quarto PDF de composições não é um registro perdido.

Os layouts dos dois relatórios têm limites de coluna distintos e o cabeçalho de preço dos insumos ocupa duas linhas. Um parser de texto corrido, corte fixo sem conferir layout, conversão automática do código a número ou remoção de caracteres “estranhos” pode produzir perda silenciosa. O auditor local está ajustado a estes hashes/layouts e não prova que PDFs futuros são compatíveis. Arquivos novos devem passar por reconhecimento de cabeçalho, rejeição de linhas incompletas e nova conferência independente.

## 14. Validação independente integral

Segundo mecanismo: **pypdf**, intérprete diferente de pdfminer. Lê as operações de texto do PDF via visitor, identifica os códigos pela posição da coluna e recompõe os campos pela sequência código/descrição/unidade/preço e linhas internas. Não reutiliza os registros nem os valores extraídos pelo parser principal para preencher campos. Alguns fragmentos de texto recebem posição zero no visitor do pypdf; nesses casos usa sua ordem no fluxo e o formato explícito de unidade/preço. Esse tratamento foi confrontado com a extração espacial e a renderização.

Comparação em todos os **400 registros**, campo a campo: código, descrição com quebras originais, unidade, preço textual e página. O tipo é validado pelo título de cada documento; os totais coincidem com o “Listados 200” de cada um. Não se confiou apenas em quantidade de linhas.

| Verificação | Composições | Insumos |
|---|---:|---:|
| Registros conferidos | 200 | 200 |
| Divergências de código | 0 | 0 |
| Divergências de preço | 0 | 0 |
| Divergências de descrição/unidade/página | 0 | 0 |
| Falsos NULL | 0 | 0 |
| Preços inventados | 0 | 0 |
| Fragmentos de dados não interpretados | 0 | 0 |
| Possíveis registros presentes no PDF e perdidos pela extração | 0 detectados | 0 detectados |

**Conclusão:** a extração deste recorte de 400 itens é suficientemente confiável para propor uma futura importação controlada, preservadas as anomalias literais. Não há validação de registros que não estejam nos PDFs, fidelidade à base interna do fornecedor ou completude do catálogo. Nenhuma linha foi eliminada ou corrigida para obter essas contagens.

## 15. Arquitetura atual: suporte de dados

Nomes reais: `bases_referencia`, `base_itens`, `bases_importacoes`, `bases_importacao_lotes`; não existe uma tabela `base_servicos` neste modelo. `base_itens` já suporta tipo composição/insumo, código, descrição, unidade, `preco_centavos` nullable e `metadados` JSON. Os preços observados cabem em centavos sem perda. Não usar os campos SINAPI de regimes nem os custos SICRO para simular SBC.

Os campos de base já preservam nome, origem, UF, competência, data_referencia e versão técnica. Cidade/região detalhada pode ser mantida em metadados de item e no nome da base, com UF MT separada. Não é necessário criar dezenas de colunas SBC nem uma tabela de custos de quatro casas para estes documentos. Data de atualização completa e página são dados de proveniência, não novos preços.

## 16. Restrição real de fonte SBC e migration

**SBC não está na enumeração atual.** A migration 0031 define `bases_referencia.tipo CHECK(tipo IN (VOIA,SINAPI,SICRO,PROPRIA,IMPORTADA,OUTRA))`. A 0033 não altera esse CHECK. `TIPOS_BASE`, schema do snapshot `tipo_base` e opções da busca também não incluem SBC. Portanto, tentar criar `tipo=SBC` diretamente hoje será rejeitado, mesmo que seus itens/preços caibam no modelo.

Duas estratégias possíveis, que não devem ser confundidas:

1. **Fonte SBC nativa, recomendada para o requisito “Fonte = SBC” consistente com SINAPI/SICRO:** planejar migration posterior para admitir SBC no contrato do banco e mudanças coordenadas dos enums/API/busca/snapshot. Não são necessárias mudanças nas colunas de preço ou na 0033. SQLite/D1 não permite simplesmente ampliar um CHECK via `ALTER COLUMN`: a estratégia de alteração/recriação ou extensão da modelagem precisa ser desenhada, ensaiada com backup e FKs/triggers preservados, antes de autorização. Não prometer uma migration puramente aditiva trivial para trocar o CHECK.

2. **Sem migration de banco:** cadastrar como `IMPORTADA`, declarar SBC em nome/origem e `metadados.fonte_declarada`, preservar tudo pelo modelo genérico. Isso representa honestamente um relatório importado, mas hoje aparece em “Outras”; para um filtro visual SBC é preciso um mapeamento explícito e validado no catálogo/snapshot, mantendo a distinção entre tipo de armazenamento IMPORTADA e fonte documental SBC. Não apenas renomear a opção ou disfarçar SBC como SINAPI/SICRO. Essa alternativa exige decisão de produto/arquitetura e alterações de código, mesmo sem migration.

**Resposta objetiva:** não é necessária migration para armazenar os 400 dados sob IMPORTADA; **para a integração nativa SBC recomendada, a restrição de fonte exige uma mudança de schema planejada**. Não foi criada nenhuma migration nesta auditoria. A estrutura 0033 não precisa ser usada nem alterada.

## 17. Importador específico versus genérico

O importador genérico atual lê XLSX, não PDF. Não é seguro colar a extração textual diretamente nele: perderia limites de código/descrição, linhas internas e proveniência. Recomendo **adaptador/extrator SBC específico para PDF**, com reconhecimento do layout, duas verificações independentes e preview, reutilizando os schemas, lotes, hashes, staging e finalização atômica existentes. Outra opção é conversão local validada a JSON/XLSX, desde que o adaptador também transporte os metadados: o mapeador XLSX atual não tem coluna genérica de metadados e não basta adicionar só código/descrição/unidade/preço.

Não transformar item SBC em Serviço VOIA. O tipo é herdado do relatório: `composicao` ou `insumo`. Categorias/grupos inexistentes permanecem vazios. Um único conjunto lógico para os dois PDFs, com rastreabilidade individual por item e por página. Preview deve declarar “400 itens do relatório fornecido”, não “base completa”. Nenhuma implementação dessa importação foi iniciada.

## 18. Proveniência e identidade técnica

Metadados propostos, todos compatíveis com o objeto plano atual: fonte_declarada=SBC, regiao_original=CBA - Cuiabá - MT, cidade=Cuiabá, uf=MT, atualizacao_original=01/09/2026, documento_nome, documento_sha256, pagina_pdf (1–4), preco_original, tipo_relatorio e método/versão técnica do extrator. `data_referencia` recebe a data completa em formato explicitamente acordado. `versao` obrigatório pode usar um identificador técnico do par de hashes, claramente distinto de edição oficial não informada.

Guardar o par original de PDFs sem duplicar fisicamente por item; um item referencia hash/nome/página. Nesta etapa os originais continuam em Downloads. Futuro armazenamento no R2 depende de decisão/autorização própria; não houve upload. Os metadados JSON e referências de arquivo devem ser considerados dados imutáveis de origem, não instruções executáveis.

## 19. Reimportação e deduplicação futura

Hash de manifesto ordenado com os dois arquivos e parâmetros região/competência/tipo de extrator permite reconhecer o mesmo conjunto. `bases_importacoes` já possui unicidade base+hash não cancelado; `base_itens` já protege código+tipo+classificação por base. Conteúdo divergente para identidade existente exige nova versão, nunca sobrescrita. Não deduplicar entre Composição/Insumo nem entre SBC/SINAPI/SICRO por descrição. Impedir duas bases da mesma edição lógica com nomes diferentes na estratégia SBC escolhida.

## 20. Busca proposta

Somente após decisão de fonte e autorização: Fonte SBC, tipo Composição/Insumo, UF MT, competência 09/2026 e região/cidade Cuiabá visível. Hoje o filtro “UF / região” compara o campo UF literalmente; digitar Cuiabá/MT não equivale a filtrar uf=MT. Serão necessários apresentação/mapeamento e eventual filtro de cidade/região explícitos, sem inventar que já existem. O nome recomendado já torna a cidade visível sem misturá-la ao campo UF.

Cada resultado mantém código, descrição, unidade, preço, fonte, região e competência próprios. “Concreto” pode retornar itens das três fontes sem fusão semântica. Preservar paginação no servidor, busca normalizada e autorização existentes; não carregar o catálogo completo no frontend. Somar 400 itens não justifica alterar a estratégia global de busca nesta auditoria.

## 21. Snapshot de planilha proposto

`referencia_origem` já guarda código, descrição, unidade, preço de referência, base/item, UF, competência, versão, origem, data e metadados; `itemDoCatalogo` copia essa referência separada de quantidade e `valor_unit_centavos` adotado. Cidade, região exata, PDF/hash/página e preço textual original seguem em metadados. Deve-se adequar o enum `tipo_base` caso SBC seja nativo, mantendo snapshots antigos válidos.

Uma nova seleção/edição de referência não pode alterar o preço adotado manualmente. A adoção de preço continua ação explícita, com confirmação de substituição quando aplicável. Nenhuma planilha, orçamento ou medição deve ser criada automaticamente por importar o catálogo.

## 22. Riscos e decisões antes da próxima rodada

- Completude não comprovada: não usar rótulo “base SBC completa”.
- Quatro descrições com prefixos numéricos exigem separação espacial do código.
- UNN e descrições repetidas com preços diferentes são dados originais, não erros a corrigir silenciosamente.
- Não há moeda explícita, regime ou composição analítica detalhada; não inferir esses campos.
- PDFs futuros podem mudar layout; auditor atual não é um parser universal.
- Fonte SBC nativa ainda não é aceita no banco/API/snapshot.
- Preview, identidade de edição e rastreabilidade devem ser aprovados antes de implementação.
- Comparação independente comprova fidelidade aos PDFs, não ao catálogo externo do fornecedor.

## 23. Proposta exata para a próxima rodada

1. Aprovar escopo de **relatório importado parcial** e nome `SBC · Cuiabá/MT · 09/2026 · Relatório importado`; confirmar interpretação BRL e preservação literal das anomalias.
2. Decidir fonte nativa SBC com migration planejada versus IMPORTADA com proveniência SBC explícita; não mexer em SINAPI/SICRO/0033.
3. Após autorização de implementação, criar adaptador PDF específico reutilizando staging, com preview, 400 itens, hashes/páginas e comparação integral independente; rejeitar layout/preço/código ambíguo.
4. Ensaiar em cópia local de backup atualizado: preservação, idempotência, busca por fonte/tipo/cidade/competência, snapshot e preço adotado independente, permissões e regressões das fontes atuais.
5. Submeter eventual migration e operação remota à autorização específica. Não importar, migrar ou publicar nesta etapa de auditoria.

## 24. Saúde do estado atual e alterações

Validação final: **243 testes Worker (27 arquivos) e 165 testes UI (16 arquivos), 408 aprovados**, incluindo os arquivos reais SINAPI/SICRO habilitados localmente. Build, typecheck e lint aprovados; avisos existentes de anotação Zod e tamanho de chunk, sem erros. UTF-8 estrito/mojibake: **259 arquivos, zero achados** em src/test/docs/migrations. `git diff --check` aprovado. Working tree final contém somente este relatório novo; HEAD e branch preservados.

Único arquivo novo versionável desta auditoria: `docs/RELATORIO-AUDITORIA-SBC-CUIABA-09-2026.md`. Código funcional, schema, regras de autorização, bases, dados e bindings não foram alterados. Scripts e evidências locais permanecem ignorados em `.wrangler`. Não houve produção, migration, deploy, commit ou push. **Ponto de parada respeitado: aguardar decisão sobre a próxima rodada.**

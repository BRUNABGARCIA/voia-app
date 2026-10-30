# Auditoria SICRO MT 07/2026

Auditoria local em 30/10/2026. Nenhum acesso remoto, importação, migration, deploy, commit ou push nesta rodada. Código funcional inalterado. Scripts e extração permanecem ignorados em `.wrangler/auditoria-sicro/`; não foi decidido versionar scripts.

## 1. Estado e pacote original

Repositório: `C:\Users\Bruna Braz Garcia\Downloads\voia-app-visual-v2\voia-app`. Branch `claude-modelos-processos-v2`, commit `c98d589 importa SINAPI MT 09-2026 e corrige parser de precos`. Working tree inicialmente limpo. Ao encerrar, apenas este relatório foi acrescentado ao Git.

Pacote encontrado: `C:\Users\Bruna Braz Garcia\Downloads\mt-07-2026.7z`, 26.165.793 bytes. SHA-256: `f3db08cf1934d658e9e0e94ebdec61085ffd0df9ddcac12572121b9ab05d2c2c`. Único `.7z` candidato na raiz de Downloads; nenhum pacote SICRO no projeto. Não se afirma busca exaustiva no disco. Extraído localmente com `tar`, sem modificar o original. A exibição de acentos do comando tar no terminal estava corrompida; os nomes e conteúdos extraídos, lidos em UTF-8, estão corretos.

## 2. Estrutura completa do arquivo

24 arquivos na raiz, sem subpastas: 12 PDF e 12 XLSX. Tamanhos descompactados abaixo.

| Arquivo | Bytes |
|---|---:|
| MT 07-2026 Relatório Analítico de Composições de Custos.pdf | 18637905 |
| MT 07-2026 Relatório Analítico de Composições de Custos.xlsx | 7736682 |
| MT 07-2026 Relatório Analítico de Encargos Sociais e Trabalhistas - com desoneração.pdf | 440886 |
| MT 07-2026 Relatório Analítico de Encargos Sociais e Trabalhistas - com desoneração.xlsx | 91359 |
| MT 07-2026 Relatório Analítico de Encargos Sociais e Trabalhistas.pdf | 441264 |
| MT 07-2026 Relatório Analítico de Encargos Sociais e Trabalhistas.xlsx | 91423 |
| MT 07-2026 Relatório Analítico de Mão de Obra - com desoneração.pdf | 2579411 |
| MT 07-2026 Relatório Analítico de Mão de Obra - com desoneração.xlsx | 570270 |
| MT 07-2026 Relatório Analítico de Mão de Obra.pdf | 2580350 |
| MT 07-2026 Relatório Analítico de Mão de Obra.xlsx | 569627 |
| MT 07-2026 Relatório Sintético de Composições de Custos.pdf | 696592 |
| MT 07-2026 Relatório Sintético de Composições de Custos.xlsx | 250957 |
| MT 07-2026 Relatório Sintético de Equipamentos - com desoneração.pdf | 185236 |
| MT 07-2026 Relatório Sintético de Equipamentos - com desoneração.xlsx | 58111 |
| MT 07-2026 Relatório Sintético de Equipamentos.pdf | 185072 |
| MT 07-2026 Relatório Sintético de Equipamentos.xlsx | 58152 |
| MT 07-2026 Relatório Sintético de Materiais.pdf | 234891 |
| MT 07-2026 Relatório Sintético de Materiais.xlsx | 77978 |
| MT 07-2026 Relatório Sintético de Mão de Obra - com desoneração.pdf | 83592 |
| MT 07-2026 Relatório Sintético de Mão de Obra - com desoneração.xlsx | 61951 |
| MT 07-2026 Relatório Sintético de Mão de Obra.pdf | 83620 |
| MT 07-2026 Relatório Sintético de Mão de Obra.xlsx | 61941 |
| MT 07-2026 Relatório Sintético de Origem de Preços do SICRO.pdf | 6532449 |
| MT 07-2026 Relatório Sintético de Origem de Preços do SICRO.xlsx | 328957 |

Total descompactado: 42,638,676 bytes. Não versionar os arquivos oficiais.

## 3. Localidade, competência e versão

Os cabeçalhos dos PDFs de composições, materiais, equipamentos, mão de obra e encargos confirmam **Mato Grosso — julho/2026**. O analítico XLSX repete Mato Grosso e Julho/2026 em todas as 6.619 composições. UF MT é a correspondência de Mato Grosso e aparece como coluna no relatório de origem. Não foi identificada data diária de publicação, município, versão de software ou revisão específica: não inventar esses dados. Usar competência `07/2026`; eventual identificador técnico de edição deve ser distinguido de uma versão oficial não informada.

## 4. Abas, dimensões e papel dos relatórios

| XLSX | Aba | Linhas × colunas | Papel |
|---|---|---:|---|
| MT 07-2026 Relatório Analítico de Composições de Custos.xlsx | Sheet1 | 210814 × 9 | Memória de cálculo e relações, não novos itens |
| MT 07-2026 Relatório Analítico de Encargos Sociais e Trabalhistas - com desoneração.xlsx | Encargos | 184 × 30 | Memória de cálculo e relações, não novos itens |
| MT 07-2026 Relatório Analítico de Encargos Sociais e Trabalhistas.xlsx | Encargos | 184 × 30 | Memória de cálculo e relações, não novos itens |
| MT 07-2026 Relatório Analítico de Mão de Obra - com desoneração.xlsx | Rel. Analítico de Mão de obra | 8845 × 9 | Memória de cálculo e relações, não novos itens |
| MT 07-2026 Relatório Analítico de Mão de Obra.xlsx | Rel. Analítico de Mão de obra | 8845 × 9 | Memória de cálculo e relações, não novos itens |
| MT 07-2026 Relatório Sintético de Composições de Custos.xlsx | Sheet1 | 6620 × 4 | Cadastro sintético pesquisável |
| MT 07-2026 Relatório Sintético de Equipamentos - com desoneração.xlsx | Sheet1 | 571 × 11 | Cadastro sintético pesquisável |
| MT 07-2026 Relatório Sintético de Equipamentos.xlsx | Sheet1 | 571 × 11 | Cadastro sintético pesquisável |
| MT 07-2026 Relatório Sintético de Materiais.xlsx | Sheet1 | 1705 × 4 | Cadastro sintético pesquisável |
| MT 07-2026 Relatório Sintético de Mão de Obra - com desoneração.xlsx | Rel. Sintético de Mão de Obra | 1480 × 6 | Cadastro sintético pesquisável |
| MT 07-2026 Relatório Sintético de Mão de Obra.xlsx | Rel. Sintético de Mão de Obra | 1480 × 6 | Cadastro sintético pesquisável |
| MT 07-2026 Relatório Sintético de Origem de Preços do SICRO.xlsx | ENTREGA | 2427 × 30 | Origem por UF, não tabela de valores |
| MT 07-2026 Relatório Sintético de Origem de Preços do SICRO.xlsx | Tabela RGB utilizada | 11 × 26 | Legenda auxiliar |

Dimensões incluem cabeçalhos, linhas vazias e formatação. Exemplo: mão de obra tem 1.480 linhas físicas mas somente 145 itens por edição. Os PDFs correspondentes servem de evidência de cabeçalhos e semântica; não somar seus registros aos XLSX.

## 5. Composições

Sintético: A Código (texto, preservar zeros iniciais), B Descrição do Serviço, C Unidade, D Custo Unitário (R$). 6.619 itens únicos, sem unidade/descrição ausente. Analítico: blocos com código/descrição, produção da equipe e unidade, FIC quando presente, seções A Equipamentos, B Mão de obra, C Material, D Atividades auxiliares, E Tempo fixo, F Momento de transporte. Contém quantidades, utilizações operativa/improdutiva, custos horários e unitários, códigos auxiliares e transporte LN/RP/P, DMT/FIT. São dependências da composição e não novos serviços VOIA.

Foram identificados 6.619 blocos e 6.619 totais finais; todos os códigos e valores de “Custo unitário direto total” coincidem com o sintético, sem divergência. O analítico contém 58.572 ocorrências de códigos em cabeçalhos/componentes, 8.684 códigos distintos; isso NÃO representa 58.572 itens independentes.

## 6. Insumos e subclasses

Materiais M: A código, B descrição, C unidade, D preço unitário. Equipamentos E/A: A código, B descrição, C aquisição e D:K custos discriminados. Unidade dos custos horários está no cabeçalho (R$/h), não em coluna própria; aquisição é R$ por equipamento e não custo por hora. Mão de obra P: A código, B descrição, C unidade (h ou mês), D custo. Há relatórios explícitos com e sem desoneração para mão de obra; equipamentos têm edição “com desoneração” e edição sem esse sufixo, cujo cabeçalho não diz explicitamente “sem”. Não rotular composições como dois regimes automaticamente.

Na busca VOIA: composições → `composicao`; materiais/equipamentos/mão de obra → `insumo`, com subclasse própria preservada. Biblioteca VOIA continua `servico`. Transporte e atividades auxiliares aparecem como composições e relações do analítico, não como uma nova tabela sintética autônoma.

## 7. Campos de preço e custo

| Origem / campo | Unidade / interpretação documental | Exemplo real | Uso recomendado |
|---|---|---|---|
| Composições D: Custo Unitário | R$/unidade da composição; total direto publicado | 0307731: 187,66/dm³ | Referência da composição, sem recalcular |
| Materiais D: Preço Unitário | R$/unidade do material | M0004: 7,6603/kg | Referência do material com precisão original |
| Mão de obra D: Custo | R$/h ou R$/mês conforme C | P9801: 27,0619/h; com desoneração 25,6959/h | Custo total publicado por edição |
| Equipamentos C: Valor de Aquisição | R$ do equipamento, não R$/h | E9001: 76.629,8902 | Somente parâmetro de aquisição |
| Equipamentos D: Depreciação | R$/h | E9001: 10,2173 | Componente técnico |
| Equipamentos E: Oportunidade de Capital | R$/h | E9001: 1,5760 | Componente técnico |
| Equipamentos F: Seguros e Impostos | R$/h | E9001: 0,0000 | Zero real, não ausência |
| Equipamentos G: Manutenção | R$/h | E9001: 7,6630 | Componente técnico |
| Equipamentos H: Operação | R$/h | E9001: 0,0000 | Componente técnico |
| Equipamentos I: Mão de Obra de Operação | R$/h | E9001: 0,0000 | Componente técnico |
| Equipamentos J: Custo Produtivo | R$/h | E9001: 19,4563 | Opção de referência específica, requer escolha |
| Equipamentos K: Custo Improdutivo | R$/h | E9001: 11,7933 | Outra opção de referência, requer escolha |

O analítico de composição também publica: custo horário produtivo/improdutivo por equipamento, custo horário total por linha e total de equipamentos; custo horário da mão de obra e seu total; custo horário total de execução; custo unitário de execução; custo do FIC; preço unitário e custo unitário de cada material; total de material; custo unitário e total de atividades auxiliares; subtotal; custo unitário e total de tempo fixo; custo unitário e total de transporte; custo unitário direto total. Não somar novamente estes totais para obter um novo preço.

Exemplo 0307731, analítico linhas 1–29: produção 2 dm³, FIC 0,04299; P9821 custo horário 35,7715, total horário 71,5430; execução unitária 35,7715; FIC 1,5378; material 150,2211; subtotal 187,5304; tempo fixo 0,1293; total direto publicado 187,66. Alguns subtotais estão vazios: preservar vazio e não deduzir zero.

O analítico de mão de obra publica salário, periculosidade/insalubridade (% e R$), encargos sociais e trabalhistas mensais e média móvel (% e R$), complementares (alimentação, EPI, ferramenta, transporte, consulta ocupacional), adicionais (cesta básica, assistência médica, seguro de vida, desgaste orgânico, confinamento), encargos totais e custo total. P9801 sem desoneração: salário 9,0367; encargos mensais 109,50%; média móvel 109,36% e 9,882535; complementares 6,444098; adicionais 1,698614; encargos totais 18,025247 e custo total 27,0619. Os intermediários chegam a seis ou mais casas: guardar decimal original, não converter tudo a centavos. Não equiparar salário ao custo total.

Encargos XLSX `Encargos`: A código, B descrição, C unidade, D:L grupo A1:A9, M:V grupo B1:B10, W:AA grupo C1:C5, AB:AC grupo D1:D2 e AD total (%); manter os endereços e cabeçalhos originais no extrator. São percentuais, não preços. Para P9801 o total é 109,50% sem e 94,46% com desoneração. Não transformar percentuais em custos sem fundamento.

**Recomendação:** total sintético para composição; preço unitário para material; custo total sintético da edição escolhida para mão de obra; escolha explícita produtivo/improdutivo + edição para equipamento. Aquisição, componentes, encargos e coeficientes permanecem memória técnica. A referência escolhida nunca preenche automaticamente preço adotado. A política de equipamentos, regimes e zeros precisa de aprovação antes da implementação.

## 8. Origem de preços

`ENTREGA`: A código, B descrição, C unidade, D:AD 27 UFs, MT em AD. 2.398 códigos, exatamente o conjunto de insumos únicos, sem ausências. A célula MT contém uma sigla de origem, não preço. Distribuição MT: {'PFM': 1213, 'PRE': 338, 'PCI': 193, 'PEI': 15, 'PEE': 23, 'PMP': 165, 'PC': 18, 'PRI': 102, 'PMT': 112, 'PCT': 4, 'PRZ': 68, 'PFE': 2, 'SDP': 129, 'SPC': 16}.

A aba “Tabela RGB utilizada” traz outra legenda: DMT/EST/P/ECT/E/I/MDO/Z/PCT/PPE, respectivas descrições e cores. Várias siglas dessa legenda não correspondem literalmente às da aba ENTREGA (ex.: PFM/PRZ/SDP). Não inventar expansão ou traduzir por aproximação. Preservar sigla MT, legenda original e apontar essa ambiguidade. As demais UFs podem permanecer no arquivo original local; não importar seus preços como MT.

## 9. Volumetria e qualidade

| Entidade | Linhas fonte | Códigos únicos |
|---|---:|---:|
| Composição | 6.619 | 6.619 |
| Equipamento por edição | 570 | 549 (460 E + 89 A) |
| Material | 1.704 | 1.704 |
| Mão de obra por edição | 145 | 145 |
| Total pesquisável por identidade técnica | — | **9.017** |

Insumos únicos: **2.398**. Total combinado futuro com SINAPI: 24.494 referências, mais 37 serviços VOIA = 24.531 resultados potenciais. Isso pressupõe uma identidade por equipamento e custos/edições como opções, não linhas duplicadas por preço.

Equipamentos: 15 códigos repetidos, 21 ocorrências extras em cada edição; todos são repetições integralmente idênticas. Sem conflito de valor ou descrição dentro do mesmo código. Há 15 descrições repetidas, correspondentes a esses códigos. Composição/material/mão de obra sintéticos: zero código ou descrição duplicada. Zero interseção de códigos entre os quatro tipos. Repetições entre PDF/XLSX, analítico/sintético e edições não são novas identidades.

Materiais: **68 preços “-”**, zero célula D vazia e nenhum zero numérico; conservar valor bruto “-” e preço normalizado NULL. Composições: quatro zeros publicados (0307730, 1110000, 4900001, 4915801), sem vazio; significado econômico não explicitado, portanto não tratá-los automaticamente como referência gratuita ou converter por regra SINAPI. Equipamentos: custos produtivo/improdutivo completos; 49 linhas sem cada componente C:I, mas com J/K preenchidos. Não completar os componentes. Mão de obra: 145 custos preenchidos em ambas edições. Nenhum cadastro sintético sem descrição/código, e nenhuma unidade ausente em composição/material/mão de obra. Equipamento usa unidade inferida estritamente do cabeçalho horário. Nenhum registro foi limpo ou eliminado.

## 10. Amostra distribuída para regressão

Todos MT, 07/2026. Valores em reais na unidade indicada. Endereços de linha incluem cabeçalho.

| Termo / código | Descrição | Unidade | Tipo | Valor bruto | Origem / linha |
|---|---|---|---|---:|---|
| concreto / 0307084 | Lábios poliméricos em junta de pavimento de concreto - L = 20 mm e H = 30 mm - confecção e assentamento | m | composição | 38.47 | MT 07-2026 Relatório Sintético de Composições de Custos.xlsx / Sheet1 / 88 |
| drenagem / 1103853 | Concreto poroso para tubos de drenagem fck = 25 MPa - confecção em betoneira e lançamento manual - areia e brita comerciais | m³ | composição | 569.83 | MT 07-2026 Relatório Sintético de Composições de Custos.xlsx / Sheet1 / 1686 |
| pavimentação / 1600897 | Demolição manual de construções provisórias de madeira, sem fechamento lateral e sem pavimentação | m² | composição | 4.96 | MT 07-2026 Relatório Sintético de Composições de Custos.xlsx / Sheet1 / 1852 |
| transporte / 1716604 | Derrocagem subaquática de material de 3ª categoria - carga e limpeza - plataforma com clamshell - flutuante montado na obra - sem transporte | m³ | composição | 86.21 | MT 07-2026 Relatório Sintético de Composições de Custos.xlsx / Sheet1 / 1889 |
| escavação / 2004506 | Dreno profundo H = 1,0 m - com geocomposto drenante - inclusive escavação e reaterro | m | composição | 73.5 | MT 07-2026 Relatório Sintético de Composições de Custos.xlsx / Sheet1 / 3215 |
| sinalização / 4915718 | Limpeza de dispositivos de sinalização viária - placas e delineadores refletivos | m² | composição | 11.54 | MT 07-2026 Relatório Sintético de Composições de Custos.xlsx / Sheet1 / 5024 |
| concreto / E9001 | Conjunto vibratório para tubos de concreto com encaixe PB e 3 jogos de fôrmas - D = 0,60 m - 2,20 kW | h | insumo/equipamento | 19.4563 produtivo; 11.7933 improdutivo | MT 07-2026 Relatório Sintético de Equipamentos.xlsx / Sheet1 / 2 |
| sinalização / E9101 | Removedora de faixas de sinalização viária - 9,69 kW | h | insumo/equipamento | 28.8612 produtivo; 5.135 improdutivo | MT 07-2026 Relatório Sintético de Equipamentos.xlsx / Sheet1 / 85 |
| transporte / E9180 | Cesto para transporte aéreo de concreto com capacidade de 1,5 m³ | h | insumo/equipamento | 4.4314 produtivo; 2.8222 improdutivo | MT 07-2026 Relatório Sintético de Equipamentos.xlsx / Sheet1 / 137 |
| escavação / E9653 | Guindaste móvel sobre esteiras com trado para escavação em solos - 186 kW | h | insumo/equipamento | 953.5516 produtivo; 459.8595 improdutivo | MT 07-2026 Relatório Sintético de Equipamentos.xlsx / Sheet1 / 301 |
| concreto / M0006 | Fibra de poliamida para concreto | kg | insumo/material | 27.6647 | MT 07-2026 Relatório Sintético de Materiais.xlsx / Sheet1 / 4 |
| sinalização / M0047 | Cone de sinalização em polietileno - H = 75 cm e base quadrada de 40 x 40 cm | un | insumo/material | 85.8767 | MT 07-2026 Relatório Sintético de Materiais.xlsx / Sheet1 / 34 |
| drenagem / M0107 | Geocomposto para drenagem | m² | insumo/material | 45.2207 | MT 07-2026 Relatório Sintético de Materiais.xlsx / Sheet1 / 79 |
| pavimentação / P9874 | Encarregado de pavimentação | h | insumo/mão de obra | 54.1868 | MT 07-2026 Relatório Sintético de Mão de Obra.xlsx / Rel. Sintético de Mão de Obra / 63 |

## 11. Arquitetura VOIA auditada

Tabelas reais são `bases_referencia`, `base_itens`, `bases_importacoes` e `bases_importacao_lotes` (não uma tabela chamada bases_servicos). Migrações 0031/0032. `bases_referencia`: tipo/fonte SICRO já aceito, nome, origem, competência, UF, data_referencia, versão e regime. `base_itens`: código, descrição, unidade, tipo servico/composicao/insumo, classificação, grupo, categoria/subcategoria, tags, observações, preço genérico inteiro em centavos, preços SINAPI em centavos por regime e metadados JSON. Unicidade `(base_id,codigo,tipo,classificacao)`. Itens imutáveis por triggers. Não modificar esse contrato SINAPI.

`src/shared/bases-servicos.ts` define schemas, identidade, assinatura, lotes e snapshot. Metadados são objeto plano de strings/números/null, chaves até 100 caracteres, strings até 2.000, total até 12.000. Aceita guardar decimais textuais próprios, mas não uma árvore analítica arbitrária. `src/worker/bases/routes.ts` integra biblioteca+base, valida acesso Admin/Gestor e escrita Admin, valida fonte e lotes; SINAPI tem validações exclusivas. SICRO hoje não tem validação semântica específica.

`importar-base-xlsx.ts`: leitor genérico 20 MiB compactado, partes 30 MiB, total 60 MiB, 600 mil células, até 50.010 linhas/aba. Mapeamento de um único preço ou campos de regime, preços com >2 casas são rejeitados. Não relaciona relatórios, memórias de cálculo, códigos repetidos ou siglas de origem. Analítico de composição com 210.814 linhas excede limite. `importar-sinapi.ts` é específico de CSD/CCD/ISD/ICD e UF: não reutilizar essa interpretação para SICRO.

Catálogo já oferece fonte SICRO, tipo, etapa, categoria, unidade, competência/UF e paginação servidor. Renderiza um preço genérico ou os dois preços SINAPI. Não consegue escolher produtivo/improdutivo ou exibir precisão SICRO. `src/shared/planilhas.ts`, `itemDoCatalogo` e `src/worker/obras/planilhas.ts` preservam referência original separada de `valor_unit_centavos` adotado. Snapshot já inclui fonte/base/item, tipo, classificação, código, descrição, unidade, competência, UF, versão, origem, data, regime e metadados. Seleção de referência é hoje específica dos dois regimes SINAPI; não reutilizar seus enums para custos SICRO.

## 12. Migration 0033: avaliação e proposta

**Não é tecnicamente obrigatório alterar D1 para arquivar SICRO:** metadados existentes podem preservar valores brutos/decimais e deixar `preco_centavos` NULL. Isso sozinho, contudo, não entrega seleção tipada, busca e snapshot de múltiplos custos com precisão nativa. Não recomendo publicar uma integração completa disfarçando tudo como centavos SINAPI.

**Para a solução completa recomendada, propor uma 0033 aditiva, sujeita à aprovação**, com tabela `base_item_custos`: id, base_item_id FK RESTRICT, conceito (unitario_composicao/material/custo_mao_obra/produtivo/improdutivo/aquisicao etc.), edição documental, valor_decimal TEXT nullable validado no servidor, moeda BRL, unidade_custo, arquivo_sha256, arquivo_nome, aba, linha, coluna e metadados técnicos. Unicidade por item+conceito+edição; campos de rastreabilidade e valor imutáveis, índices por item/conceito/edição. Decimal textual evita perda dos quatro ou seis dígitos; valores selecionáveis e intermediários devem ser distinguidos. Não há necessidade de alterar/reescrever SINAPI, Biblioteca ou planilhas existentes. Escala fixa 10.000 serve aos sintéticos, mas não a todos os intermediários; por isso não adotar uma escala única silenciosamente.

Snapshot JSON receberia campos opcionais próprios para `custo_sicro_escolhido` (conceito/edição/unidade/decimal/id/evidência), com validação server-side e preservação de snapshots antigos. A coluna JSON atual permite isso sem ALTER na tabela de planilhas. A definição final da 0033 depende da decisão sobre profundidade analítica e seleção de preço. Nenhum arquivo SQL foi criado nem executado nesta auditoria.

## 13. Importador proposto

Criar importador SICRO específico para um conjunto local de XLSX, sem exigir upload do `.7z` no navegador. Reconhecer cabeçalhos reais e vínculo dos pares, validar MT/competência via evidência documental, manter códigos como texto, ler decimal bruto OOXML sem arredondar, relacionar origens MT e memórias analíticas por código. Preview deve mostrar 9.017 identidades candidatas, repetições, ausências, quatro zeros, edições e escolhas pendentes. Reutilizar autenticação, staging, assinatura e finalização atômica existentes após estender validação SICRO. Não implementar ainda.

## 14. Deduplicação e rastreabilidade

Uma referência SICRO por UF+competência+edição do pacote, sem separar produtivo/improdutivo em bases distintas. Preservar SHA do pacote e de cada XLSX, versão do parser, arquivo/aba/célula/linha, código original, classificação técnica, sigla de origem MT e rótulos documentais. Deduplicar repetições idênticas apenas após confirmação, conservando todas as linhas de origem. Se mesmo código/conceito/edição divergir, bloquear para decisão. Assinatura canônica de conteúdo e hash do manifesto dos arquivos para idempotência; mesma identidade com conteúdo diferente deve exigir nova edição, nunca sobrescrever. O UNIQUE atual de bases inclui nome/regime: precisa de validação adicional SICRO para impedir duplicação semântica por nomes diferentes, por trigger na 0033 ou regra transacional equivalente.

## 15. Snapshot e preço adotado

Copiar referência e todos os custos disponíveis ou referência imutável tipada com evidência necessária no snapshot; registrar escolha exata (produtivo/improdutivo, edição, unidade e decimal) quando houver. Não preencher `valor_unit_centavos` nem quantidade. A conversão para centavos deve ocorrer apenas ao usuário definir preço adotado, com regra explícita de arredondamento e origem preservada. Backend valida escolha contra custos imutáveis e acesso à Obra via Projeto; nunca confiar no JSON recebido do frontend. Exportação deverá distinguir valor original SICRO, conceito escolhido e valor adotado, incluindo precisão e NULL.

## 16. Performance e D1

9.017 identidades adicionais são compatíveis com staging atual (limite 50.000, lotes até 200/700 KB), cerca de 46 lotes para itens; custos dependentes e analíticos exigem lotes próprios, sem englobar todo analítico num único JSON de 12 KB. O pacote físico e tamanhos acima são medidos; tamanho do payload canônico e tempo de importação ainda não podem ser medidos sem definir o contrato. Estimativa de planejamento: dezenas de MB incluindo custos/staging, não equivalência ao tamanho XLSX. Não prometer tempo de importação nem latência antes de um ensaio local.

Índices existentes: base/tipo/código, base/grupo/unidade/id, base ativa/tipo/competência/UF, unicidade de identidade e hash de importação. Preservar paginação servidor de 30 itens (+1 para lookahead), 50 por lista de base. Busca normalizada usa `instr`, não FTS: filtro reduz conjunto, mas contém textual continua varredura, e OFFSET cresce em páginas distantes. Medir plano e tempos com 24.531 candidatos locais antes de decidir FTS/keyset; não criar índice hipotético para `instr` como se resolvesse substring. Frontend nunca recebe catálogo integral. Upload/extrator analítico deve ser incremental e ter limites próprios, validação ZIP/XML e sem executar fórmulas.

## 17. Riscos e decisões obrigatórias

1. Escolha produtivo/improdutivo e edição de equipamento: não há um preço único universal.
2. Composições não têm par documental com/sem desoneração; não derivar um segundo total.
3. Precisão de 4 casas sintéticas e maior nos intermediários exige preservar decimal original.
4. Quatro composições zeradas não têm significado econômico explicitado; exigir revisão antes de seleção.
5. 68 materiais “-” precisam permanecer sem preço.
6. Legenda RGB não decodifica inequivocamente todas as siglas de origem MT.
7. Não declarar orçamento final/BDI a partir do custo direto do pacote.
8. Profundidade da memória analítica deve ser acordada; JSON plano de 12 KB não garante preservar composição completa.
9. Registros auxiliares e duplicações entre formatos/edições não podem inflar o catálogo.

## 18. Próxima rodada proposta e ponto de parada

Solicitar decisão sobre política de custos por subclasse/edição, tratamento dos quatro zeros, precisão e memória analítica. Após autorização, preparar 0033 aditiva se adotada a tabela de custos; implementar parser específico, preview editável de decisões e validações de origem, UI/snapshot/export sem alterar SINAPI, ensaio exclusivamente local com contagens e amostras desta auditoria, idempotência, permissões e testes. Produção exigirá nova autorização e backup atualizado. **Auditoria encerrada sem implementar importação.**

## 19. Validação do estado atual

Worker: **235 testes aprovados em 26 arquivos**. UI: **160 aprovados em 14 arquivos**, incluindo teste opcional com o ZIP SINAPI real habilitado por VOIA_SINAPI_REAL (a execução inicial padrão teve 159 aprovados e 1 opcional ignorado). Total final: **395 aprovados**. Typecheck dos testes e aplicação (tsc -b no build): aprovado. Lint: aprovado. Build de produção: aprovado; somente avisos existentes de anotações Zod e chunk maior que 500 kB. UTF-8 estrito/mojibake: **250 arquivos examinados, zero achados** em src/test/docs/migrations. Build não foi publicado. A primeira tentativa restrita do runtime Worker falhou ao carregar `cloudflare:test-internal`; repetição fora dessa restrição foi bem-sucedida, sem alteração do código.

# Orçamento VOIA integrado à Planilha de Obra

Data: 31/10/2026. Branch: `claude-modelos-processos-v2`. Baseline conferido: `66bc9da42938708311e1ab2419dd26a54402bb8e`; working tree limpa antes da rodada. Produção anterior informada pelo usuário: `a922a802-81a1-427b-beea-0c79d7d38e4e`. Esta rodada é exclusivamente local.

## Auditoria anterior à implementação

- `obra_planilhas`: cabeçalho, estrutura `livre`/`reforma`, status `rascunho`/`em_revisao`/`aprovada`/`arquivada`, versão otimista e token de operação. Esses tipos descrevem a estrutura técnica, não o contexto comercial.
- `obra_planilha_grupos`: etapas da mesma planilha, ordenadas.
- `obra_planilha_itens`: identidade/código imutáveis, exclusão lógica, quantidade REAL, `valor_unit_centavos` INTEGER e `dados` JSON completo, protegido por `CHECK(json_valid(dados))`.
- `obra_planilha_snapshots`: histórico imutável por triggers, com finalidade, versão e JSON. Já é usado no salvamento e emissão XLSX.
- O antigo **VALOR UNIT. é o preço adotado**, independente da referência. Alimenta o total-base `quantidade × valor_unit_centavos`. Não era preço SINAPI nem preço final com encargos. Não houve conversão/reinterpretação desse campo ou de dados existentes.
- Referência já era snapshot separado em `referencia_origem`, com código, edição/competência/UF, origem, regimes SINAPI, metadados SBC e custos tipados SICRO. Biblioteca, busca unificada e autocomplete foram reutilizados.
- A grade já tinha navegação, seleção, TSV, rascunho sessionStorage, paginação, ordenação, exclusão confirmada, duplicação e salvamento em lote. Exportação OOXML/ZIP real já possuía cinco abas de Quantitativo, preços-base, totais por ambiente, resumo e pendências.
- Documentos emitidos derivam de snapshot histórico; a exportação de planilhas não precisa de R2. Não foi criado workflow de documentos, financeiro ou autorização paralelo.

## Arquitetura escolhida — sem migration

**Quantitativo | Orçamento** são visões dos mesmos itens, na mesma planilha. Alternar a visão não grava no servidor e não duplica serviços/quantidades. O modo é de visualização da sessão; a emissão registra finalidade `quantitativo_xlsx` ou `orcamento_xlsx`.

Os quatro novos campos opcionais são armazenados no JSON já existente do item:

- `bdi_percentual`: número ou NULL, até duas casas decimais;
- `desconto_percentual`: número ou NULL, até duas casas;
- `preco_adotado_origem`: `manual`, `referencia` ou NULL;
- `preco_adotado_referencia`: snapshot da referência na ocasião da adoção explícita, ou NULL.

Nenhuma tabela, coluna, índice ou trigger foi alterado. **Não foi criada nem aplicada migration**, local ou remota. Não houve migração de dados; ensaio de migration/rollback não se aplica. Migrations existentes são usadas apenas pelo setup dos bancos descartáveis dos testes, como antes.

Itens legados continuam válidos com os campos ausentes. Preço existente sem origem permanece identificado como **Legado · origem não registrada**; não é rotulado como manual por adivinhação. Editar apenas BDI não inventa uma origem para esse preço. Uma alteração real do adotado registra `manual`; adoção explícita registra `referencia` com sua memória própria. Trocar a referência informativa posteriormente preserva essa memória da adoção anterior, o valor adotado e os percentuais.

## Cálculo, precisão e arredondamento

Cálculo **individual por item**, compartilhado entre Worker, React e exportação:

1. `preço com BDI = adotado × (1 + BDI/100)`;
2. `unitário final = preço com BDI × (1 − desconto/100)`;
3. `total do item = quantidade × unitário final`;
4. total geral = soma dos totais finais dos itens.

O exemplo 10 × R$ 100,00 × 1,25 × 0,90 produz unitário R$ 112,50 e total **R$ 1.125,00**. Não há BDI/desconto aplicado sobre o total geral.

O preço adotado continua em centavos inteiros. Adoção SICRO mantém a política anterior explícita de arredondar o custo oficial para centavos; o valor oficial completo continua intocado no snapshot. O input adotado aceita até duas casas monetárias, não valores com arredondamento silencioso.

Percentuais são convertidos em inteiros de centésimos de ponto percentual; o cálculo usa BigInt/racionais. Quantidade usa a representação decimal do número existente, inclusive notação científica. Não há arredondamento monetário intermediário para obter o total: **half-up uma única vez, no total de cada item, para centavos**. O preço unitário exibido em BRL tem duas casas; seu valor exato permanece disponível no cálculo/tooltip e no XLSX. Exemplo testado: R$ 0,01 com BDI 25%, quantidade 100 → R$ 1,25; não R$ 1,00 a partir do unitário exibido.

O backend rejeita totais além do limite inteiro seguro e valida o total geral. Os limites existentes de quantidade/adotado continuam. Derivados não são aceitos do cliente; campos como `total_centavos` e `final_centavos` adulterados são recusados pelo schema estrito. O Worker recalcula `orcamento` em leitura e na criação dos snapshots, com política versionada `voia-item-v1`.

## Ausência, zero e integridade comercial

- Preço ou quantidade ausente → total do item NULL/“—”. Nenhum preço ausente vira zero.
- Zero é um valor válido para quantidade, preço, BDI e desconto.
- BDI/desconto ausentes permanecem ausentes. Somente o cálculo **provisório** usa fator neutro nesses campos; resumo/linha de detalhe informam a pendência. Não são gravados zeros implícitos.
- Total completo só é apresentado como tal quando todos os itens têm quantidade, preço e percentuais confirmados. Caso contrário, **Orçamento parcial**, com contadores de ausências.
- BDI permitido: 0–1000%; desconto: 0–100%; ambos finitos e com no máximo duas casas. O limite de BDI é explícito e validado nos dois lados. Não se aceita NaN/Infinity, percentuais negativos ou descontos superiores a 100%.
- Preço final e total são derivados, não inputs. BDI, desconto, quantidade e adotado podem ser editados separadamente; cada um preserva os demais.

## Referências e origem do adotado

- SINAPI exige regime explícito para ter referência utilizável na adoção. Alterar regime muda referência, preservando adotado, BDI e desconto. Contratação “somente mão de obra” continua independente de regime tributário.
- SICRO mantém tipo/subtipo, edições, produtivo/improdutivo, custos decimais e memória de origem. Equipamentos exigem escolha explícita; não se inventa um custo único. A UI exibe o decimal oficial selecionado; snapshot conserva todos os custos.
- SBC mantém código, descrição, unidade, preço, competência, UF e proveniência **Relatório importado**, sem mudanças de parser/base.
- VOIA e outras fontes usam o snapshot existente. Biblioteca VOIA não ganha preços fictícios; referência sem preço permanece sem preço. A origem VOIA também é reconhecida em snapshots legados que contêm `fonte=biblioteca` sem `tipo_base` explícito.
- Digitar adotado registra origem manual. **Usar referência como preço adotado** é ação explícita, individual no detalhe ou na seleção. Substituição de preço existente exige confirmação. Seleção com alguma referência sem preço/regime/custo confirmado é rejeitada integralmente, sem adoção parcial silenciosa.
- Backend valida a proveniência declarada da adoção contra referência canônica ou histórico real, inclusive base inativa. Origem/valor forjados são rejeitados. A duplicação conserva origem histórica sem depender de a edição continuar ativa.

## Interface, subtotais e lote

A grade Quantitativo permanece com suas colunas e sem exigir preço. Orçamento usa código, serviço, unidade, quantidade, fonte, referência, adotado, BDI, desconto, final, total e detalhes. Cabeçalho fixo, scroll horizontal, código/serviço fixos no desktop; mobile usa scroll sem sobreposição das colunas fixas, podendo editar valores simples. Dados técnicos continuam no detalhe da mesma linha; não foi criado formulário abaixo da grade.

Resumo compacto mostra total parcial/completo, itens com/sem preço, quantidade ausente e percentuais múltiplos/não informados. Subtotais por etapa usam os totais finais, com indicação de parcialidade. Avaliado subtotal por ambiente: as abas existentes de Quantitativo preservam sua função de custo-base por ambiente; não foi acrescentado um segundo painel de agrupamento na UI nesta rodada.

Seleção existente é reutilizada para aplicar BDI/desconto. Percentuais já informados e diferentes exigem confirmação; NULL pode ser aplicado explicitamente para limpar, com confirmação quando substitui um valor. Não selecionados são preservados. TSV de Orçamento segue a ordem das colunas editáveis, pula referência/final/total e valida o lote antes de aplicá-lo. Paste de preço registra origem manual. Erros não trocam silenciosamente valores; edição numérica inválida na grade de orçamento restaura o valor anterior e mostra alerta.

Autocomplete não foi refeito; a nova visão usa o mesmo componente e endpoint com escopo de obra/planilha. Quantitativo, Biblioteca, texto manual, teclado, seleção, duplicação, exclusão confirmada, filtro, paginação e estado Salvo/Salvando/Erro foram preservados.

## XLSX e histórico

Quantitativo mantém suas **cinco abas** e totais-base. Exportação no modo Orçamento acrescenta **ORÇAMENTO VOIA** e abre nessa aba. Cabeçalho VOIA, nome/versão, colunas técnicas/comerciais, formatos BRL e percentuais, larguras, filtros e congelamento na linha 3. As abas antigas acompanham a emissão como quantitativo/custo-base e são claramente distinguidas da aba de totais finais.

Unitário final, total de item, subtotais por etapa e total geral são fórmulas reais com valores calculados em cache, produzidos pela política compartilhada. Quantidade/adotado ausentes ficam em branco e produzem resultado vazio, não zero. Percentuais NULL continuam células vazias com aviso de cálculo provisório. Unitário não é arredondado antes da multiplicação; ROUND aplica-se somente ao total do item. SUM soma somente os itens, excluindo os subtotais para evitar dupla contagem. Referência SICRO, regime, fonte/competência/UF e origem da adoção são mantidos, incluindo os decimais oficiais como texto no metadado técnico para preservar sua precisão original. Strings do usuário são inline strings, nunca fórmulas executáveis.

A emissão usa POST de snapshot versionado no backend, nunca apenas o estado do React; alteração posterior não modifica o documento/snapshot emitido. Foi verificada leitura dos XLSX finais com openpyxl (somente leitura): 5/6 abas, orçamento ativo, fórmulas, cache 112,50/1.125,00, congelamento, formato percentual e NULL. Artefatos de fixture permanecem ignorados em `.wrangler/orcamento-voia/`.

## Segurança, concorrência e próximos módulos

Mantidos withSession/requireAuth, perfis administrador/gestor, requireObraAccess e vínculo obra→projeto, escopo planilha/obra, IDs imutáveis, bloqueio de parceiro para valores, histórico imutável e proteção de IDOR. Nenhuma autorização foi ampliada. Salvar continua lote atômico com claim otimista por versão/token e 409 em conflito. Nenhuma gravação por tecla, mudança de visão ou consulta ao catálogo.

Não foram implementadas Solicitação de Proposta ou Medição. IDs técnicos, snapshot, quantidade, adotado e sua origem continuam separados, permitindo integrar cotações sem duplicar o serviço. Não há fornecedor/cotação fictícios; o campo fornecedor anterior foi preservado. Quantidade técnica não foi convertida em quantidade medida, nem conclusão de tarefa em medição física. Classificação segura das fontes/custos foi preservada sem heurística nova sobre milhares de referências. Status anteriores e finalidade de exportação atendem à rodada, sem workflow comercial adicional.

## Testes e validação

- Worker completo: **297 aprovados**, 32 arquivos.
- UI completo, com arquivos reais locais SINAPI/SICRO/SBC habilitados: **211 aprovados**, 20 arquivos, nenhum ignorado.
- Orçamento específico: **38 Worker + 9 UI = 47 aprovados**.
- Execuções separadas de regressão: Planilhas UI **16**; autocomplete UI **17**; Bases Worker (VOIA/SINAPI/SICRO/SBC) **45**, aprovados.
- Worker específico combinado com Planilhas/autocomplete: **61 aprovados**; UI combinado: **42 aprovados**.
- Build: aprovado; somente os avisos preexistentes de dependência/chunk grande. Typecheck aplicação e testes: aprovado. Lint: aprovado, sem avisos.
- UTF-8/mojibake: **291 arquivos examinados, zero achados** em src/test/docs/migrations. `git diff --check` aprovado. Total Worker + UI: **508 aprovados**, nenhum ignorado.

Os testes cobrem a fórmula/ordem, zero/NULL/ausências, limites/overflow, arredondamento, quantidade fracionária, preços/regimes/fontes, SICRO preciso, origem manual/referência e troca, adoção explícita, confirmação, seleção parcial, lote/paste inválido atômico, subtotais/total, edição/reload, backend contra derivados forjados, autorização/IDOR, conflito, duplicação/exclusão, versões históricas, legado e base inativa. Regressões completas incluem Obras/RDO/Fotos/Documentos/Ocorrências/Cronograma/Gantt, catálogo e importação inteligente.

## Validação visual local

Miniflare com cópia isolada de banco já disponível e fixtures próprias (cliente/projeto/obra 90001). Somente essa fixture foi criada/editada/salva e usada em XLSX; nenhum dado real/Yara foi modificado, mesmo na cópia local. O backup original não foi modificado.

- 1920×1080: Quantitativo preservado; Orçamento com resumo compacto, 30 linhas, itens sem preço, percentuais e resultados visíveis; autocomplete por 92767 alinhado e independente da tabela.
- 1366×768: grade larga legível com scroll horizontal, cabeçalho e serviço/código fixos; inputs monetários e percentuais utilizáveis.
- 1024×1366: scroll horizontal confirmado (394 px), serviço preservado na região fixa e percentuais acessíveis; total/subtotais disponíveis.
- 375×812: controles se ajustam sem overflow da página (largura de conteúdo 360 px), grade com scroll horizontal e inputs numéricos acessíveis; colunas fixas desativadas no mobile para não cobrir valores. Quantitativo mobile preservado. Não foi usada uma tabela comprimida até ficar ilegível.

Capturas ignoradas pelo Git: `quantitativo-1920.png`, `orcamento-1920.png`, `autocomplete-1920.png`, `orcamento-1366.png`, `orcamento-1366-scroll.png`, `orcamento-1024.png`, `orcamento-375.png`, `quantitativo-375.png`. Fixture mostrou referência SINAPI R$ 16,76 independente do adotado R$ 100,00, BDI 25%, desconto 10% e total R$ 1.125,00. Salvamento/exportação ocorreram só no servidor local. Viewport restaurado e aba de preview fechada.

Limites: mobile validado por viewport, não teclado físico/virtual de aparelho; percentuais ausentes produzem cálculo provisório explicitamente parcial; modo de visualização não é gravado como tipo de planilha. A captura inicial de download teve demora do navegador; os XLSX finais também foram gerados diretamente do gerador atual com a fixture local e validados sem depender do download. Branding de teste local não representa alteração visual de branding no produto.

## Arquivos da rodada

Modificados:
- `src/shared/planilhas.ts`
- `src/worker/obras/planilhas.ts`
- `src/react-app/components/ObraPlanilhasPanel.tsx`
- `src/react-app/lib/planilha-xlsx.ts`

Criados:
- `src/shared/orcamento.ts`
- `src/react-app/components/OrcamentoTabela.tsx`
- `src/react-app/lib/orcamento-ui.ts`
- `src/react-app/styles/orcamento.css`
- `test/orcamento-calculo.test.ts`
- `test/orcamento.test.ts`
- `test/ui/orcamento.test.tsx`
- `docs/RELATORIO-ORCAMENTO-VOIA.md`

## Ponto de parada

**Sem migration, deploy, commit ou push. Zero operação de produção, zero importação de base e zero upload ao R2.** D1/bindings/Worker publicados permanecem intocados. Nenhuma consulta remota foi necessária nesta rodada. A publicação do Orçamento VOIA depende de autorização explícita.

## Revisão de Serviço e auditoria de Modalidade — 01/11/2026

Escopo: preservar o Orçamento já implementado, corrigir descrição cortada e auditar Modalidade. **Nenhum deploy, commit, push, migration ou operação de produção foi executado. Nenhum dado real/Yara foi alterado.**

### Serviço completo no Quantitativo e no Orçamento

Foram identificados dois problemas distintos: o editor principal era um input de uma linha e `itemDoCatalogo`/seleção usavam `slice(0,300)`. A correção usa textarea compacta com altura calculada pelo conteúdo, wrap automático, sem ellipsis/clamp na descrição principal. ResizeObserver e resize mantêm a altura correta quando muda a largura. A coluna continua com largura equilibrada: aproximadamente 259–277 px no desktop; a linha pode ter 2, 3 ou mais linhas sem limite visual imposto pela aplicação. Código/fonte/competência/UF permanecem abaixo e também permitem wrap. Demais células se alinham ao topo.

O serviço admite até **5000 caracteres**, conforme o limite técnico já existente da descrição das referências. Texto manual e descrição escolhida do catálogo não são mais reduzidos a 300 caracteres. O limite é validado no servidor; não há corte silencioso de conteúdo excedente. O schema continua usando os campos JSON/TEXT existentes; nenhuma migration foi necessária.

Compatibilidade: quando um item legado contém exatamente os 300 primeiros caracteres da descrição do snapshot e esse snapshot é maior, `servicoCompleto` exibe/exporta a descrição inteira. Uma descrição manual diferente permanece soberana. Não foi executada atualização em massa no banco. Apenas abrir/focar/sair de uma célula restaurada não regrava o prefixo legado. Filtro, ordenação e cópia da grade usam o mesmo texto completo exibido. A busca do autocomplete continua limitada a 150 caracteres de consulta e 12 resultados, sem limitar o conteúdo selecionado.

O componente original de autocomplete foi preservado, com debounce, cancelamento de respostas antigas, escopo/validação, teclado e preço adotado independente. Os eventos passaram a aceitar input/textarea. Enter mantém a navegação da planilha; Tab, setas, seleção e paste TSV continuam delegados ao comportamento existente. As sugestões também deixaram de usar clamp de duas linhas.

### XLSX

As abas de Quantitativo/Orçamento exportam o serviço completo, incluindo o caso legado recuperável do snapshot. Colunas Serviço têm largura 60, alinhamento com wrap e altura calculada conforme o texto. Não há altura única de uma linha para descrições extensas. A altura é limitada a 409 pontos, limite técnico de linha do Excel; textos excepcionalmente maiores continuam integralmente na célula, embora esse limite físico do Excel possa exigir ajuste de largura/consulta na barra de fórmulas. Não foi removido conteúdo para contornar esse limite.

Verificação com fixture de 531 caracteres, gerador atual e leitura openpyxl: Quantitativo e Orçamento preservaram **531 caracteres**, `wrap_text=True` e altura **138 pontos**. Fórmulas de orçamento, preço-base, percentuais, total, abas anteriores e snapshots continuam preservados.

### Modalidade — domínio não encontrado; implementação suspensa

Busca sem distinção de caixa em `src`, `migrations` e `test` não encontrou campo, enum, endpoint, filtro ou texto de interface denominado **Modalidade**. Portanto, não foi possível reproduzir o seletor mencionado nem determinar com segurança a causa de ele estar travado. Não existe armazenamento identificado para esse conceito nesta cópia.

O que existe de fato, sem equiparar conceitos:

| Conceito existente | Armazenamento / opções | Interface / dependências |
|---|---|---|
| Estrutura da planilha | `obra_planilhas.tipo`: `livre`, `reforma`; mesmo enum no schema da API | Selecionada em Nova planilha como Estrutura e mostrada como Tipo na lista. Livre cria grupo Serviços; Reforma permite selecionar etapas do modelo. PUT valida o enum, mas não há seletor de edição da estrutura no cabeçalho. Não é um campo chamado Modalidade. |
| Contratação | `somente_mao_de_obra`: NULL/boolean | Dropdown Não confirmado / Somente mão de obra / Outro regime; grava no mesmo lote. Não é Modalidade nem regime tributário. |
| Visão | Estado local Quantitativo/Orçamento | Não altera o tipo físico; finalidade do snapshot distingue a exportação. |
| Referência SINAPI | Regime no snapshot do item | Independente de estrutura/contratação/visão. |
| Status e etapas | Campos anteriores da planilha/grupos | Não constituem modalidades. |

XLSX, filtros e criação/edição existentes não possuem um domínio separado de Modalidade. Não foram inventadas opções e não foi renomeado outro conceito para disfarçar a ausência. Foram solicitados à usuária a localização do campo e o significado/opções pretendidos; **essa parte aguarda definição**. Testes 8–14 específicos de Modalidade não foram criados/executados, conforme a condição do pedido. Isso não representa seletor corrigido ou persistência de Modalidade implementada. Não há justificativa para criar migration sem antes definir o domínio.

### Validação visual e testes finais

Fixture exclusivamente local em cópia isolada; nenhuma leitura/gravação de produção. Validado nos dois modos:

| Viewport | Conteúdo | Altura do editor / linha | Largura da coluna/editor |
|---|---:|---:|---:|
| 1920×1080 | 531 caracteres | 290 / 291 px | Quantitativo 259 px; Orçamento 277 px |
| 1366×768 | 531 caracteres | 290 / 291 px | 259 / 277 px |
| 1024×1366 | 531 caracteres | 290 / 291 px | 259 / 277 px |
| 375×812 Quantitativo | 531 caracteres | 499 / 500 px | aproximadamente 164 px |
| 375×812 Orçamento | 531 caracteres | 569 / 570 px | 147 px |

Em todos os casos, altura do conteúdo e do editor coincidiram, sem elipse ou scroll interno ocultando parte da descrição. No mobile, linhas maiores que a área disponível são percorridas pela rolagem normal da tabela. Capturas e medições ficam ignoradas em `.wrangler/revisao-orcamento/`. Após mudança de viewport, houve navegação acidental do preview de rotas limitadas; recarregamento restabeleceu a fixture e a verificação mobile foi repetida. Não foi falha do cálculo ou perda de dados. Viewport restaurado e aba temporária fechada.

- Worker completo: **298 aprovados**, 32 arquivos.
- UI completo com arquivos oficiais locais habilitados: **218 aprovados**, 21 arquivos; nenhum ignorado.
- Total final: **516 aprovados**.
- UI específico de Serviço/Orçamento/Planilhas/autocomplete: **49 aprovados**.
- Execuções separadas: Orçamento Worker **39**; Planilhas/Orçamento UI **25**; autocomplete/wrap UI **24**, aprovados.
- Build, typecheck da aplicação e testes, lint: aprovados. Apenas os avisos preexistentes de build.
- UTF-8/mojibake: **292 arquivos, zero achados**; `git diff --check` aprovado.

Regressões preservam referência/adotado, origem, BDI, desconto, finais/totais/subtotais, seleção, lote/reload, Biblioteca e fontes SINAPI/SICRO/SBC/VOIA. O teste novo do Worker salva/reabre serviço longo e rejeita 5001 caracteres sem alterar o registro anterior. Novos testes UI cobrem edição manual, seleção longa do catálogo, recuperação do prefixo legado, ambos os modos, textarea autoajustável, TSV, teclado, salvamento/reload e wrap/altura do XLSX. Não foram provocadas exclusões ou falhas em produção.

Arquivos adicionais desta revisão sobre os 12 anteriores: `src/react-app/components/ServicoAutocomplete.tsx`, `src/react-app/components/servico-autocomplete.css`, `src/shared/bases-servicos.ts`, `test/ui/servico-wrap.test.tsx`. Outros arquivos da rodada de Orçamento foram ajustados conforme necessário, sem criar domínio de Modalidade. Total atual: **16 arquivos** na working tree.

Ponto de parada desta revisão: **Serviço corrigido; Modalidade não implementada, pendente de esclarecimento. Sem autorização de produção nesta etapa.**

## Esclarecimento e seletor superior de Regime SINAPI — 02/11/2026

A usuária esclareceu que “Modalidade” significava **Regime SINAPI**. A pendência de identificação registrada na revisão anterior está esclarecida; **nenhum campo Modalidade foi criado**.

Foi adicionado **Regime SINAPI** na barra superior de filtros/controles, nas duas visões, separado de Contratação. Opções reais: **Não desonerado** e **Desonerado**. Um placeholder desabilitado identifica estado não confirmado ou regimes diferentes por item, sem inventar uma terceira modalidade ou assumir silenciosamente um regime.

O controle aplica a escolha explicitamente a **todos os itens SINAPI da planilha**, inclusive os que não estejam visíveis pelo filtro. Reutiliza `selecionarRegime`: altera somente `referencia_origem.regime_escolhido` e `preco_referencia_centavos`. Não modifica preços oficiais armazenados, preço adotado, origem/snapshot da adoção, quantidade, BDI, desconto ou outras decisões comerciais. SICRO, SBC, VOIA e itens manuais são devolvidos sem alteração. Preço ausente no regime continua NULL, mesmo se o outro regime tiver preço.

### Persistência existente e limite do cabeçalho

**Não existe campo de regime no cabeçalho `obra_planilhas`.** O modelo existente persiste o regime em cada referência/item SINAPI. A implementação usa exatamente esse armazenamento: após salvar/reabrir, o controle superior deriva a escolha dos itens quando é uniforme. Regimes mistos ou referências não confirmadas são indicados como tais. Alteração individual no detalhe continua possível e o indicador superior reflete os dados efetivos, sem esconder divergências.

Na ausência de itens SINAPI, a escolha é apenas uma **preferência explícita desta edição**, usada pelo próximo autocomplete/seleção de referência. A UI informa que ela não é gravada no cabeçalho. Depois que uma referência SINAPI é selecionada e salva, seu regime é persistido e recuperado normalmente. Não foi usado observações/descrição/grupos, localStorage ou outro campo alheio para simular configuração persistente de cabeçalho.

**Persistir um padrão próprio da planilha vazia, independente de suas referências, exigiria migration aditiva no cabeçalho**, com validação/API e regra para coexistir com regimes por item. Essa migration não foi criada nem aplicada, conforme o pedido. A parte segura está implementada e a persistência por item funciona sem migration. Não há alegação de persistência de um padrão de cabeçalho para planilhas sem SINAPI.

### Integrações

- Autocomplete apresenta o preço do regime escolhido (ou usa o contexto individual em referências mistas). A seleção inline e a Biblioteca avançada aplicam o regime ao novo snapshot SINAPI. Sem contexto explícito, preserva-se a semântica anterior, sem escolha silenciosa.
- Orçamento lê a referência selecionada; seu cálculo continua usando exclusivamente o adotado. Trocar regime não é adotar preço.
- Salvamento em lote, validação de regime/preço no servidor, autorização, isolamento e versionamento anteriores permanecem.
- Snapshot histórico e XLSX registram o regime de cada referência e seu preço efetivamente selecionado. A proveniência da adoção anterior não é sobrescrita.
- Correção de Serviço longo preservada: textarea autoajustável, descrição completa, snapshot legado recuperável e XLSX com wrap/altura.

### Testes finais

- Worker completo: **299 aprovados**, 32 arquivos.
- UI completo: **224 aprovados**, 22 arquivos, com arquivos oficiais locais SINAPI/SICRO/SBC habilitados; nenhum ignorado.
- Total: **523 aprovados**.
- SINAPI Worker específico: **13 aprovados**, incluindo novo teste de lote/reload/snapshot nos dois regimes e NULL.
- Seletor superior UI específico: **6 aprovados** (dois modos, troca/reload, outras fontes, NULL, proveniência, regimes mistos, preferência temporária, autocomplete e XLSX).
- UI combinada regime/orçamento/wrap: **22 aprovados**.
- Build de produção local, typecheck aplicação/testes e lint: aprovados, apenas avisos preexistentes de build.
- UTF-8/mojibake: **293 arquivos, zero achados**; `git diff --check` aprovado.

Validação no preview local, somente fixture isolada: preferência Desonerado mostrou **D: R$ 16,38** no autocomplete da referência 92767; seleção manteve adotado **R$ 17,50**. Troca superior para Não desonerado mostrou referência **R$ 16,76**, mantendo adotado R$ 17,50. Salvamento/reabertura na fixture recuperou `nao_desonerado`. Captura ignorada: `.wrangler/regime-sinapi/seletor-publicacao-local.png`. Esses valores pertencem à referência existente na cópia local; os testes usam também fixtures sintéticas com preços distintos. Nenhum teste ou gravação foi realizado em produção.

Arquivos adicionais desta etapa: `test/sinapi-regimes.test.ts` e `test/ui/regime-sinapi-planilha.test.tsx`; os componentes e helper existentes da rodada foram ajustados. Working tree atual: **18 arquivos**, listados no status final. Nenhum temporário, banco, log ou screenshot está incluído nessa lista.

**Ponto de parada atualizado: Regime SINAPI implementado sobre as referências existentes; preferência persistente de cabeçalho para planilha sem SINAPI não implementada e exigiria autorização de migration. Sem deploy, migration, commit, push, upload ao R2 ou alteração de produção/Yara.**

## Publicação completa autorizada — 02/11/2026

**Deploy concluído no Worker existente `voia-app`.** URL preservada: https://voia-app.bbrazgarcia.workers.dev.

**Novo Version ID: `c2603be4-7401-4bd8-a5e8-0386290443c9`.** Antes da publicação, a consulta do Cloudflare identificou como ativa a versão `8e09d53e-e5cc-4358-81e5-1307e1de10f9`, posterior à `a922a802-81a1-427b-beea-0c79d7d38e4e` citada anteriormente no chat. Essa versão ativa e seus bindings foram conferidos e registrados antes do deploy; não foi criado outro Worker.

Branch e baseline confirmados: `claude-modelos-processos-v2`, `66bc9da42938708311e1ab2419dd26a54402bb8e`. Exatamente os **18 arquivos da rodada** estavam no status. Nenhum arquivo de migration foi criado/modificado. Nenhum código foi alterado nesta etapa de publicação; somente este relatório recebeu o resultado final.

Bindings/configurações preservados:

- **DB → voia-db**, ID `217f7490-d357-4c36-827f-afd54589adb9`;
- **DOCUMENTOS_BUCKET → voia-documentos**;
- compatibility_date `2025-10-08`, flag `nodejs_compat`, assets, observabilidade e demais configurações do projeto.

### Validações pré-deploy repetidas separadamente

- Worker completo: **299 aprovados**;
- UI completo, com arquivos oficiais locais habilitados: **224 aprovados**, nenhum ignorado;
- Orçamento Worker: **39 aprovados**;
- SINAPI Worker: **13 aprovados**;
- Seletor superior UI: **6 aprovados**;
- Planilhas/Orçamento UI: **25 aprovados**;
- Autocomplete/wrap UI: **24 aprovados**;
- Build de produção, typecheck aplicação/testes, lint: aprovados. Apenas avisos preexistentes do build;
- UTF-8/mojibake: **293 arquivos, zero achados**; `git diff --check` aprovado.

O build foi gerado novamente para este deploy. A configuração atual foi usada, sem migration. O upload de assets do Worker não utiliza o bucket DOCUMENTOS_BUCKET.

### Smoke tests da versão publicada

**19 verificações HTTP/assets aprovadas**: health/API 200, banco conectado, páginas e login, proteção 401 sem sessão e SHA-256 dos **12 assets JS/CSS** publicados idênticos ao build local validado. As validações autenticadas usaram a sessão já existente, em abas temporárias.

Obras, Planilhas e abertura da planilha real `PLANILHA DE SERVIÇOS` passaram. Quantitativo e Orçamento estavam presentes, assim como o seletor Regime SINAPI com Não desonerado/Desonerado. A planilha persistida estava na versão 1, vazia; o resumo inicial mostrou orçamento parcial sem total inventado.

Para conferir as interações, foi usada **uma linha apenas no estado local/sessionStorage da aba temporária**, nunca salva. Não foi criado item real, planilha real, snapshot real ou base de teste em produção. Não houve clique em Salvar, Gerar XLSX, duplicar planilha, publicar na Biblioteca ou exclusão. As abas temporárias foram fechadas ao final, descartando o rascunho.

Resultados desse rascunho descartável:

- Quantidade 10, adotado R$ 100,00, BDI 25%, desconto 10% → **total R$ 1.125,00**, resumo completo e valores calculados conforme a sequência por item.
- Descrição manual de **451 caracteres**, com wrap `pre-wrap`; altura do editor e do conteúdo **255 px**, sem ellipsis/corte interno.
- Autocomplete por **92767**: Não desonerado mostrou **R$ 16,76**. Após seleção, trocar para Desonerado mostrou **R$ 16,38**, mantendo adotado **R$ 17,50**, BDI 25% e desconto 10%. Total final **R$ 196,88**; subtotal da etapa e total geral corresponderam ao item.
- Referência **100063**: API retornou os dois preços oficiais como NULL; autocomplete mostrou “Sem preço de referência”; Orçamento mostrou “Sem preço” para referência, sem alterar adotado ou transformar ausência em zero.
- Biblioteca VOIA avançada abriu normalmente. Nenhum serviço foi criado nela.
- A decisão aprovada foi mantida: não criar migration para preferência sem itens SINAPI; aviso de preferência temporária permanece na interface. Com referências, o regime é preservado nos snapshots existentes. Não foi criado Modalidade.

GET autenticado da planilha após as interações confirmou **versão 1, zero itens e total persistido NULL**. O backend publicado retornou `orcamento.politica=voia-item-v1` e os derivados recalculados para esse estado real. A validação positiva dos derivados no servidor foi feita pelos testes Worker com fixtures; não foram enviados valores a uma planilha real apenas para testar cálculo.

Catálogo autenticado e filtros por fonte/UF/competência passaram: SINAPI, SICRO, SBC e VOIA. Busca armadura retornou 12 resultados na primeira página e outros 12 sem IDs repetidos na segunda. Código 92767 retornou uma referência; 100063 comprovou os NULLs. Consulta SICRO/equipamento retornou A9293/A9294/A9296 com **18 parcelas de custo cada**, incluindo produtivo/improdutivo e edições, sem colapso em um preço arbitrário. A não alteração das demais fontes pela troca de regime também permanece coberta pelos testes específicos e pelo asset publicado idêntico.

**XLSX:** o gerador publicado e seus assets foram conferidos contra o build aprovado; os testes locais de Quantitativo/Orçamento, fórmulas, wrap, regime e snapshots passaram. Emissão real não foi acionada em produção: ela cria snapshot histórico e exigiria salvar o rascunho, contrariando a restrição de zero escrita. O botão permaneceu corretamente indisponível no rascunho não salvo. Não há alegação de um XLSX emitido/registrado remotamente nesta validação.

Capturas e logs ignorados pelo Git em `.wrangler/orcamento-publicacao/`: `smoke-orcamento-wrap.png`, `smoke-sinapi.png`, `smoke-resumo-null.png`, resultados HTTP/autenticados, deploy e comparação D1.

### D1 antes/depois e preservação

Foram usadas exclusivamente consultas SELECT/PRAGMA agregadas, sem exportar registros completos. Antes e depois: **37 tabelas com contagens e somas de tamanhos dos conteúdos idênticas**. Os indicadores de Yara também permaneceram idênticos. Essa comparação é agregada, não um hash criptográfico de cada registro, e é acompanhada pela ausência de operações de escrita no fluxo executado.

Contagens finais:

| Dado | Resultado |
|---|---:|
| SINAPI | 15.477 |
| SICRO | 9.017 |
| SBC | 400 |
| Referências oficiais externas | 24.894 |
| Custos tipados SICRO | 18.495 |
| Biblioteca VOIA | 37 |
| Clientes | 2 |
| Projetos | 4 |
| Obras | 1 |
| Planilhas reais | 2 |
| Itens reais de planilhas | **0** |
| Snapshots preexistentes | 2 |
| Importações preexistentes | 4 |
| Arquivos/evidências de importação | 0 |
| Violações de FK | **0** |

A segunda planilha e o segundo snapshot **já existiam no registro pré-deploy**; não foram criados nesta operação. Yara permanece presente e seus indicadores, a tabela de clientes e os demais dados reais foram preservados.

A última migration continua **0035_importacao_assistida.sql**. Todas as consultas de validação registraram `rows_written=0`. Não houve SQL de escrita, migration, nova importação, alteração real salva, nova linha real, criação de dados demonstrativos ou upload ao **R2 voia-documentos**. Os assets publicados pertencem ao serviço de assets do Worker, sem uso do bucket de documentos.

### Ponto de parada após publicação

**Publicado e validado. Nenhum commit ou push foi realizado.** O estado final continua com os 18 arquivos da rodada; temporários, bancos, screenshots e logs permanecem ignorados. Aguardar autorização explícita para commit/push, sem novas alterações de código, produção ou dados.

# Bases de Serviços, Biblioteca VOIA e busca unificada

## Ambiente preservado

Working copy: `C:\Users\Bruna Braz Garcia\Downloads\voia-app-visual-v2\voia-app`.
Branch: `claude-modelos-processos-v2`; commit base: `bb8d37d`. A rodada anterior continua sem commit/push, preservada nesta mesma cópia.

A migration 0030 não foi modificada. SHA-256 permanece `dfbb25fafaf7406db731f9d87236ac5fda460d399448831c774ccee355a898da`.

## Auditoria e separação de conceitos

Revisadas a 0030, as tabelas/rotas de Planilhas, biblioteca, itens, snapshots e a configuração de Tipos de Serviço.

- `tipos_servico`, modelos de etapas e tarefas configuram processos profissionais/administrativos do Projeto. Não foram convertidos em catálogos de insumos ou composições.
- `voia_biblioteca_servicos` continua sendo a biblioteca semântica VOIA, sem preços nem quantidades globais.
- `obra_planilha_itens` continua contendo o item personalizado da Obra. Códigos sequenciais estáveis, memória, salvamento em lote e snapshots da 0030 foram mantidos.
- Bases de referência são edições independentes com origem, competência, UF, versão e regime. Referência de preço e preço adotado na obra são dados distintos.
- Serviço, composição e insumo possuem identificação explícita. Esta rodada não implementa decomposição/editor de composições, coeficientes, medição ou orçamento consolidado.

## Biblioteca e fontes técnicas

Os três arquivos originais continuam disponíveis em Downloads: `quantitativo-reforma.skill` (14.508 bytes), `002_Quantitativo.xlsx` (37.677 bytes), `002_Solicitacao_Proposta_Mao_de_Obra_Q32_L10.pdf` (91.803 bytes). A auditoria integral da rodada anterior foi reutilizada; o exemplo completo do Skill foi relido para identificar serviços adicionais sustentados pelas referências.

O catálogo da migration passa de **28 para 37 serviços**, sem multiplicar os mesmos serviços por nomes de ambientes e sem criar preços, quantidades ou códigos oficiais de bases externas.

| Novo serviço semântico | Etapa | Referência efetiva |
|---|---|---|
| Pintura de teto de gesso | 01 | Skill, `references/exemplo_obra.json` — pintura de teto, distinta das paredes |
| Diagnóstico/correção de infiltração em janela | 02 | Exemplo do Skill — janela, vedação, peitoril/rejunte |
| Manutenção de forro de gesso | 03 | Exemplo do Skill — recuperação de trechos danificados |
| Serviço de rufo em cobertura envidraçada | 04 | Exemplo do Skill — extensão com vidro, instalação/correção a confirmar |
| Troca de lâmpada e verificação do ponto | 05 | Exemplo do Skill — reparo adicional depende de diagnóstico |
| Revisão de acabamentos elétricos | 05 | Exemplo do Skill — tomadas, interruptores e espelhos |
| Inspeção elétrica geral | 05 | Exemplo do Skill — revisão geral por verba/inspeção |
| Troca de guarnição de porta | 08 | Exemplo do Skill — alisar/guarnição |
| Pintura geral externa | 01 | XLSX 002 e PDF oficial — escopo externo, locais a confirmar |

Nenhum serviço genérico de impermeabilização de banheiro foi inventado para satisfazer o exemplo de busca. Esse serviço pode ser fornecido por cadastro/importação legítima da usuária. Fixtures isoladas usam descrições explícitas de teste, sem validade oficial/comercial.

## Migration 0031 e modelo

`0031_bases_servicos.sql` é aditiva à 0030:

| Estrutura | Uso |
|---|---|
| `bases_referencia` | edição identificada por nome/tipo/competência/UF/versão/regime; metadados de origem/data e ativação |
| `base_itens` | código, descrição, unidade, preço nullable em centavos, tipo, classificação, etapa opcional, categorias, tags, observações e assinatura normalizada |
| `bases_importacoes` | arquivo/hash, edição, total esperado, quantidade de lotes, criador, situação e conclusão |
| `bases_importacao_lotes` | recebimento idempotente de lotes normalizados, com hash de conteúdo calculado no servidor |
| Novas colunas da biblioteca | índice textual normalizado e data da última edição |

Não há carga automática de SINAPI/SICRO, base proprietária, scraping ou conexão com OrçaFascio. A produção não recebe bases de referência de exemplo, itens importados de demonstração nem preços fictícios.

Índices: base/tipo/competência/UF/ativação; itens por base/etapa/unidade/ID; identidade única `(base_id,codigo,tipo,classificacao)`; arquivo único por base entre importações não canceladas; apenas uma importação em preparação por base. Tipo/classificação fazem parte da identidade porque códigos podem existir em mais de uma classe de registros.

Itens publicados da base são imutáveis, protegidos por triggers contra UPDATE/DELETE. Alteração de preço/descrição exige nova edição. Inativação é feita na base, preservando histórico e referências. Competência/UF/versão/regime não são sobrescritos pelo endpoint de ativação.

## Importação XLSX

Fluxo implementado em Configurações → Bases de Serviços:

1. Criar/selecionar uma edição com origem legítima e metadados conferidos.
2. Selecionar XLSX; leitura ocorre no navegador. Upload não grava arquivo ou itens em D1/R2.
3. Escolher aba e linha de cabeçalho; sugestões de mapeamento são revisáveis.
4. Mapear código, descrição, unidade e campos opcionais de preço, tipo, classificação, etapa, categoria/subcategoria, tags e observações.
5. Escolher explicitamente formato brasileiro ou decimal para preços textuais e tipo quando não mapeado.
6. Prévia validada pelo servidor, somente leitura: novos/existentes/alterados/inválidos, valores interpretados e primeiras linhas.
7. Apenas Confirmar e importar inicia o recebimento dos lotes.
8. Publicação atômica do conjunto completo; nenhum lote incompleto aparece na busca.

Cadastro manual de item da base usa a mesma prévia/confirmação, sem publicar automaticamente na Biblioteca semântica VOIA.

Limites: XLSX de até 20 MiB; até 50 mil linhas por aba, 64 colunas e 600 mil células no conjunto; XML de até 30 MiB por parte e 60 MiB descompactados. Leitura ZIP incremental, medindo bytes realmente emitidos, rejeitando caminhos indevidos, macros/links externos identificados, partes duplicadas, XML externo/entidades, UTF-8 inválido e texto com indícios de mojibake. Macros, HTML e fórmulas não são executados. Fórmulas nos campos mapeados exigem fornecimento prévio de valores conferidos.

Lotes são definidos por quantidade e tamanho: até 200 linhas e aproximadamente 700 KB normalizados, abaixo do limite HTTP de 1 MB; o servidor aceita no máximo 500 linhas por lote. Não há request individual por registro. O servidor valida novamente schema, números, sessão, propriedade, relação base/importação, sequência e hashes. SHA do arquivo identifica reimportações; o servidor também calcula assinaturas dos itens e hashes dos lotes recebidos, sem presumir que recebeu os bytes originais do arquivo.

Recebimento repetido do mesmo lote é idempotente; conteúdo divergente é recusado. Arquivo concluído na mesma edição é informado como já importado. Arquivo diferente com itens iguais conta como existente, sem duplicar. Itens alterados exigem nova edição; não são silenciosamente sobrescritos. Duplicatas entre lotes, lotes ausentes ou total divergente impedem a publicação inteira. Sessão cancelada permanece auditável e permite nova tentativa do mesmo arquivo.

Referências SINAPI/SICRO são suportadas como bases importadas por mapeamento, sem presumir um layout oficial único. Arquivos com competências/UF/regimes mistos devem ser separados/mapeados por edição e coluna de preço apropriada. Competência, UF e regime são metadados da base, exibidos antes de confirmar; não são inferidos de descrições ou nomes de arquivo.

Preços conhecidos preservam zero explicitamente. Ausência permanece NULL/Sem preço. Separadores textuais incompatíveis com o formato selecionado são recusados. Mais de duas casas decimais são recusadas, inclusive em células numéricas, em vez de arredondar silenciosamente uma referência de maior precisão.

## Busca unificada e experiência aprovada

O editor tabular não foi redesenhado. O botão Biblioteca VOIA agora abre busca server-side sobre a biblioteca ativa e todas as bases ativas importadas/cadastradas.

- Pesquisa em código, nome/descrição, categorias, subcategorias, tags e escopo sem exigir acentos ou caixa exata; termos relevantes precisam ocorrer no índice textual.
- Filtros compactos por fonte, etapa, categoria, unidade, competência e UF.
- A etapa selecionada na planilha prioriza resultados correspondentes; não oculta automaticamente referências sem etapa classificada.
- Página limitada a 30 resultados, sem carregar dez mil registros no frontend.
- Debounce de 250 ms e AbortController evitam requisições por tecla e respostas obsoletas.
- Fonte, código, unidade, edição, competência/UF/regime e preço conhecido ficam explícitos. Sem preço não é exibido como R$ 0,00.
- Gestão em Configurações separada da Obra: lista de bases, criação, importação, consulta paginada (50 itens), ativação/inativação e manutenção da biblioteca semântica.

A busca usa texto normalizado e filtros/índices relacionais; não usa IA nem presume equivalência semântica entre serviços. Não há FTS externo ou carga de base inteira no cliente. Testes incluem 12 mil referências publicadas e resultados paginados.

## Inserção e rastreabilidade

Ao selecionar, a linha recebe snapshot de `fonte`, `base_id`, `item_id`, código/descrição/unidade originais, base/versão, origem, competência, UF, regime/data, tipo/classificação e preço de referência. Quantidade e preço adotado começam vazios.

O detalhe técnico mostra a referência preservada e o preço adotado separadamente. A ação Adotar preço de referência é explícita; a usuária pode definir outro preço da obra. Alterar serviço, unidade, escopo, ambiente, memória ou preço adotado não altera a fonte.

O servidor confere a referência com o catálogo, não apenas os IDs ou valores enviados pelo navegador. Referência original de item já salvo é imutável. Itens históricos continuam salváveis após inativação da fonte; duplicação de uma planilha real preserva sua referência histórica sem fabricar uma referência nova. Snapshots da 0030 continuam imutáveis.

Itens e snapshots anteriores sem `referencia_origem` permanecem compatíveis. O formato e os campos históricos da exportação XLSX foram preservados. O rastreamento detalhado permanece no item/snapshot interno; não foi acrescentada nova aba de referências ao XLSX aprovado nesta rodada.

## Permissões e segurança

- Admin: administra bases/importações/biblioteca e usa o catálogo.
- Gestor: consulta bases/biblioteca e utiliza a busca na planilha; não edita o catálogo global.
- Parceiro/visualizador/portal: não ganham acesso global. As permissões existentes de Obras e Projetos não foram alteradas.
- Sessões de importação só recebem lotes, publicação/cancelamento pelo criador autorizado; trocar a base no path não libera outra importação.
- Planilha/Obra/Projeto continuam validados na cadeia existente; referências não substituem esse controle.
- Não há exclusão física de serviços utilizados nem itens publicados de bases.

## Endpoints

Prefixo novo: `/api/catalogo-servicos`.

- `GET /busca` — busca unificada e paginação.
- `GET/POST /bases` — listar/criar edição.
- `PATCH /bases/:base` — ativar/inativar.
- `GET /bases/:base/itens` — consultar itens paginados.
- `POST /bases/:base/previa` — comparar lote sem gravação.
- `POST /bases/:base/importacoes` — iniciar/retomar importação após confirmação.
- `PUT /bases/:base/importacoes/:importacao/lotes/:seq` — receber lote idempotente.
- `POST /bases/:base/importacoes/:importacao/concluir` — publicação atômica.
- `POST /bases/:base/importacoes/:importacao/cancelar` — cancelar preparação.
- `GET/POST /biblioteca`, `PUT /biblioteca/:item` — consulta/manutenção semântica.

Endpoints anteriores de Planilhas permanecem; sua validação foi ampliada para preservar a origem. O cadastro explícito anterior na Biblioteca também mantém o campo de busca normalizado.

## Validação e limitações

Testes novos cobrem busca, acentos, fonte, etapa, base própria/importada, preço ausente/zero, competência/UF, deduplicação/reimportação, lotes, 12 mil registros, perfis, ownership/IDOR, inserção/snapshot, preço adotado separado e fontes inativas. UI cobre XLSX real, mapeamento, upload sem persistência, prévia/confirmação, formatos numéricos, arquivo inválido/entidades e limites.

Resultados: **222 testes Worker, 135 testes UI, 357 aprovados** (25 arquivos Worker e 12 UI). São 20 testes Worker e 11 UI novos. Após backup e aplicação local, os testes afetados foram repetidos: 39 Worker de Bases/Planilhas e 25 UI de Bases/Planilhas, todos aprovados. As suítes completas preservam as regressões existentes de Planilhas, exportação XLSX, Obras, Gantt, RDO, fotos e Projetos.

`npm.cmd run test:typecheck`, `npx.cmd tsc -b --pretty false`, `npm.cmd run lint`, `npm.cmd run build` e `git diff --check` passaram. UTF-8: **262 arquivos**, zero inválidos e zero ocorrências de mojibake. Permanecem apenas os avisos preexistentes do bundle principal e anotações de Zod. Nenhuma dependência ou lockfile foi alterado.

Revisão visual com componentes reais e transporte local mockado: 1920×1080, 1366×768, 1024×1366 e 375×812. Conferidos busca/filtros/resultados, inserção, referência/adotar preço e Configurações. Uma fixture XLSX real foi selecionada, lida e mapeada visualmente; a confirmação completa também possui teste automatizado. Capturas em `.wrangler/bases-auditoria/`, ignorado pelo Git. Nenhum dado real foi usado para demonstração.

Limitações deliberadas: somente XLSX (sem CSV); sem parser oficial específico SINAPI/SICRO, download ou atualização automática; sem editor de composições; preços limitados a centavos; sem execução de fórmulas; metadados por edição; numeração formatada no Excel deve ser conferida na prévia e códigos com zeros significativos devem ser fornecidos como texto. Não há transformação automática de serviços da base em biblioteca semântica. O gerenciamento da biblioteca semântica pequena é listado integralmente; bases grandes e busca são paginadas. Importação interrompida pode ser retomada reenviando o mesmo arquivo/mapeamento pelo criador; não existe job em segundo plano após fechar o navegador.

## Operação

Backup novo anterior à 0031: `.wrangler/backups/voia-db-pre-0031-2026-10-27T03-45-18-786Z.sql`, **461.934 bytes**, SHA-256 `36278d3419ab51c31be9ed942f687295c6e505550e3d52bddece35baff5eafe1`.

Backup restaurado em memória, integridade e FKs válidas. A 0031 foi aplicada sobre essa cópia isolada e na instância Wrangler local exclusiva `.wrangler/planilhas-local-0030`. Os testes afetados passaram novamente depois disso.

A revisão automática inicialmente bloqueou a execução remota; a usuária então autorizou explicitamente a migration 0031 e o deploy após conferência. A 0031 foi aplicada remotamente com sucesso em 26/10/2026 (horário de Cuiabá), sem alterar a 0030.

Exportação posterior de conferência: `.wrangler/backups/voia-db-pos-0031-2026-10-27T03-49-26-959Z.sql`, 477.131 bytes, SHA-256 `6c9240b135a7741efb79732de6fa555ca071be644d9dbca9538ef5ca31107529`.

Conferência remota: integridade ok, zero violações de FK, hashes e contagens preservados em **29 tabelas de negócio**, comparando na biblioteca os campos/IDs originais. Somente os nove serviços previstos e as novas colunas foram acrescentados à biblioteca. Produção: **28 → 37 serviços**, **zero bases de referência** e **zero itens importados de demonstração**. Obras, Yara, planilhas reais, snapshots anteriores, documentos e financeiro preservados. R2 não foi escrito/removido nesta rodada. Backups anteriores não foram sobrescritos.

Não houve push, commit, troca de branch, reset, npm audit fix ou --force.

Build de produção repetido imediatamente antes de `npm.cmd run deploy`; deploy concluído com sucesso em **26/10/2026**, sem alteração funcional posterior.

- Worker existente: `voia-app`.
- URL mantida: https://voia-app.bbrazgarcia.workers.dev
- **Version ID: `1dbdc463-e104-4ad2-bdf4-ca7a0122166d`**.
- Smoke após deploy: login/configuração SPA/health/assets 200; health saudável; HTML corresponde ao hash do build final; busca, bases, biblioteca e planilhas sem sessão retornam 401 JSON.
- A validação autenticada com arquivos reais fica para a usuária. Não foram importadas bases nem criados itens/planilhas de demonstração em produção.

Bindings conferidos no build e preservados na publicação: `DB → voia-db` (`217f7490-d357-4c36-827f-afd54589adb9`) e `DOCUMENTOS_BUCKET → voia-documentos`; mesmo domínio e Worker.

## Arquivos desta rodada

Novos nesta rodada:

- `docs/RELATORIO-BASES-SERVICOS.md`
- `migrations/0031_bases_servicos.sql`
- `src/shared/bases-servicos.ts`
- `src/worker/bases/catalogo.ts`
- `src/worker/bases/routes.ts`
- `src/react-app/components/BuscaCatalogoServicos.tsx`
- `src/react-app/components/ImportarBaseServicos.tsx`
- `src/react-app/lib/catalogo-api.ts`
- `src/react-app/lib/importar-base-xlsx.ts`
- `src/react-app/pages/BasesServicos.tsx`
- `src/react-app/styles/bases-servicos.css`
- `test/bases-servicos.test.ts`
- `test/ui/bases-servicos.test.tsx`

Alterados nesta rodada (inclusive arquivos ainda não commitados da rodada anterior):

- `src/react-app/App.tsx` — rota protegida, carregada sob demanda.
- `src/react-app/layouts/AppShell.tsx` — acesso a Bases de Serviços para Admin/Gestor.
- `src/react-app/components/ObraPlanilhasPanel.tsx` — busca unificada e referência preservada no detalhe; grade aprovada mantida.
- `src/shared/planilhas.ts` — snapshot de origem opcional e compatível com registros anteriores.
- `src/worker/obras/planilhas.ts` — validação da referência e compatibilidade com fontes históricas/inativas.
- `src/worker/index.ts` — registro das rotas do catálogo.
- `test/ui/planilhas-obra.test.tsx` — mock atualizado para a busca server-side.

Os demais arquivos da rodada anterior permanecem na working copy; 0030, exportador XLSX, CSS da grade e relatório anterior foram preservados. Artefatos auxiliares e backups estão em `.wrangler/`, já ignorado pelo Git.

## Git status final acumulado das duas rodadas

```text
 M src/react-app/App.tsx
 M src/react-app/layouts/AppShell.tsx
 M src/react-app/pages/ObraWorkspace.tsx
 M src/worker/index.ts
?? docs/RELATORIO-BASES-SERVICOS.md
?? docs/RELATORIO-PLANILHAS-OBRA.md
?? migrations/0030_planilhas_obra.sql
?? migrations/0031_bases_servicos.sql
?? src/react-app/components/BuscaCatalogoServicos.tsx
?? src/react-app/components/ImportarBaseServicos.tsx
?? src/react-app/components/ObraPlanilhasPanel.tsx
?? src/react-app/lib/catalogo-api.ts
?? src/react-app/lib/importar-base-xlsx.ts
?? src/react-app/lib/planilha-xlsx.ts
?? src/react-app/pages/BasesServicos.tsx
?? src/react-app/styles/bases-servicos.css
?? src/react-app/styles/planilhas.css
?? src/shared/bases-servicos.ts
?? src/shared/planilhas.ts
?? src/worker/bases/
?? src/worker/obras/planilhas.ts
?? test/bases-servicos.test.ts
?? test/planilhas-obra.test.ts
?? test/ui/bases-servicos.test.tsx
?? test/ui/planilhas-obra.test.tsx
```

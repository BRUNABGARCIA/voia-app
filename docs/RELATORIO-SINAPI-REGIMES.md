# SINAPI: referência única e preços por regime

## Estado e auditoria inicial

Rodada realizada em 28/10/2026 na pasta `C:\Users\Bruna Braz Garcia\Downloads\voia-app-visual-v2\voia-app`, branch `claude-modelos-processos-v2`, HEAD `ef02379` (`adiciona planilhas de obra e bases de servicos`). O Git estava limpo. Não houve troca de branch, reset, commit ou push.

Foram inspecionados a migration 0031, os schemas de bases/itens/biblioteca/planilhas, os endpoints do catálogo e de planilhas, BuscaCatalogoServicos, ImportarBaseServicos, BasesServicos, ObraPlanilhasPanel e o exportador XLSX. Na estrutura anterior, `regime` pertencia à base inteira e era copiado para o snapshot; o item possuía apenas `preco_centavos`. Itens de referência já eram imutáveis, a Biblioteca VOIA era independente e os itens de planilha já preservavam referências históricas em JSON. Essa arquitetura foi evoluída, sem criar outro catálogo.

## Modelagem e migration 0032

`migrations/0032_sinapi_regimes.sql` foi ensaiada localmente e **aplicada em produção em 28/10/2026, após autorização explícita da usuária**. É aditiva:

- Acrescenta `preco_nao_desonerado_centavos` e `preco_desonerado_centavos`, opcionais, positivos e em centavos, em `base_itens`.
- Acrescenta `metadados`, JSON opcional, limitado a 12 mil caracteres.
- Acrescenta índice por base, tipo e código.
- Acrescenta triggers para impedir novas bases SINAPI separadas por regime na mesma competência/UF/versão e impedir repetir código/tipo na mesma base SINAPI, mesmo mudando a classificação.

Não remove, recria ou renomeia tabelas, não atualiza registros existentes e não modifica 0030/0031. Os triggers anteriores de imutabilidade continuam presentes. Bases SINAPI legadas são preservadas; novas bases usam `regime` vazio. Uma edição é identificada por fonte SINAPI + competência + UF + versão, independentemente do nome e do regime. Dentro da edição, a identidade é código + tipo; a classificação original é metadado. Nova edição/competência não altera itens usados anteriormente.

Outras fontes mantêm preço único opcional, inclusive zero explícito, ou nenhum preço. Não exigem dois regimes. Os campos adicionais são opcionais e não substituem a estrutura genérica. Preços SINAPI importados zerados, vazios ou com hífen são tratados como indisponíveis; o valor bruto original permanece nos metadados.

## Importação oficial e genérica

Foi lido o arquivo real `SINAPI_Referência_2026_09.xlsx` dentro do ZIP local fornecido em Downloads. A estrutura real possui Menu, Busca, ISD, ICD, ISE, CSD, CCD, CSE, Analítico e Analítico com Custo.

O fluxo existente de cadastrar/selecionar base e importar XLSX permanece. Fonte, UF e competência pertencem à edição selecionada. Para fonte SINAPI, o upload detecta as abas oficiais e oferece seleção de entidade:

- Composições: CSD (sem desoneração) + CCD (com desoneração).
- Insumos: ISD + ICD, sem transformar insumo classificado como serviço em composição.

Cada entidade pode ser importada separadamente na mesma base. O hash da sessão oficial inclui arquivo, entidade, UF e competência, permitindo importar ambos sem confundir sessões. O leitor valida título, regime, competência, cabeçalho e UF, seleciona a coluna da UF em cada aba e combina os registros por código. Divergência de descrição/unidade entre regimes, duplicidade na mesma aba ou preço inválido bloqueiam a confirmação. Código, tipo, unidade, classificação/grupo, origem do preço dos insumos, percentual AS das composições, linha de origem e preço bruto são preservados quando disponíveis.

O leitor descompacta apenas workbook/relações/strings e as abas selecionadas. Abas analíticas, fórmulas de cálculo e outras UFs não se tornam itens. As fórmulas HYPERLINK dos códigos oficiais são reconhecidas por uma estrutura estrita, com o mesmo código literal em MATCH e no texto apresentado. O cache zero usado pelo arquivo oficial não vira código zero: extrai-se o literal validado, sem avaliar a fórmula. Cache divergente não nulo e fórmulas de preço são recusados. Não há execução de fórmulas, macros ou referências externas.

O importador genérico/manual foi preservado e ganhou mapeamento opcional dos dois preços. Para SINAPI, o backend exige tipo composição/insumo, código numérico canônico, preço único nulo e campos de regime explicitamente informados (inclusive nulos). Erros não são ignorados. Upload/leitura/prévia não publicam itens; apenas Confirmar inicia a importação em lotes.

Resultado do arquivo real, somente em memória, MT, 09/2026:

| Entidade | Referências únicas | Com ambos os preços | Linhas inválidas |
|---|---:|---:|---:|
| Composições | 10.599 | 8.443 | 0 |
| Insumos | 4.878 | 3.433 | 0 |

Nenhum desses registros foi importado em produção. A interface local também reconheceu o upload real e exibiu a prévia, utilizando backend simulado para a revisão visual. As contagens de importação efetiva são verificadas nos testes Worker, e não no mock visual.

## Seleção, preço adotado e histórico

A busca identifica fonte, código, tipo, UF, competência e ambos os preços SINAPI. Ausência aparece como traço. Referência legada com preço único continua identificada e preservada; não recebe um segundo preço inferido.

Adicionar SINAPI abre o detalhe do item. O seletor Regime de referência começa em Escolher regime, sem decisão automática. A referência aparece no início do detalhe, sem redesenhar a grade. O controle anterior de mão de obra continua independente e foi identificado visualmente como Contratação.

O snapshot preserva fonte/tipo de fonte, IDs, código, descrição, unidade, competência, UF, versão, origem, preços originais, metadados e regime legado quando existente. `regime_escolhido` e `preco_referencia_centavos` representam a utilização. `valor_unit_centavos` continua sendo exclusivamente o preço adotado pela obra.

Trocar o regime recalcula apenas a referência selecionada; não altera o preço adotado, a base ou o outro preço. Adotar preço de referência é uma ação explícita e pede confirmação se substituir valor já adotado. Selecionar regime sem preço mantém a referência indisponível e bloqueia a adoção.

O backend autentica a referência na inserção, preserva sua identidade técnica em alterações e valida que o preço selecionado corresponde ao regime. Duplicação de referência histórica inativa continua possível, inclusive mudando o regime usando os preços originais já registrados. Competências posteriores não atualizam snapshots antigos. Itens e snapshots legados sem novos campos continuam válidos.

A exportação mantém as cinco abas existentes e as colunas anteriores. A aba de precificação acrescenta os dados de auditoria, ambos os preços originais, regime escolhido e referência selecionada; o preço adotado permanece na coluna original. Valores ausentes são células vazias. Strings são texto OOXML, sem fórmulas executáveis.

## Busca, performance e reimportação

Busca unificada server-side, tolerância a acentos, tokens, fontes ativas, filtros, prioridade de etapa, debounce, cancelamento e paginação foram preservados. UF/competência filtram as bases, mas não excluem indevidamente a Biblioteca VOIA quando a fonte é Todas ou VOIA. Busca retorna 30 registros por página; consulta de base, 50. Não carrega o catálogo inteiro no frontend.

Importações continuam em lotes adaptativos de até 200 registros/~700 KB, com validação server-side, ownership da sessão, assinaturas, idempotência e publicação atômica. Mesmo arquivo/sessão não duplica registros; mesma referência/assinatura é existente; alteração de conteúdo é conflito e exige nova versão explícita. Não há atualização silenciosa de preço oficial. As identidades continuam distintas entre composição e insumo.

Foram testados 20 mil itens SINAPI com ambos os preços, além do teste anterior de 12 mil itens genéricos. O leitor oficial processa linhas selecionando colunas antes da criação de DOM. Limites: XLSX de 20 MiB, 300 entradas ZIP, 30 MiB por parte selecionada, 64 MiB descompactados por operação, 50 mil linhas por aba. Importar composições e insumos é feito em etapas separadas para manter o uso de memória limitado.

O novo índice ajuda identidade, filtros e conferência. A busca textual continua usando termos normalizados com `instr`, sem alegar busca FTS indexada. FTS e paginação por cursor são possíveis evoluções para volumes muito maiores; não foram necessários para os volumes validados.

## Segurança e preservação

Permanecem middleware de sessão, autenticação e papéis: Administrador administra o catálogo; Gestor consulta; parceiro/visitante não acessam o catálogo global. O acesso à planilha continua derivado da Obra/Projeto, com validação server-side. IDs/ownership de importação, limites de payload, validação de preço e referência e controle de versão continuam ativos. Não foram alteradas regras de financeiro, parceiros, R2, RDO ou outras áreas.

Não foram alterados dados reais de Yara, clientes, projetos, obras, tarefas, documentos, RDO, ocorrências, planilhas ou Biblioteca VOIA. Nenhuma base demo foi criada em produção. Nenhuma dependência foi instalada/atualizada e não foi executado npm audit fix.

## Validação local

- Worker: 233 testes aprovados em 26 arquivos.
- UI: 152 testes aprovados em 13 arquivos, incluindo o teste opcional do arquivo real com `VOIA_SINAPI_REAL` apontando para o ZIP local. Total: 385 aprovados.
- Typecheck dos testes e `tsc -b`: aprovados.
- Lint: aprovado.
- Build de produção: aprovado. Avisos existentes de anotações do Zod e bundle principal acima de 500 KB.
- UTF-8/mojibake: sem ocorrências nos arquivos verificados.
- `git diff --check`: aprovado.
- Revisão visual com dados sintéticos locais: busca em 1920×1080, 1366×768, 1024×1366 e 375×812, além de seleção de regime no detalhe desktop/mobile e reconhecimento/prévia do arquivo real local. Evidências em `.wrangler/sinapi-auditoria/`, ignoradas pelo Git.

O Vite auxiliar da revisão encontrou `EBUSY` ao observar o XLSX temporário extraído. A configuração auxiliar passou a ignorar arquivos XLSX no watcher; a configuração do aplicativo não foi alterada. O arquivo já havia sido lido e a prévia conferida em memória, e o servidor auxiliar foi encerrado. Isso não é uma falha funcional do build de produção.

Os testes cobrem dois regimes sem duplicação, tipos distintos, preços ausentes/zerados, troca de regime, preço adotado, snapshots/forja, histórico inativo, calha/impermeabilização com e sem acento/alvenaria/pintura, filtros/paginação, permissões, lotes grandes, reimportação/conflito, exportação e compatibilidade VOIA/legada.

## Publicação controlada, backup e integridade

Publicação concluída em 28/10/2026, após autorização explícita para aplicar 0032, conferir integridade e publicar no Worker existente.

A autenticação inicial recusada pela Cloudflare (10000) foi renovada com login OAuth da usuária. A conta foi selecionada exclusivamente no ambiente dos comandos: VOIA ENGENHARIA, `87efb254a391405500dd04e8ba5e2e80`. A configuração Wrangler não foi alterada. O Worker existente foi confirmado antes da publicação; a versão ativa anterior à publicação era `cf566264-c522-45f2-8469-4abff8f02177`.

Backup atualizado antes da migration: `.wrangler/backups/voia-db-pre-0032-atualizado-2026-10-28T10-57-32.sql`, 477.131 bytes, SHA-256 `6c9240b135a7741efb79732de6fa555ca071be644d9dbca9538ef5ca31107529`. Foi exportado novamente do D1 após renovar a autenticação e validado em SQLite em memória: integridade OK, zero violações de chave estrangeira. O ensaio local da 0032 preservou os dados das 36 tabelas, incluindo 37 serviços VOIA.

A lista remota confirmou somente 0032 pendente. `wrangler d1 migrations apply voia-db --remote` aplicou 0032 com sucesso, em sete comandos. SELECT posterior confirmou exatamente um registro `0032_sinapi_regimes.sql` e 37 serviços VOIA.

A tentativa de PRAGMA direto no D1 retornou `not authorized: SQLITE_AUTH [7500]`. Para verificar integridade sem depender desse comando restrito, foi imediatamente obtido um export pós-migration e restaurado em memória. Backup pós-0032: `.wrangler/backups/voia-db-pos-0032-2026-10-28T11-11-47.sql`, 478.344 bytes, SHA-256 `82185c018a8c4a28394338dbd039e6fad4f08d76e78af42c88c7cd9e17acf521`.

O export pós-migration apresentou integridade OK e zero violações de chave estrangeira. Hashes e contagens dos dados anteriores permaneceram idênticos nas 35 tabelas comparadas, usando as colunas originais de base_itens. A única exceção esperada foi d1_migrations, que recebeu o registro 0032. Permanecem 37 serviços VOIA, zero bases de referência e zero itens importados. Nenhum dado real ou de demonstração foi inserido.

Antes do deploy foram repetidos os 385 testes (233 Worker + 152 UI, incluindo arquivo real local), typecheck, lint e UTF-8. Todos passaram. O build de produção foi executado novamente imediatamente antes do comando de deploy e passou, com os avisos já documentados.

Publicação no Worker existente `voia-app`, URL preservada `https://voia-app.bbrazgarcia.workers.dev`, **Version ID `989504d9-1db2-49b8-ab78-1fb11c7973c6`**. Bindings confirmados na saída do deploy: `DB → voia-db` (`217f7490-d357-4c36-827f-afd54589adb9`) e `DOCUMENTOS_BUCKET → voia-documentos`. Nenhum Worker novo foi criado.

Smoke tests pós-deploy: 12 verificações GET aprovadas. Login e rota SPA de Bases retornam HTML do build atual; health retorna status OK e D1 conectado; quatro APIs protegidas retornam 401 sem sessão; entry JS e quatro assets do módulo retornam 200. Os smoke tests não criaram sessão, registros ou dados de demonstração. O fluxo de importação autenticada com escrita foi testado exclusivamente em fixtures/banco de teste, sem importar SINAPI real em produção.

Evidências locais, ignoradas pelo Git: `.wrangler/sinapi-auditoria/backup-atualizado-verificado.json`, `pos-0032-verificado.json` e `smoke-pos-deploy.json`.

Não houve commit ou push. Nenhuma alteração adicional no código da aplicação foi realizada depois do deploy; somente este relatório recebeu os resultados finais. A importação da base SINAPI real em produção continua aguardando autorização específica.

## Arquivos desta rodada

Criados: `migrations/0032_sinapi_regimes.sql`, `src/react-app/lib/importar-sinapi.ts`, `test/sinapi-regimes.test.ts`, `test/ui/sinapi-regimes.test.tsx` e este relatório.

Alterados: `src/shared/bases-servicos.ts`, `src/shared/planilhas.ts`, `src/worker/bases/catalogo.ts`, `src/worker/bases/routes.ts`, `src/worker/obras/planilhas.ts`, `src/react-app/components/BuscaCatalogoServicos.tsx`, `src/react-app/components/ImportarBaseServicos.tsx`, `src/react-app/components/ObraPlanilhasPanel.tsx`, `src/react-app/lib/importar-base-xlsx.ts`, `src/react-app/lib/planilha-xlsx.ts`, `src/react-app/pages/BasesServicos.tsx` e `test/bases-servicos.test.ts`.

## Limitações e próximos passos

O reconhecimento específico cobre a estrutura efetivamente inspecionada do arquivo SINAPI 09/2026. Mudanças oficiais de layout precisam ser reconhecidas e validadas, ou usar mapeamento genérico explícito; abas analíticas e regimes sem encargos sociais não foram implementados como referências desta rodada. Não houve download automático, integração proprietária ou importação real em produção.

SICRO/SBC continuam utilizando o fluxo genérico quando compatível, sem importadores específicos completos. Seus modelos regionais e tipos próprios podem evoluir através de metadados/novas estruturas opcionais, sem exigir dois preços nem converter essas bases em Biblioteca VOIA.

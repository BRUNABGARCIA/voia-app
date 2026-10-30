# Validação da importação SINAPI MT 09/2026

## Resultado local e publicação autorizada

Rodada de 30/10/2026, branch `claude-modelos-processos-v2`, base `7e6c50e`. O parser foi corrigido, e a conferência independente de todos os valores MT das quatro abas apresentou **zero falsos NULL, zero preços inventados e zero divergências de valor**. O ensaio completo foi aprovado exclusivamente em cópia local do backup de produção.

**Após a autorização explícita posterior da usuária, a base real foi importada e as correções foram publicadas em 30/10/2026.** Worker existente `voia-app`, Version ID `18f3d00b-a551-4aa8-98d3-6c289a8d0cec`, URL `https://voia-app.bbrazgarcia.workers.dev`. Não houve migration, dados demo, alteração de dados reais anteriores, commit ou push. As seções seguintes documentam o ensaio que antecedeu a autorização; a conferência de produção consta no final.

## Backup e identificação da fonte

Backup atualizado gerado na etapa de auditoria: `.wrangler/backups/voia-db-pre-importacao-sinapi-2026-10-30T14-14-21.sql`, 478.344 bytes, SHA-256 `82185c018a8c4a28394338dbd039e6fad4f08d76e78af42c88c7cd9e17acf521`.

O export confirmou a migration 0032, integridade OK, zero violações de FK, 37 serviços VOIA, zero bases e zero itens de referência importados. A planilha e os registros reais existentes não foram usados para o teste. A configuração continua com `DB → voia-db` e `DOCUMENTOS_BUCKET → voia-documentos`.

Fonte original: `C:\Users\Bruna Braz Garcia\Downloads\SINAPI-2026-09-formato-xlsx.zip`, SHA-256 `feef29cd107f4bdde9bc10ba03d71eb4d8b6b2e0e95fe9020c4fe72aabe2a04c`. A extração de `SINAPI_Referência_2026_09.xlsx` é idêntica à cópia anterior, SHA-256 `9f1a69dfbe103bdaecb39b871a74435c364b4e6652fdbc677d8537e6742cf0d2`.

O XLSX foi novamente lido do zero. Não foram forçados os totais da rodada anterior. As cópias e evidências contêm dados de auditoria e ficam em `.wrangler/importacao-sinapi-2026-09/`, ignorada pelo Git.

## Correção estrutural do parser

O defeito anterior foi confirmado em 339 insumos/678 preços. A expressão de extração de células podia consumir uma célula vazia junto com a seguinte e descartar o preço MT. A validação anterior por contagens era insuficiente.

O parser agora usa DOM XML para cada linha completa. Cada célula é associada exclusivamente ao endereço `r` do XLSX; não usa a posição sequencial das células presentes. Só após resolver os endereços são filtradas as colunas desejadas. Células autocontidas e células omitidas não deslocam valores. Endereços duplicados, inválidos, fora da linha ou do limite são recusados, assim como índices inválidos de shared strings e valores numéricos inválidos. Fórmulas continuam sem execução e com as restrições anteriores.

O código 39577 (AR-CONDICIONADO FRIO SPLITAO MODULAR 10 TR, UN) preserva **3.136.759 centavos = R$ 31.367,59** tanto em ISD quanto em ICD. O padrão original era uma célula Q265 vazia imediatamente antes do valor em R265 (MT).

Sete regressões adicionais cobrem ISD/ICD e CSD/CCD, célula anterior vazia ou omitida, código 39577, valor monetário exato, shared strings, célula MT realmente ausente e zero numérico bruto.

### Zero versus ausência

Na fonte real, CSD e CCD contêm 2.156 valores numéricos zero por aba. A legenda oficial define custo zerado como referência sem custo/preço de pelo menos um componente. Esses valores continuam normalizados como preço indisponível, com **zero bruto preservado nos metadados**, distinto de célula ausente. Em ISD/ICD não há zero MT: há 1.106 células sem valor por aba. Um zero genérico legítimo continua sendo zero no conversor de preço; não foi alterada essa regra nem a modelagem de outras bases.

## Nova comparação independente completa

Foi usado openpyxl sobre o XLSX original, sem reutilizar a extração XML do parser JavaScript. Foram verificados todos os códigos, descrições, unidades, tipos, preços MT, UF, competência e conjuntos de pareamento de CSD/CCD e ISD/ICD. A comparação também registra uma amostra distribuída no início, quartos e final de cada aba, incluindo 39577. Não se limita a amostra ou contagem.

| Aba | Linhas | Preços esperados | Preços obtidos | Falsos NULL | Preços inventados | Divergências de valor |
|---|---:|---:|---:|---:|---:|---:|
| CSD | 10.599 | 8.443 | 8.443 | 0 | 0 | 0 |
| CCD | 10.599 | 8.443 | 8.443 | 0 | 0 | 0 |
| ISD | 4.878 | 3.772 | 3.772 | 0 | 0 | 0 |
| ICD | 4.878 | 3.772 | 3.772 | 0 | 0 | 0 |

| Entidade | Total | Ambos os preços | Só não desonerado | Só desonerado | Nenhum preço |
|---|---:|---:|---:|---:|---:|
| Composições | 10.599 | 8.443 | 0 | 0 | 2.156 |
| Insumos | 4.878 | 3.772 | 0 | 0 | 1.106 |

Duplicidades, linhas inválidas e divergências de descrição/unidade/tipo: zero. Os conjuntos de códigos correspondentes entre regimes são idênticos. Nenhum preço MT existente foi convertido para NULL e nenhuma ausência ganhou preço. O total de 3.772 foi recalculado da fonte, sem simplesmente acrescentar 339 ao resultado antigo.

## Ensaio local completo e desempenho

O backup foi restaurado em um SQLite isolado do Miniflare, usando o Worker real compilado. Foi usada a API real para prévia, sessões de importação, lotes, conclusão, reimportação, busca e planilha. A restauração direta no arquivo SQLite local evita o limite de tamanho de instrução de alguns INSERTs do export. Isso não é uma restauração/importação remota.

Antes de qualquer importação local, o helper exige que a comparação independente termine sem divergências. A importação criou **uma única base SINAPI MT 09/2026**, com 10.599 composições e 4.878 insumos, sem mistura de tipos ou regimes.

- Composições: 53 lotes, 10.599 novos. Repetição do mesmo arquivo reconhecida. Nova sessão com os mesmos itens: zero novos e 10.599 existentes.
- Insumos: 25 lotes, 4.878 novos. Repetição do mesmo arquivo reconhecida. Nova sessão com os mesmos itens: zero novos e 4.878 existentes.
- As prévias de reimportação identificaram todos os itens como iguais, sem alterações ou conflitos.
- Integridade final: OK; violações de FK: zero.
- Todas as linhas originais das **36 tabelas** foram comparadas com o backup e preservadas. Os 37 serviços VOIA permanecem idênticos.
- Os 15.477 registros persistidos tiveram preços, descrições e unidades novamente comparados com o resultado validado do parser.
- Uma identidade, cliente, projeto, obra e planilha de teste foram criados apenas na cópia isolada. Não foi usada a obra Yara. As fixtures de projeto não consomem o contador original copiado do backup.
- Foi salva uma cópia SQLite local final em `copia-local-validada.sqlite`.

### Ajuste de desempenho necessário

O ensaio de reimportação real revelou que o planner SQL escolhia percorrer todos os itens existentes antes de expandir os lotes JSON, produzindo trabalho multiplicativo. A junção de conferência de assinaturas foi mudada para CROSS JOIN com as mesmas condições, fixando a ordem lote → item JSON → busca pelo índice único (base, código, tipo, classificação). Não muda permissões ou regras de conflito/idempotência e não exige migration.

Na execução final, prévias + importação + verificação/reimportação completa levaram aproximadamente **2.995 ms para composições e 1.178 ms para insumos** no ambiente local. A leitura do arquivo levou aproximadamente 10 segundos para composições e 3,2 segundos para insumos, com liberações periódicas da interface. São medições locais, não garantia de latência em produção. O teste automatizado de 20 mil referências agora também publica uma segunda sessão idêntica, exigindo zero novas linhas.

## Busca, filtros, planilha e XLSX

As quatro consultas `calha`, `impermeabilização`, `alvenaria` e `pintura` retornaram resultados oficiais. Em cada primeira página foram conferidos código/tipo, descrição, unidade, fonte SINAPI, MT, 09/2026 e ambos os preços diretamente contra os itens da fonte validada. A consulta sem acento retornou os mesmos IDs. Paginação foi testada sem repetição entre páginas.

Filtros por SINAPI, Composição, Insumo, MT e competência passaram. O filtro de tipo adicionado na etapa anterior foi mantido. Serviço continua disponível para a Biblioteca VOIA genérica; Composição e Insumo são distintos na fonte SINAPI.

Em planilha local, um item real de calha foi adicionado via API; o snapshot preservou código, unidade, descrição, competência, UF e ambos os preços. Foi selecionado não desonerado, alterado para desonerado, definido preço adotado manual de R$ 987,65 e alterado o regime novamente. O preço adotado permaneceu R$ 987,65 em todos os salvamentos. A referência selecionada acompanhou exclusivamente o regime.

A exportação XLSX preservou as cinco abas e os dados de rastreabilidade. Além da inspeção do XML, openpyxl conferiu independentemente os dois preços originais, regime selecionado, preço de referência, preço adotado, competência, UF e código original. Não foram geradas fórmulas executáveis.

## Teste temporal da Yara

A falha não foi causada pelo filtro SINAPI ou pelo parser. A rota de calendário existente usa SQLite `date('now','-14 days')` até `date('now','+60 days')`; não utiliza os parâmetros inicio/fim enviados pelo teste. Em 30/10/2026, a vistoria de 15/10/2026 já está fora dessa janela. O teste envelhecia conforme a data atual.

Foi alterado **somente o teste**: a expectativa da vistoria histórica agora considera a janela calculada pelo próprio banco, mantendo todas as cinco datas da fixture e a confirmação de que não cria Obra. Um teste adicional garante inclusão em exatamente -14 dias e exclusão em -15 dias. Não foi alterado código funcional do calendário nem qualquer dado real da Yara.

## Interface

Revisão local usando dados reais importados na cópia e a API real, sem mock de resultados: busca em 1920×1080, 1366×768, 1024×1366 e 375×812; base única em Configurações; referência 39577 no detalhe e escolha de regime. Preços ausentes seguem como traço. Biblioteca VOIA continua separada.

Apenas os ajustes mínimos foram feitos: seletor/rótulos de tipo, sete filtros alinhados no desktop e quebra de textos longos da origem no detalhe. Grade da planilha, Gantt e demais áreas não foram redesenhados. A consulta da tabela de bases continua com rolagem horizontal no mobile, conforme o layout existente. As capturas ficam na pasta de auditoria ignorada pelo Git.

## Validação técnica final

- Worker: **235 aprovados**, 26 arquivos.
- UI: **160 aprovados**, 14 arquivos, incluindo o arquivo real local.
- Total: **395 testes aprovados**, nenhum teste ignorado nessa execução completa.
- Regressões específicas de colunas: sete aprovadas; testes Worker específicos SINAPI e Rodada 3 também executados isoladamente e aprovados.
- Build de produção local: aprovado. Mantém avisos anteriores de anotações do Zod e bundle principal acima de 500 KB.
- Typecheck e lint: aprovados.
- UTF-8/mojibake e git diff --check: aprovados.
- Conferência independente: zero falsos NULL, zero preços inventados e zero divergências de valor nas quatro abas.

## Arquivos alterados/criados

- `src/react-app/lib/importar-sinapi.ts`: leitura estrutural por endereço XML e validação de células.
- `src/worker/bases/routes.ts`: filtro de tipo e ordem eficiente da junção de reimportação.
- `src/react-app/components/BuscaCatalogoServicos.tsx`: seletor de tipo e rótulos.
- `src/react-app/styles/bases-servicos.css`: acomodação dos sete filtros e quebra de origem longa.
- `test/ui/sinapi-colunas.test.tsx`: novo arquivo de regressões.
- `test/ui/bases-servicos.test.tsx`: envio do filtro de tipo.
- `test/sinapi-regimes.test.ts`: filtro e reimportação grande sem duplicar.
- `test/rodada-3.test.ts`: expectativa temporal e teste de limite do calendário.
- Este relatório.

Não foi criada ou aplicada migration nesta rodada. Não houve commit ou push. Os helpers, dumps e cópias em `.wrangler/` não devem ser versionados. A importação remota e a publicação descritas abaixo ocorreram somente após autorização explícita da usuária. Nenhum dado real anterior foi alterado.

## Importação real autorizada em produção — 30/10/2026

### Autenticação e backups

A primeira tentativa de novo export retornou erro de autenticação 10000. O OAuth do Wrangler foi renovado e confirmado com sucesso antes de qualquer importação. A conta selecionada nos comandos permaneceu VOIA ENGENHARIA (`87efb254a391405500dd04e8ba5e2e80`), sem alterar a configuração Wrangler.

O backup anterior solicitado foi novamente verificado e permaneceu íntegro, com SHA-256 `82185c018a8c4a28394338dbd039e6fad4f08d76e78af42c88c7cd9e17acf521`. Um NOVO backup foi obtido imediatamente antes da gravação: `.wrangler/backups/voia-db-pre-importacao-autorizada-2026-10-30T15-20-00.sql`, com o mesmo SHA-256. Restaurado localmente, apresentou integridade OK, FK zero, 37 serviços VOIA e zero bases/itens importados.

O arquivo XLSX validado foi novamente conferido por SHA-256, e a comparação independente foi repetida com zero divergências. Nenhuma outra fonte foi usada.

### Método e rastreabilidade

A importação técnica foi executada via Wrangler/D1, usando arquivo SQL de dados previamente ensaiado em uma cópia local do backup. Não foi uma migration, não alterou schema e não utilizou credenciais de aplicação ou sessões de teste em produção.

O arquivo grava uma única base e duas sessões legítimas de importação, uma por entidade do MESMO XLSX: composições e insumos. Preserva os campos/assinaturas/mapeamento do importador existente, ownership no Administrador ativo existente ID 1, hashes de arquivo por entidade e lotes auditáveis. Os preços continuam juntos em cada item, sem relação com preço adotado de planilhas.

Os lotes SQL foram limitados a aproximadamente 60 KB para respeitar o limite de tamanho de instrução do D1: 179 lotes de composições e 64 de insumos. Foram executados 250 comandos, com duração SQL reportada de aproximadamente 2.998 ms. O SHA-256 do arquivo de importação exato é `55904f9412315e5b57f1e66d8d030f1eb21dc6f084c279a68a1018ed4d2c217b`. O ensaio desse mesmo arquivo confirmou integridade/FK e preservação dos dados antes da execução remota.

Não foi feita reimportação remota para testar idempotência. As duas sessões correspondem a entidades distintas, não a repetição nem a bases separadas por regime.

### Contagens reais e valores

Base única ID 1: SINAPI · MT · 09/2026, fonte SINAPI, UF MT, competência 09/2026, regime da base vazio.

| Entidade | Referências | Não desonerado | Desonerado |
|---|---:|---:|---:|
| Composições | 10.599 | CSD: 8.443 | CCD: 8.443 |
| Insumos | 4.878 | ISD: 3.772 | ICD: 3.772 |
| Total | 15.477 | 12.215 | 12.215 |

Duplicação semântica por base/tipo/código: zero. Insumo 39577, UN: `preco_nao_desonerado_centavos = 3136759` e `preco_desonerado_centavos = 3136759`, isto é, R$ 31.367,59 nos dois regimes. Confirmado por SELECT diretamente na produção.

### Integridade e preservação completas

Backup pós-importação: `.wrangler/backups/voia-db-pos-importacao-sinapi-2026-10-30T15-21-02.sql`, SHA-256 `203759853b90a18b40bc19a1850d8ce97dd251ba3e743cb1c8188ec4f6a9ff37`.

O export de produção foi restaurado em SQLite em memória: integridade OK e zero violações de chave estrangeira. Cada registro importado foi comparado com a fonte validada, incluindo preços/NULLs, código, tipo, descrição, unidade, classificação, grupo, categorias, tags, observações e metadados. Todos conferiram. As assinaturas dos itens e hashes/quantidades dos lotes também foram verificados; ambas as sessões estão concluídas.

As 32 tabelas fora das quatro tabelas de catálogo/importação permaneceram integralmente idênticas ao backup prévio, incluindo os 37 serviços VOIA, clientes, projetos, obras, tarefas, documentos, planilhas, itens/snapshots existentes e dados da Yara. Schema, índices, triggers e histórico de migrations permaneceram idênticos. Nenhum preço adotado foi alterado, nenhum dado demo ou conta/sessão de teste foi criado em produção.

### Buscas e filtros diretamente no D1 de produção

Foi executada a consulta `SELECT_CATALOGO` real do sistema sobre o D1 de produção, com fonte SINAPI, MT, competência, tipo e ordenação/paginação da busca. Os campos e preços de todos os resultados retornados foram comparados com a fonte validada.

| Busca | Primeira página | Segunda página | Mais páginas |
|---|---:|---:|---|
| calha | 30 | 30 | Sim |
| impermeabilização | 25 | 0 | Não |
| alvenaria | 30 | 30 | Sim |
| pintura | 30 | 30 | Sim |

Nenhum ID se repetiu entre páginas visíveis. Filtros Composição e Insumo retornaram somente o tipo solicitado. Fonte SINAPI, UF MT e competência 09/2026 conferiram em todos os resultados. Os termos são normalizados sem acentos antes da consulta, como no backend. As consultas foram divididas em lotes pequenos para respeitar o limite de SELECT composto do D1; as durações SQL de três lotes foram aproximadamente 153, 177 e 92 ms, com zero linhas escritas. Isso mede SQL, não latência completa de navegador.

**Limite da validação de interface:** essas buscas são conferências diretas contra produção pelo D1, não testes autenticados da interface/API. A tentativa de revisão visual no Chrome foi interrompida pela ferramenta por não conseguir confirmar a URL do navegador com segurança. Não foram realizadas outras ações no navegador nem criadas credenciais/sessões em produção como alternativa. A revisão visual local completa já está documentada acima; a validação visual autenticada de produção fica para conferência manual da usuária.

### Testes e publicação das correções

Depois da importação ter sido aprovada nas conferências acima, foram repetidos: 235 testes Worker e 160 UI (395 aprovados), com testes SINAPI e arquivo real apenas em ambiente local; typecheck, lint e UTF-8/mojibake passaram (269 arquivos, nenhuma ocorrência). Build de produção passou imediatamente antes do deploy. Avisos anteriores de Zod e tamanho de bundle persistem sem falha.

O Worker existente foi confirmado antes do deploy; a versão ativa encontrada era `8aa52f47-6ada-48a4-b6f8-235998c1fe82`. A nova publicação no MESMO Worker `voia-app` concluiu com **Version ID `18f3d00b-a551-4aa8-98d3-6c289a8d0cec`**, URL preservada `https://voia-app.bbrazgarcia.workers.dev`.

Bindings confirmados na saída do deploy: `DB → voia-db` (ID `217f7490-d357-4c36-827f-afd54589adb9`) e `DOCUMENTOS_BUCKET → voia-documentos`. Nenhum Worker novo foi criado. Não houve nova migration.

Smoke tests pós-deploy: **12 GETs aprovados**, incluindo login/rota SPA com HTML do build atual, health com API e D1 saudáveis, assets JS/CSS atuais e quatro APIs protegidas retornando 401 sem sessão. Esses smoke tests não substituem a validação autenticada das buscas; não fizeram gravações.

Evidências em `.wrangler/importacao-sinapi-2026-09/producao/`: `manifest-importacao.json`, `ensaio-sql-exato.json`, `pos-importacao-verificado.json`, `buscas-verificadas.json` e `smoke-pos-deploy.json`. Não houve alteração adicional do código da aplicação após o deploy, commit ou push. Apenas este relatório recebeu os resultados finais. A operação foi encerrada para avaliação da usuária.

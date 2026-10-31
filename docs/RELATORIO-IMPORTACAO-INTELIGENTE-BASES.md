# Importação inteligente de bases pela interface

Implementação e validação inicial locais, em 30/10/2026. Branch `claude-modelos-processos-v2`, ponto de partida `a7903e1d4d557580b33470e79350f8923c387095`. A etapa inicial e sua retomada não alteraram produção. Posteriormente, em etapas autorizadas separadamente em 31/10/2026, a migration 0035 foi aplicada e a implementação publicada; os resultados atuais estão na seção final deste relatório. Nenhum commit ou push foi realizado.

Retomada e conferência final em **31/10/2026**, mantendo a implementação e as evidências existentes. Foram acrescentados somente testes de outra localidade SICRO e de falha transacional intermediária, sem mudanças adicionais no código funcional durante a retomada. O autocomplete da célula SERVIÇO não faz parte desta rodada e não foi implementado.

## Auditoria anterior às alterações

Foram lidos os componentes BasesServicos, ImportarBaseServicos e BuscaCatalogoServicos, os três parsers, schemas compartilhados, rotas de catálogo, migrations 0031–0034, staging/manifests, uso do bucket privado e testes de fontes, permissões, planilhas e snapshots.

O fluxo anterior exigia criar a base manualmente, escolher um importador e, para SINAPI, importar as entidades separadamente. Já existiam comparação de assinaturas, prévia, lotes retomáveis, UNIQUEs, triggers de imutabilidade e publicação por `DB.batch`. Os snapshots das planilhas copiam a referência e não consultam preços ao renderizar. Esses mecanismos foram preservados.

Limitações encontradas: SICRO fixado em MT 07/2026; SBC fixado em quatro páginas, duzentos registros e hashes de dois arquivos de setembro; leitura XLSX dependente de DOMParser; ausência de vínculo entre originais R2 e sessões de importação; criação antecipada de uma base ativa no fluxo manual.

## Arquitetura escolhida

`+ Importar base` é a ação principal. `Cadastro manual avançado` mantém o formulário anterior. As ações de importação de fontes oficiais nas linhas também abrem o fluxo assistido; importação genérica/mapeamento de bases próprias permanece disponível.

Fluxo: seleção/drag-and-drop → validação de arquivos → identificação por estrutura → análise específica da fonte → validação e comparação com o catálogo → revisão → confirmação explícita → preservação dos originais → staging em lotes → publicação atômica → relatório.

A análise roda em um **Web Worker dedicado no navegador**, reutilizando os parsers existentes. Foi acrescentado `@xmldom/xmldom` para oferecer XML inerte nesse worker. O worker Vite usa formato ES, inclusive para os chunks PDF. O React recebe somente identidade, contagens e seis itens de amostra. Os registros completos e os lotes ficam no worker. Os buffers de entrada são transferidos, evitando cópia desnecessária entre threads; o arquivo original continua disponível como File para o upload posterior.

Essa escolha mantém os leitores XML/PDF existentes, isola o processamento da interface e não depende de uma request monolítica de parsing no Cloudflare Worker. O backend conserva autorização, validação de dados normalizados, comparação com itens existentes, integridade dos arquivos, R2 e publicação. Não se trata de uma segunda implementação dos parsers no servidor.

Antes da confirmação, somente a prévia é enviada ao servidor, em lotes limitados, sem gravação. O upload persistente dos arquivos é posterior ao clique em Confirmar importação.

## Formatos realmente suportados e detecção

| Fonte | Entrada | Evidência e regras |
| --- | --- | --- |
| SINAPI | XLSX ou ZIP do formato auditado | workbook/relações com CSD, CCD, ISD e ICD; competência dos cabeçalhos; UFs presentes nas quatro abas; validação de títulos/regimes e colunas pelo parser existente |
| SICRO | 12 XLSX ou um ZIP contendo o conjunto | nomes dos doze relatórios oficiais e prefixo UF/mês, conferidos contra UF e mês escritos nos blocos analíticos, códigos, custos, origem e consistência entre relatórios |
| SBC | Dois PDFs ou ZIP contendo os dois | título interno Composições/Insumos, região/cidade/UF e atualização no texto, layout auditado por coordenadas e contagem Listados impressa no conjunto |

**ZIP é suportado. 7Z não é suportado**, nem anunciado como selecionável: a orientação é extrair os XLSX ou converter o pacote para ZIP. Não foi acrescentado executável externo, descompressor 7Z no servidor ou botão fictício.

SINAPI não depende do nome do XLSX: o teste com nome renomeado passa. Se houver várias UFs, o fluxo exige escolher uma das UFs encontradas, sem presumir MT. O pacote real de setembro contém quatro XLSX; somente a referência interna é importada, e os três auxiliares conhecidos são explicitamente informados como não importados. Arquivos extras fora dessa lista são recusados. Os auxiliares seguem preservados dentro do ZIP original no R2.

SICRO continua exigindo o conjunto completo auditado, agora parametrizado por UF e competência. Não houve generalização das colunas ou tentativa de adivinhar outro formato. O estado e mês do analítico precisam conferir com o pacote. Custos produtivo/improdutivo, edição e valores decimais lexicais permanecem separados. NULL e zero oficial continuam diferentes.

SBC conserva o modo antigo estrito por hash para o fluxo legado e acrescenta leitura mensal do mesmo layout, sem whitelist de nome/hash. A identidade é extraída do conteúdo; arquivos devem ter a mesma região/data e conter os dois tipos. O número de registros vem de Listados, que pode aparecer na última página, e é confrontado com o número efetivamente extraído. Cada item preserva arquivo, SHA-256, página, tipo e preço original. O nome gerado sempre termina em **Relatório importado**, com o aviso **A completude deste relatório não pôde ser comprovada.** Não há promessa de ler qualquer layout SBC futuro.

## Prévia, competências existentes e idempotência

A revisão apresenta contagens reais, tipos e preços por regime, custos SICRO e ausências, conforme a fonte. Mostra os nomes recebidos, amostra com código/descrição/unidade/tipo, ação prevista e estado da competência. Contagens não são hardcoded.

Se a identidade fonte/UF/competência/cidade já existir, são mostrados nome e total atual. A confirmação permanece bloqueada até Revisar reimportação. Qualquer item alterado ou inválido bloqueia a confirmação; não há opção de sobrescrever preços existentes.

Nova competência cria outra referência. Arquivo/contexto idêntico reconhece a sessão concluída; outra sessão válida com o mesmo conteúdo continua sujeita à comparação de assinaturas e à inserção apenas de chaves inexistentes. Os UNIQUEs e o claim transacional existente são mantidos. O manifesto tem hash recalculado também no servidor, incluindo identidade e documentos, além dos hashes individuais.

## Publicação, falhas e retomada

Após confirmar, uma nova base é criada **inativa**, ligada à sessão e fora da listagem normal enquanto não houver conclusão. Uma base existente continua intacta e ativa. Os lotes são preparados com os mesmos helpers e gravados na estrutura já existente.

O `DB.batch` final valida todos os lotes, total e chaves distintas, ausência de assinaturas conflitantes e recebimento de todas as evidências. Na mesma transação publica itens e custos, registra o resumo e ativa a nova competência. Se uma instrução falhar, a transação reverte. Não existe janela com parte dos itens publicados.

Preparação interrompida é retomada com os mesmos arquivos. Não se apagam os metadados de auditoria: a base vazia continua oculta e a sessão permanece preparando/cancelada. Cancelar impede novos lotes e publicação daquela sessão; uma tentativa posterior pode reutilizar a base vazia reservada com segurança. Não se deve interpretar esse registro de preparação como importação parcial de catálogo.

O histórico lista sessões e falhas, com originais para download autenticado. Falhas de conexão do cliente são registradas quando o servidor está alcançável; se o registro do erro também falhar, a interface informa essa limitação. Progresso usa etapas e número real de arquivo/lote, sem percentual inventado. Análise tem limite de cinco minutos, pode ser interrompida e não deixa loading indefinido.

## R2, auditoria e segurança

Reutiliza **DOCUMENTOS_BUCKET**, sem novo binding ou bucket. Chave privada: `bases/{fonte}/{UF}/{AAAA-MM}/{SHA-256}.{extensão}`. A existência é consultada antes de gravar o mesmo objeto, evitando duplicação física do mesmo conteúdo nesse contexto. ZIP é preservado como o pacote original, sem duplicar fisicamente todos os membros extraídos.

Cada evidência é ligada à importação, nome, tamanho, hash e storage_key. A sessão registra usuário, data/hora, status, manifesto com fonte/competência/UF/cidade, arquivos originais, documentos analisados, parser, quantidade analisada e lotes. O resumo do servidor registra novos, existentes, rejeitados e duplicações na conclusão. O campo erro guarda falhas de preparações.

R2 e D1 não formam uma única transação: um arquivo já enviado pode permanecer como evidência de uma preparação cancelada/falha, mas nenhum item aparece parcialmente no catálogo. Não há rotina automática de apagar essas evidências compartilhadas. O histórico fornece acesso administrativo privado; downloads usam attachment, nosniff e no-store. Tokens/storage_keys não são expostos pela interface de importação.

Servidor exige sessão e perfil **administrador** nas novas operações, inclusive prévia/evidências/histórico. Gestor continua consultando o catálogo e parceiro permanece fora do módulo. Ownership da sessão é validado para upload, retomada, lotes e conclusão. Não foram modificadas permissões de projetos/obras, isolamento de parceiros ou financeiro.

Validações: extensão, assinatura, SHA-256 e tamanho real; diretório central ZIP completo; limites de entradas/tamanhos declarados; rejeição de ZIP truncado, multidisco, criptografia, macros, métodos não suportados, nomes duplicados, traversal, paths absolutos e arquivos inesperados. A descompressão no browser também conta bytes efetivamente expandidos e interrompe ao exceder o limite. XML com DTD/entidades é recusado; fórmulas não são executadas e permanecem sujeitas às regras auditadas por fonte. PDF é usado somente para texto, sem executar ações/conteúdo ativo.

Limites: 20 MiB por arquivo, 80 MiB no conjunto recebido, até 32 originais, ZIP externo até 64 entradas/240 MiB expandidos, até 50 mil itens e mil lotes. Um lote mantém o limite existente de 200 itens/700 KB antes do envio. XHTML/arquivos executáveis/fontes desconhecidas não recebem mapeamento automático. Autenticidade comercial/licenciamento não pode ser provada apenas pela estrutura; a administradora deve fornecer arquivos oficiais ou legitimamente obtidos.

O parser PDF SBC tem limite mais restrito: **5 MiB por PDF, até 100 páginas e 30 segundos por documento**, dentro do limite global de análise. O upload de evidência usa application/octet-stream; MIME declarado pelo cliente não é tratado como evidência confiável. As verificações efetivas são extensão, assinatura/conteúdo estrutural, tamanho e hash. Não foi executado teste separado de falsificação de MIME, nem se declara autenticidade oficial com base em MIME.

## Migration 0035 — preparada, não aplicada em produção

`migrations/0035_importacao_assistida.sql` acrescenta a bases_importacoes:

- manifesto JSON, resumo JSON, flag nova_base e erro;
- tabela bases_importacao_arquivos com FK para a sessão e hash, nome, tamanho, storage_key e data.

É aditiva: não reconstrói tabelas, não altera referências, preços, snapshots ou serviços. Foi ensaiada sobre a cópia local do export pós-deploy anterior (SHA-256 `fdeb56fc9272413affc122043d93c8b768abda7687362e54d63fcd2bb81b7d19`). Todas as linhas/colunas anteriores foram comparadas: iguais; integridade ok e zero violações FK. Contagens anteriores preservadas: SINAPI 15.477, SICRO 9.017, SBC 400, custos SICRO 18.495, VOIA 37, total externo 24.894. O novo fluxo depende dessa migration antes de um futuro deploy.

Não se aplica uma migration por mês: depois desta mudança estrutural, novas competências do formato suportado passam pelo fluxo da aplicação.

## Validações executadas

- **255 testes Worker aprovados**, 29 arquivos, na conferência final da retomada.
- **183 testes UI aprovados**, 18 arquivos, com as três fontes reais habilitadas.
- Verificações específicas separadas: **7 testes Worker da importação assistida** e **14 UI do orquestrador**, todos aprovados e já incluídos nos totais acima.
- Regressões executadas separadamente: SINAPI **24/24**, SICRO **5/5**, SBC **4/4**, com arquivos reais habilitados. As regressões Worker também integram a suíte completa.
- Build, typecheck e lint aprovados. Build inclui worker ES/chunks PDF; aviso não bloqueante de tamanho de bundle.
- UTF-8/mojibake: **277 arquivos**, sem ocorrências no scanner estrito de src/test/docs/migrations; resultado em `.wrangler/auditoria-sicro/utf8.json`.
- `git diff --check` aprovado.

Fixtures verificam nova competência SINAPI, nomes renomeados, quatro abas, regimes/NULL, conjunto SICRO com todos os subtipos, precisão, edições e consolidação, SBC mensal com prefixo/UNN/multilinha e relatório parcial; ZIP seguro, ZIP bomb, extras, traversal, duplicatas, vazio/truncado, arquivo desconhecido, competência ausente, parsing/upload interrompidos, confirmação explícita e StrictMode.

Na retomada, uma fixture SICRO **SP · 11/2026** foi aceita com São Paulo/Novembro nos cabeçalhos internos. A mesma identificação de arquivo com Mato Grosso no conteúdo foi recusada. Isso comprova que o adaptador não está fixado em MT/07-2026; não representa auditoria de um novo pacote oficial paulista.

Atomicidade foi adicionalmente comprovada com trigger **apenas no D1 de teste**, que aborta o segundo item do INSERT final. A tentativa retornou 409 e reverteu o claim e o primeiro item já processado: zero itens novos, sessão preparando, base inativa e oculta, catálogo anterior idêntico. A evidência R2 continuou acessível. Removida a falha artificial, a mesma preparação concluiu com dois itens, sem violações FK. A trigger de teste não faz parte de nenhuma migration.

R2 e D1 não são atomicamente coordenados: se o objeto for salvo e falhar o vínculo no D1, pode restar objeto privado sem vínculo até a repetição/limpeza futura. O caminho por hash permite reutilizá-lo na repetição; a publicação exige todos os vínculos e permanece bloqueada. A falha forçada testada foi na publicação do catálogo após evidência vinculada, e não especificamente na gravação desse vínculo. Essa distinção limita o que foi efetivamente testado.

Arquivos reais processados **somente localmente/em memória**:

- ZIP SINAPI de setembro: 15.477 itens (10.599 composições, 4.878 insumos); código 39577 com 3.136.759 centavos nos dois regimes.
- Doze XLSX SICRO: 9.017 itens e 18.495 custos tipados, preservando subtipos e edição.
- Dois PDFs SBC em modo mensal e com nomes renomeados: 400 itens, quatro prefixos numéricos, UNN e dezesseis descrições multilinha preservados.

No navegador, com API/D1/R2 locais reais e cópia do backup: fixture SINAPI 10/2026 reconhecida, prévia de dois registros sem gravação, confirmação com upload da evidência, staging e conclusão (2 novos). Repetição pela interface exigiu Revisar reimportação e terminou com 0 novos/2 existentes. Nenhum dado da Yara foi utilizado na fixture.

Também há observação do Web Worker real no navegador local com os dois PDFs SBC originais: 200 composições + 200 insumos, identificação de relatório importado, competência existente, **0 novos / 400 existentes / 0 alterados / 0 inválidos**, confirmação bloqueada até revisão explícita. Essa etapa ficou somente na prévia e não reimportou os registros da cópia.

Upload, revisão e resultado conferidos em **1920×1080, 1366×768, 1024×1366 e 375×812**. Modal compacto, resumo por fonte, tabela com rolagem e botões acessíveis no celular. O logo magenta e usuário “Validação local” pertencem ao harness ignorado pelo Git, não ao produto.

Uma primeira seleção de arquivo no navegador do ambiente demorou e retornou à listagem; o fluxo foi repetido e a análise real no Web Worker e confirmação local foram efetivamente concluídas. O ensaio também identificou o controlador AbortController abortado após cleanup/StrictMode: corrigido recriando o controlador no setup e coberto por teste. Nenhum desses casos foi registrado como aprovado antes da repetição.

Artefatos ignorados: `.wrangler/importacao-inteligente/` contém migration-0035.json, banco de ensaio, logs de build/typecheck/lint/testes, fixture XLSX, servidores/preview locais e capturas upload/revisao/resultado por largura. Não entram no Git.

Logs finais de 31/10: worker-retomada-final.log, ui-retomada-final.log, assistida-retomada.log, orquestrador-retomada.log, regressao-sinapi.log, regressao-sicro.log, regressao-sbc.log, build-retomada.log, typecheck-retomada.log e lint-retomada.log. As capturas existentes foram conferidas, sem repetir manualmente o fluxo que já estava validado. Não houve alteração visual/funcional durante esta retomada.

## Arquivos da rodada

Modificados: package.json; package-lock.json; vite.config.ts; src/react-app/lib/importar-sinapi.ts; src/react-app/lib/importar-sicro.ts; src/react-app/lib/importar-sbc.ts; src/react-app/pages/BasesServicos.tsx; src/react-app/styles/bases-servicos.css; src/shared/sbc.ts; src/worker/bases/routes.ts; test/ui/bases-servicos.test.tsx.

Criados: migrations/0035_importacao_assistida.sql; src/shared/arquivos-bases.ts; src/shared/importacao-assistida.ts; src/worker/bases/assistidas.ts; src/react-app/lib/analisar-base.ts; src/react-app/lib/analisar-base.worker.ts; src/react-app/lib/cliente-importacao.ts; src/react-app/components/ImportarBaseInteligente.tsx; test/importacao-assistida.test.ts; test/ui/importacao-inteligente.test.tsx; docs/RELATORIO-IMPORTACAO-INTELIGENTE-BASES.md.

BuscaCatalogoServicos, ImportarBaseServicos, regras de snapshots e wrangler.json foram auditados/reutilizados, sem alteração nesta rodada.

## Limitações e ponto de parada

Não é um importador genérico. Mudanças de layout oficial, PDFs digitalizados/OCR, pacotes 7Z e arquivos acima dos limites exigem preparação externa ou uma nova evolução do adaptador. Detecção SICRO usa nomes de relatórios como parte do contrato e exige a confirmação interna da região/competência; não reconhece arbitrariamente arquivos renomeados. As UFs/mês são parametrizados, mas os arquivos reais auditados permanecem a referência de compatibilidade. Não há scraping, download externo automático nem extração de novas fontes.

Ainda não há limpeza automática de evidências órfãs, processamento remoto assíncrono de arquivos maiores nem assinatura digital oficial dos documentos. Sem rede não é possível persistir imediatamente um erro; a interface preserva a mensagem e permite retomada. Essas limitações são explícitas e não impedem o fluxo local validado com os formatos suportados.

O ponto de parada da implementação local foi respeitado. A aplicação da migration e a publicação abaixo receberam autorizações explícitas posteriores. Nenhuma nova competência foi importada em produção para validar a implementação.

## Aplicação autorizada da 0035 em produção — 31/10/2026

Destino confirmado: `DB` → `voia-db`, ID `217f7490-d357-4c36-827f-afd54589adb9`, na conta VOIA ENGENHARIA. Antes da aplicação, 0034 registrada e exclusivamente `0035_importacao_assistida.sql` pendente. Aplicação concluída com registro **ID 35**, em **2026-10-31 19:27:13 UTC** (15:27:13 em Cuiabá).

Colunas manifesto, resumo, nova_base e erro criadas; tabela bases_importacao_arquivos criada e vazia. Comparação dos exports pré/pós confirmou preservação das 38 tabelas anteriores, dados, colunas anteriores, FKs, índices, triggers e sequências. Schema pós-migration correspondeu ao ensaio exato. Integridade do export restaurado localmente ok; FK remota/local sem violações. Zero importações, novas competências ou arquivos enviados ao R2 nessa operação. Nenhum deploy foi realizado junto à aplicação.

Evidências ignoradas pelo Git: aplicacao-0035.log, pos-0035-validacao.json e producao-0035-conferencia.json, em `.wrangler/importacao-inteligente/`.

## Publicação autorizada — 31/10/2026

Os 22 arquivos candidatos foram conferidos antes da publicação. Nenhum artefato de `.wrangler/`, banco, backup, PDF, XLSX, ZIP, log, captura, cache ou credencial foi incluído no código. A configuração Wrangler e os bindings não foram alterados.

Validações pré-deploy executadas em comandos separados:

| Validação | Resultado |
| --- | --- |
| Worker | **255 aprovados**, 29 arquivos |
| UI com SINAPI/SICRO/SBC reais habilitados | **183 aprovados**, 18 arquivos |
| Build de produção | Aprovado; aviso não bloqueante de tamanho de chunk |
| Typecheck | Aprovado |
| Lint | Aprovado |
| UTF-8/mojibake | **277 arquivos, zero ocorrências** |

Deploy no Worker **existente `voia-app`**, sem criar Worker ou alterar a URL:

- URL: https://voia-app.bbrazgarcia.workers.dev
- **Version ID: `cd2180ac-9729-4887-a18e-d84ac604f4da`**.
- Binding D1 preservado: **`DB` → `voia-db`**.
- Binding R2 preservado: **`DOCUMENTOS_BUCKET` → `voia-documentos`**.
- Demais configurações atuais preservadas.
- Sem reaplicação da 0035, nova migration, importação, upload de dados ao bucket, commit ou push.

### Smoke tests públicos e autenticados

Smoke HTTP público: health/API saudável, D1 conectado, schema disponível, HTML atual e **11 assets JS/CSS** com SHA-256 idêntico ao build local. Foram 18 verificações HTTP, incluindo proteção das APIs de catálogo/biblioteca/histórico, que retornaram 401 sem sessão. Evidência: smoke-publicado.json/log.

No navegador autenticado da aplicação publicada:

- Bases de Serviços acessível; CTA principal **+ Importar base** e opção secundária **Cadastro manual avançado** visíveis.
- Modal **Importar base de referência** aberto, com drag & drop, sem selecionar arquivo. A captura mostra “Nenhum arquivo escolhido”.
- Input com accept **.xlsx,.pdf,.zip**, múltiplos arquivos; 7Z aparece somente como orientação para extrair previamente, não como formato aceito.
- Não houve análise de arquivo nem confirmação de importação em produção. As etapas posteriores são cobertas pelos testes locais, não foram simuladas com dados reais publicados.
- Biblioteca VOIA exibiu 37 serviços; API autenticada confirmou 37.
- Histórico de importações assistidas retornou lista vazia.

Buscas GET autenticadas na API publicada e paginação de duas páginas, sem IDs repetidos:

| Fonte | Termos e contagem nas páginas 1/2 |
| --- | --- |
| SINAPI | calha 30/30; impermeabilização 25/0; alvenaria 30/30; pintura 30/30 |
| SICRO | escavação 30/30; concreto 30/30; transporte 30/30; pavimentação 3/0; drenagem 30/30; sinalização 30/30 |
| SBC | concreto 10/0; pintura 1/0; alvenaria 4/0; elétrica 1/0; acessibilidade 30/30 |

Filtros Fonte, Composição/Insumo, MT e competência passaram para cada fonte, além de Cuiabá para SBC. A referência SBC manteve o nome exato **SBC · Cuiabá/MT · 09/2026 · Relatório importado**, natureza do relatório e aviso de completude não comprovada. O código SINAPI 39577 manteve R$ 31.367,59 nos dois regimes. Equipamento SICRO E9001 manteve produtivo/improdutivo 19.4563/11.7933, nas edições correspondentes, sem arredondar a precisão armazenada.

Os smokes usaram somente GETs, navegação e abertura/fechamento do modal vazio. Não houve POST/PUT de importação, file chooser, fixture ou envio ao R2. Evidências: smoke-autenticado-publicado.json, modal-publicado.png e bases-publicadas.png. Nenhuma credencial/token foi extraído do navegador.

### Estado final do D1 e ausência de escritas

| Verificação pós-deploy | Resultado |
| --- | ---: |
| SINAPI | 15.477 |
| SICRO | 9.017 |
| SBC | 400 |
| Referências oficiais externas | 24.894 |
| Custos tipados SICRO | 18.495 |
| Biblioteca VOIA | 37 |
| Bases existentes | 3 |
| Novas competências | 0 |
| Importações assistidas | 0 |
| Linhas em bases_importacao_arquivos | 0 |
| Violações FK remotas e locais | 0 |

Exports imediatamente antes/depois do deploy e dos smokes foram restaurados localmente: **39 tabelas e 54.329 linhas integralmente idênticas**, inclusive autenticação, projetos, obras, bases e Yara. Schema idêntico e integrity_check ok. Ambos os exports têm o mesmo SHA-256: **`5dde64e83d0dfe6ce31e5a84883533e640cb007cbaf044bc179d826af34020e6`**. Isso comprova zero alteração no D1 nesta etapa.

Nenhum objeto foi enviado por esta operação ao bucket `voia-documentos`; a contagem de evidências permaneceu zero. Não foi feito inventário global dos objetos do bucket: a confirmação de zero upload refere-se às ações desta publicação/smoke, que não executaram nenhuma rota de upload. O upload de assets estáticos do deploy é gerenciado pelo Cloudflare e não é upload de fixture/documento ao binding DOCUMENTOS_BUCKET.

Evidências finais: d1-pos-deploy.json e preservacao-pos-publicacao.json, em `.wrangler/importacao-inteligente/`. Logs pré-deploy: worker-pre-deploy.log, ui-pre-deploy.log, build-pre-deploy.log, typecheck-pre-deploy.log, lint-pre-deploy.log; publicação em deploy.log. Todos ignorados pelo Git.

Publicação e validações concluídas. Aguardar autorização específica para **commit e push dos 22 arquivos da rodada**. Não há autorização para importar novas competências em produção nesta etapa.

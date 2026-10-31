# Autocomplete inteligente de serviços na Planilha de Obra

Data: 31/10/2026. Branch: `claude-modelos-processos-v2`. Base: `f0bdcdd0026986e0f75523c15664ca9c3d9f8edb` (working tree limpa no início).

## Auditoria e arquitetura

A grade existente é `ObraPlanilhasPanel.tsx`, com edição local, rascunho em sessionStorage, salvamento em lote, código técnico da linha e controle otimista por versão. `novoItem`, `itemDoCatalogo`, `selecionarRegime`, `referenciaTecnica`, `CustosSicro` e a Biblioteca VOIA já forneciam o modelo de snapshots e separavam referência de preço adotado. A busca unificada já normalizava descrição/código, acentos e caixa no servidor e hidratava os custos SICRO. Tudo isso foi reutilizado; não existe um segundo catálogo.

Não foi necessária migration. Não houve acesso a produção, operação D1 remota, envio ao R2, importação, deploy, commit ou push nesta rodada. Nenhum dado real/Yara foi alterado. Fixtures são exclusivamente locais.

## Busca, interface e desempenho

Novo endpoint com escopo: `GET /api/obras/:id/planilhas/:planilha/catalogo?q=armadura&limite=12&priorizar_grupo=01`. Delega ao mesmo handler `buscarCatalogo` usado em `/api/catalogo-servicos/busca`; a busca avançada mantém seu limite padrão de 30. O parâmetro de limite é limitado no servidor a 1–30.

A célula SERVIÇO agora usa um combobox controlado, mantendo texto manual. Após digitar pelo menos dois caracteres normalizados, espera 250 ms e busca até 12 resultados das fontes VOIA, SINAPI, SICRO e SBC. Não há download integral do catálogo. AbortController e contador monotônico invalidam respostas antigas, inclusive quando a implementação de fetch ignora cancelamento. Durante a digitação anterior ao debounce, os resultados antigos são removidos.

Dropdown em portal no body, fixo, acima da grade e fora do overflow da tabela. Reposiciona no resize, scroll e visualViewport; abre para cima quando falta espaço abaixo, limita altura a 320 px e largura ao viewport com margens. Fecha quando a célula sai da área visível. Descrições longas ficam em duas linhas; a descrição completa integra o snapshot e o detalhe. Fonte/código, unidade, UF, competência e referência aparecem discretamente. Não foi redesenhada a página.

Estados: buscando, nenhum resultado e erro de API (todos permitem continuar manualmente). Mouse seleciona; ↓/↑ percorrem opções, Enter seleciona a destacada, Esc fecha preservando o texto, Tab continua a navegação existente. Sem opção destacada, Enter mantém a navegação da grade. Clipboard/TSV continuam delegados à implementação existente. O botão + Biblioteca VOIA permanece disponível para busca avançada e seleção em lote.

Medição local sobre cópia já disponível do banco: armadura, ARMADURA, impermeabilizacao, impermeabilização, alvenaria, pintura e 92767 responderam HTTP 200 em 46–76 ms (sem incluir debounce), com até 12 resultados. A busca por 92767 retornou uma referência; buscas amplas indicam mais resultados, acessíveis pela Biblioteca. A janela inicial não garante um resultado de cada fonte: preserva a ordenação/priorização já existente. Esses tempos locais não constituem garantia de latência de produção.

## Seleção, preços e histórico

Selecionar altera apenas o estado local e marca a planilha como não salva. Preenche serviço/descrição, unidade, fonte, identificador e snapshot completo (código oficial, UF, competência, edição, metadados, custos e preços disponíveis). Preserva código da linha (01.01 etc.), ID, categoria, subcategoria, etapa, pavimento, ambiente, quantidade e preço adotado. Escopo/observações manuais existentes são preservados. O código oficial fica na referência/caption, separado da numeração técnica da planilha.

Preço adotado existente, por exemplo R$ 17,50, permanece R$ 17,50. Linha nova sem preço adotado permanece NULL, conforme semântica anterior. Nenhum NULL é convertido em zero. Adotar preço de referência continua uma ação explícita no detalhe.

SINAPI: sem regime confirmado, mostra ND/D e solicita escolha no detalhe; não usa o campo de contratação (somente mão de obra) como regime tributário. Regime explicitamente escolhido na referência SINAPI anterior é preservado ao selecionar outra SINAPI; altera somente a referência, nunca o adotado. Ausência de preço no regime continua ausente.

SICRO: preserva custos decimais, edição e rastreabilidade. Valor único só é apresentado quando há uma parcela selecionável única e o item não é equipamento. Equipamentos continuam exigindo escolha explícita de produtivo/improdutivo e edição; múltiplas parcelas não são colapsadas. Materiais sem custo continuam NULL; zeros oficiais permanecem zero.

SBC/VOIA usam o snapshot canônico existente. Editar manualmente uma linha referenciada não destrói sua proveniência: a célula sinaliza “Texto alterado · referência preservada”. Selecionar uma nova sugestão troca explicitamente a referência; a versão histórica anterior permanece no snapshot de salvamento existente. Referência inativa histórica não precisa continuar ativa para ser lida/preservada.

## Salvamento e segurança

Não há POST/PUT por tecla nem por seleção. Só “Salvar alterações” envia o lote, com a versão e os IDs das trocas explícitas em `substituir_referencias`. O contrato anterior `substituir_referencias_sbc` permanece compatível. A criação/duplicação atualiza os IDs persistidos usados para sinalizar trocas. Rascunhos recuperados reconstituem essas trocas; IDs de linhas excluídas são filtrados antes do envio.

Backend mantém autenticação, perfis e requireObraAccess anteriores. A rota também confere se a planilha pertence à obra acessível. Ao salvar uma troca, exige uma referência ativa canônica e valida ID, snapshot, competência, preços/regime e custos; não aceita IDs/preços forjados nem usa fallback histórico para uma troca nova. Troca não sinalizada continua rejeitada. Versionamento, conflito 409 e salvamento atômico anteriores permanecem.

## Testes e regressões

- Worker: **259 aprovados**, 30 arquivos; execução separada dos específicos de autocomplete/planilhas/SINAPI/SBC: **40 aprovados**.
- UI padrão: **196 aprovados**, seis testes de arquivos oficiais condicionais ignorados na execução sem variáveis. Execução com os arquivos oficiais SINAPI/SICRO/SBC habilitados: **202 aprovados**, 19 arquivos, nenhum ignorado (134,50 s). Total final Worker + UI: **461 aprovados**.
- UI específica: **33 aprovados**, dois arquivos (autocomplete e grade). Última execução com regressão SBC adicional: **36 aprovados**, um teste real condicional ignorado nessa execução; esse teste passou na suíte completa com arquivos reais.
- Typecheck aplicação (`tsc -b`, também no build) e testes (`npm run test:typecheck`): aprovados.
- Lint: aprovado sem erros ou avisos.
- Build: aprovado. Avisos preexistentes de anotações de dependências/bundle >500 kB; nenhum erro.
- UTF-8 estrito/mojibake: **283 arquivos, zero achados** em src/test/docs/migrations. git diff --check aprovado (somente aviso Git de normalização futura LF/CRLF).

Cobertura nova: quatro fontes, código/descrição, acento/caixa/espaços, debounce, resposta antiga, teclado, mouse, blur, vazio, erro, manual, snapshot, região/competência, NULL, regimes, custos SICRO, preço adotado preservado, seleção em duas linhas, salvar/reabrir e seleção após duplicação. Worker cobre autenticação, parceiro, gestor, escopo obra/planilha, referência forjada e preservação de versões anteriores. Regressões existentes de TSV, ordenação, paginação, XLSX, Biblioteca e concorrência foram mantidas.

## Validação visual local

Preview com Worker compilado em Miniflare e frontend Vite, usando cópia do backup já disponível e cliente/projeto/obra/planilha fictícios isolados. Nenhuma consulta a produção foi usada para essa validação.

- 1920×1080: sugestões alinhadas à célula, 12 opções, portal fora do recorte da tabela.
- 1366×768: busca por código, mouse/teclado e preço adotado preservado; scroll horizontal e vertical; abertura acima da célula perto do rodapé (popup y=281,39 até 601,39; célula y=605,39).
- 1024×1366: largura limitada ao viewport, descrições extensas em duas linhas, scroll horizontal da tabela e dropdown independente.
- 375×812: popup x=8 até 352, altura 320, opções tocáveis e scroll próprio; mantém a grade compacta existente.

Evidências locais ignoradas pelo Git: `.wrangler/autocomplete-servicos/1920.png`, `1366.png`, `1366-acima.png`, `1024.png`, `375.png`, logs de validação e scripts locais. Viewport restaurado e aba temporária fechada ao terminar.

Limites: validação mobile em viewport de navegador, sem aparelho/teclado virtual físico; latência de produção não medida nesta rodada. O preview reutiliza branding local de teste, sem alterações de branding no produto. Publicação depende de autorização explícita.

## Arquivos da rodada

- src/react-app/components/ObraPlanilhasPanel.tsx
- src/react-app/components/ServicoAutocomplete.tsx
- src/react-app/components/servico-autocomplete.css
- src/react-app/lib/preco-sugestao-servico.ts
- src/shared/bases-servicos.ts
- src/worker/bases/routes.ts
- src/worker/obras/planilhas.ts
- test/autocomplete-servicos.test.ts
- test/ui/autocomplete-servicos.test.tsx
- test/ui/planilhas-obra.test.tsx
- docs/RELATORIO-AUTOCOMPLETE-SERVICOS-PLANILHA.md

Parada: implementação local pronta para revisão. Não publicada; aguarda autorização.

## Publicação autorizada — 31/10/2026

Worker existente: **voia-app**. URL mantida: https://voia-app.bbrazgarcia.workers.dev.

**Version ID: a922a802-81a1-427b-beea-0c79d7d38e4e**. Versão anterior: cd2180ac-9729-4887-a18e-d84ac604f4da. Bindings preservados: DB → voia-db (217f7490-d357-4c36-827f-afd54589adb9), DOCUMENTOS_BUCKET → voia-documentos. Nenhuma migration, base, competência ou Worker novo. Nenhum commit/push. Nenhuma alteração adicional de código nesta etapa; somente atualização deste relatório.

Pré-deploy repetido separadamente: **259 Worker**, **202 UI** com arquivos oficiais habilitados (nenhum ignorado), **33 UI específicos de autocomplete/grade**, build, typecheck de testes/aplicação, lint e UTF-8 aprovados. UTF-8: 283 arquivos, zero achados. Build manteve apenas os avisos preexistentes de dependência/bundle. Configuração e status inicial confirmaram exatamente os 11 arquivos previstos.

O Wrangler autenticou a conta VOIA ENGENHARIA; foi necessário selecionar explicitamente seu account ID por variável de ambiente porque há outras contas no login. Nenhuma configuração do repositório foi modificada.

### Smoke tests publicados

19 verificações HTTP/assets aprovadas: health/API 200 com banco conectado; páginas/login; endpoints protegidos retornando 401 sem sessão; 12 assets JS/CSS comparados por SHA-256 com o build local. O novo endpoint scoped também retornou 401 sem sessão. Os assets publicados são idênticos aos validados localmente.

Sessão autenticada existente reutilizada em aba temporária. Obras, abertura da obra existente e listagem/abertura da planilha existente passaram. A única planilha de produção estava vazia, versão 1. Para validar o combobox, foi usada uma linha exclusivamente no rascunho local dessa aba: nenhum clique em Salvar, nenhum POST/PUT de criação/salvamento e nenhum item persistido. A validação final do D1 confirmou novamente versão 1 e **zero linhas reais**.

Endpoint autenticado `/api/obras/1/planilhas/1/catalogo`: armadura retornou 12 resultados, com mais disponíveis; a primeira janela contém SINAPI conforme a ordenação existente. Código 92767 retornou uma referência SINAPI. Página 2 de armadura retornou outros 12 IDs, sem interseção com a primeira.

Filtros autenticados de fonte, tipo, subtipo, MT e competência passaram: SINAPI composição 09/2026, SICRO equipamento 07/2026, SBC 09/2026 e VOIA. Cada filtro retornou somente a fonte esperada. Buscas SBC: concreto=10, pintura=1, alvenaria=4, elétrica=1, acessibilidade=12 na janela inicial (mais resultados). SINAPI, SICRO, SBC e VOIA foram encontrados em produção sem modificar as bases.

Combobox publicado: aparência tabular preservada, alinhamento à célula e abertura acima quando necessário, fonte/código/descrição/unidade/UF/competência/preços visíveis. A referência SINAPI 100063 sem preço apareceu como “Sem preço de referência”, nunca como zero. Evidência: `.wrangler/autocomplete-servicos/producao-armadura.png` (não versionada).

Interações verificadas: mouse, ↓, ↑, Enter, Esc, Tab (avançou para Un.), clique fora, texto manual, estado Buscando e nenhum resultado. Referência preservada e advertência de texto divergente apareceram. Biblioteca avançada abriu normalmente. Copy/paste TSV preencheu categoria/local/serviço/unidade/quantidade/preço no rascunho; seleção múltipla e duplicação local produziram duas linhas temporárias. Não foi confirmada exclusão. A confirmação nativa bloqueou a automação do navegador; cancelamento/encerramento da aba foi solicitado ao usuário, sem autorizar exclusão ou salvamento.

Preço publicado: no rascunho, R$ 17,50 foi digitado como adotado. Selecionar 92767 por mouse manteve o adotado. No detalhe, SINAPI exigiu regime explícito; escolher desonerado mudou a referência para **R$ 16,38** e manteve o adotado em **R$ 17,50**. Snapshot mostrou arquivo/hash/código/UF/competência/descrição/unidade. SICRO equipamentos foi consultado com custos tipados preservados; nenhum custo foi escolhido automaticamente.

Erro de busca é coberto pelo teste automatizado e pelo asset publicado idêntico; não foi provocada indisponibilidade de produção. Salvamento em lote, duplicação de planilha, exclusão efetiva e geração de XLSX com snapshot não foram executados remotamente por implicarem escrita ou dependerem de salvamento. Essas regressões passaram nos testes locais, incluindo concorrência, XLSX, subtotais, filtros e paginação. Isso não é uma alegação de execução de operações de escrita em produção.

### D1, preservação e ausência de escritas

Export completo foi rejeitado pela revisão automática de segurança por poder copiar dados sensíveis além do necessário; não foi executado. A alternativa usada contém exclusivamente SELECTs agregados e PRAGMA foreign_key_check, sem exportar registros reais. Não foi necessário novo backup/migration para esta publicação de código.

Resultados finais:

- SINAPI: **15.477**; SICRO: **9.017**; SBC: **400**; total oficial externo: **24.894**.
- Custos tipados SICRO: **18.495**; Biblioteca VOIA: **37**.
- FK: **zero violações**; última migration continua **0035_importacao_assistida.sql**.
- Clientes: 2; projetos: 4; obras: 1; planilhas: 1; itens de planilha: **0**; snapshots preexistentes: 1.
- Importações preexistentes: 4; evidências de importação: 0. Nenhuma importação desta rodada.
- Yara: registro presente, preservado. Contagens e tamanhos agregados das tabelas de dados reais coincidem com a cópia local anterior disponível. A única diferença nessa comparação foi o registro da migration 0035, já aplicado na rodada anterior (a cópia de ensaio tinha 34 registros de migration).
- Consultas remotas registraram **rows_written=0 / changed_db=false**. Nenhum SQL de escrita/migration foi executado. Nenhuma linha ou planilha real foi criada, alterada ou excluída nos smoke tests.
- **Zero uploads ao bucket R2 voia-documentos**; assets do deploy foram enviados ao armazenamento de assets do Worker, sem uso de DOCUMENTOS_BUCKET.

A comparação de contagens/tamanhos é agregada, não uma comparação criptográfica completa de cada registro. A preservação é sustentada também pela ausência de qualquer operação de escrita no fluxo executado. Logs e resultados de auditoria permanecem ignorados em `.wrangler/autocomplete-servicos/`.

Ponto de parada: publicado; aguarda autorização de commit/push. Não executar outra publicação, migration ou importação.

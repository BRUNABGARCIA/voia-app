# Implementação local SBC Cuiabá/MT 09/2026

Validação concluída em 30/10/2026. Branch `claude-modelos-processos-v2`; commit de partida `82e8ad8` — integra SICRO MT 07-2026 com custos tipados. Alterações permanecem locais, sem commit/push. Nenhuma migration remota, importação remota SBC ou publicação nesta rodada.

## Referência e extração

Fonte nativa `SBC`, nome `SBC · Cuiabá/MT · 09/2026 · Relatório importado`. Região CBA - Cuiabá - MT, atualização 01/09/2026, competência 09/2026. Não há comprovação de completude do catálogo; interface e snapshots informam essa limitação. A versão técnica identifica os PDFs, sem inventar edição oficial ou regime de desoneração.

PDFs de origem em Downloads:

| Arquivo | SHA-256 |
| --- | --- |
| Informativo SBC _ O melhor banco de composições analíticas COMPOSIÇÕES.pdf | `5431a82bf9cc76a98272e141e667600c2b3d3e37a10a408abab7a6ad28a32636` |
| Informativo SBC _ O melhor banco de composições analíticas ISUMOS.pdf | `71a0cf4fc26db2f7786fda092952c96cc5e24a597b6cc5e323aa7f2eb6e414fa` |

PDF.js extrai texto estruturado por coordenadas, sem OCR. O importador exige os dois arquivos auditados, verifica seus hashes e valida metadados, contagens e colunas antes da confirmação. Os valores são convertidos decimalmente para centavos; ausência não é convertida em zero. Os 400 preços destes PDFs estão informados e são positivos.

Conferência independente contra extrações anteriores por pdfplumber e pypdf: **400 registros, zero divergências** em código, descrição, unidade, preço e página; zero registros perdidos ou inventados. Manifesto normalizado: `2817dd4a6cfec592eb59ae86637a346b83c5be5c04adf0b6c8d329da633a32c0`.

Casos especiais preservados:

- Quatro prefixos numéricos: códigos 67104 (`14201SENSOR...`), 100200 (`1TELHA...`), 57590 (`20MURO...`) e 61209 (`7825CONDULETE...`).
- Unidade `UNN`, código 20677, preço 1,50, página 1 dos insumos.
- Dezesseis descrições multilinha, recompostas sem perda de conteúdo.
- Descrições repetidas com códigos distintos preservadas: 63641/65112 e 23610/190874/202164, inclusive seus preços diferentes quando existentes.
- Composições: páginas 1/2/3/4 com 64/69/67/0 registros; insumos: 63/63/60/14. Total 200 + 200.

## Backup e migration 0034

Backup já produzido e validado antes da retomada, reutilizado sem nova operação de produção:

`.wrangler/backups/voia-db-pre-0034-2026-10-30T19-45-06.sql`

SHA-256: `36efb2d9acc39cdd0c37b9bcdb0b2c61f536e6ffde22fd0b7ed4d972a6bec4b6`.

A migration `migrations/0034_fonte_sbc.sql` amplia o CHECK de `bases_referencia.tipo`. Como SQLite não altera esse CHECK diretamente, reconstrói fisicamente **somente bases_referencia**, copiando integralmente IDs e colunas, restaurando sequência AUTOINCREMENT, índice e quatro triggers originais. Preserva VOIA, SINAPI, SICRO, PROPRIA, IMPORTADA e OUTRA, acrescentando SBC. Não modifica linhas das outras tabelas nem preços.

Executar como uma única transação: `defer_foreign_keys=ON`, reconstrução, verificação efetiva de `pragma_foreign_key_check` por guard com CHECK, limpeza das tabelas técnicas e `defer_foreign_keys=OFF`. A verificação aborta em caso de órfão; não desliga `foreign_keys`. O encerramento explícito do modo diferido resolve a contabilização temporária de DROP/rename, depois da verificação real. Esse uso corresponde ao mecanismo documentado pelo [Cloudflare D1](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

Ensaios executados em SQLite e no runtime D1 local, sobre cópia restaurada do backup populado: aprovados. Comparação integral de linhas, IDs, sequência, índices e triggers aprovada. `integrity_check = ok`; `foreign_key_check = []`. Aceitação das sete fontes verificada em transação local revertida. A migration **não foi aplicada remotamente**.

## Ensaio de importação local e preservação

O Worker real foi executado com D1 local restaurado do backup; catálogo e API não foram simulados. A importação segue as etapas existentes de prévia, staging e confirmação, com validação server-side e permissões existentes.

| Verificação | Resultado local |
| --- | ---: |
| Bases lógicas SBC | 1 |
| Composições SBC | 200 |
| Insumos SBC | 200 |
| Referências SBC | 400 |
| Novas na segunda importação | 0 |
| Existentes na segunda importação | 400 |
| Duplicações semânticas | 0 |
| SINAPI preservado | 15.477 |
| SICRO preservado | 9.017 |
| Custos tipados SICRO preservados | 18.495 |
| Serviços VOIA preservados | 37 |
| Referências externas combinadas | 24.894 |

Mesmo manifesto reutiliza a sessão; outra sessão local com o mesmo conteúdo também produz zero inserções novas. Não houve deduplicação entre fontes. Comparação por conteúdo/hash das linhas originais das 38 tabelas confirmou preservação dos dados anteriores, incluindo clientes, projetos, obras, planilhas e snapshots históricos. As únicas adições fora da base SBC foram fixtures identificadas SOMENTE LOCAL. Yara não foi utilizada ou modificada. Verificação final da cópia: integridade `ok`, zero violações FK.

## Catálogo, busca e desempenho

Filtros Fonte SBC, Composição, Insumo, MT, Cuiabá e 09/2026 aprovados na API local. Interface verificada com SBC/MT/Cuiabá/09/2026 e busca concreto. Exibe nome, tipo, preço, natureza de relatório, região, atualização, arquivo, página e SHA-256. Não carrega o catálogo inteiro: paginação de 30 itens, sem IDs repetidos entre páginas.

| Fonte / busca | Página 1 | Página 2 | Latência local observada |
| --- | ---: | ---: | ---: |
| SBC concreto | 10 | 0 | 7 ms |
| SBC pintura | 1 | 0 | 5 ms |
| SBC alvenaria | 4 | 0 | 5 ms |
| SBC elétrica | 1 | 0 | 5 ms |
| SBC acessibilidade | 30 | 30 | 6 ms |
| SINAPI calha | 30 | 30 | 18 ms |
| SINAPI impermeabilização | 25 | 0 | 19 ms |
| SINAPI alvenaria | 30 | 30 | 18 ms |
| SINAPI pintura | 30 | 30 | 17 ms |
| SICRO escavação | 30 | 30 | 10 ms |
| SICRO concreto | 30 | 30 | 17 ms |
| SICRO transporte | 30 | 30 | 18 ms |
| SICRO pavimentação | 3 | 0 | 10 ms |
| SICRO drenagem | 30 | 30 | 13 ms |
| SICRO sinalização | 30 | 30 | 9 ms |

Acessibilidade tem 62 resultados na amostra SBC; após a segunda página há mais. Impermeabilização, hidráulica, cobertura, demolição e revestimento retornaram zero para SBC (5 ms); nenhuma correspondência foi inventada. Os resultados SINAPI/SICRO foram comparados integralmente, nas duas páginas, com a cópia anterior: idênticos. Medições locais não representam garantia de latência de produção.

Finalização da primeira importação: 19 ms; fluxo de prévias/staging/finalização medido: 87 ms. Segunda finalização: 11 ms. Os testes utilizam o catálogo combinado real restaurado, sem importar a base remotamente.

## Planilha e interface

Fixture exclusiva: obra 2 / planilha 2, `Ensaio SBC SOMENTE LOCAL`. Inserção e snapshot persistido conferidos: fonte, código, descrição, unidade, preço de referência, tipo e metadados documentais completos. Preço adotado manualmente **R$ 987,65** foi preservado após reseleção explícita de referência SBC. A reseleção exige snapshot válido do catálogo ativo; não permite aproveitar o fallback histórico para trocar uma referência. A duplicação histórica existente conserva seu comportamento.

XLSX gerado e aberto programaticamente: `.wrangler/implementacao-sbc/planilha-sbc.xlsx`. Preço adotado e rastreabilidade documental conferidos. Snapshots históricos anteriores comparados sem alteração. Escritas continuam sujeitas a acesso à obra, papel e concorrência otimista existentes.

Revisão visual de detalhe técnico e catálogo em **1920×1080, 1366×768, 1024×1366 e 375×812**. Grade/filtros e conteúdo documental adaptam-se; em telas pequenas os painéis têm rolagem. Evidências PNG em `.wrangler/implementacao-sbc/detalhe-*.png` e `catalogo-*.png`. O logo magenta e usuário “Validação local SINAPI” são placeholders do harness local reaproveitado, não alterações no produto. O botão da base SBC e o diálogo agora identificam importação de PDFs.

## Validações finais

- Worker completo: **248 testes aprovados em 28 arquivos**.
- UI completo, com arquivos reais SINAPI/SICRO/SBC habilitados: **169 testes aprovados em 17 arquivos**.
- SBC específico: **5 Worker + 4 UI** aprovados, incluídos nos totais acima.
- Após os últimos ajustes de rótulos e validação da reseleção: SBC Worker 5/5 e UI SBC + bases 16/16 aprovados novamente.
- Regressões SINAPI/SICRO: testes completos e comparações de dados/buscas aprovados.
- `npm run test:typecheck`: aprovado; build também executa typecheck da aplicação.
- `npm run lint`: aprovado.
- `npm run build`: aprovado novamente após os últimos ajustes. Avisos de bundle grande e anotações de dependência não impedem o build.
- UTF-8/mojibake: **266 arquivos verificados, zero ocorrências**, com decodificação UTF-8 estrita em src/test/docs/migrations; resultado em `.wrangler/auditoria-sicro/utf8.json`.
- `git diff --check`: aprovado.

Uma repetição pontual dos testes no sandbox não conseguiu iniciar o runtime Worker/ler o asset temporário PDF.js. Executados novamente com as permissões locais necessárias, passaram. Não foi tratada como falha funcional.

Evidências locais ignoradas pelo Git: `migration.json`, `migration-worker.log`, `independente.json`, `ensaio.json`, `banco-verificado.json`, `conferir.log`, `worker-final.log`, `ui-final.log`, `worker-sbc-final.log`, `ui-sbc-final.log`, `typecheck-final.log`, `lint-final.log` e `build-final.log`, em `.wrangler/implementacao-sbc/`.

## Arquivos da rodada no Git

Modificados:

1. `src/react-app/components/BuscaCatalogoServicos.tsx`
2. `src/react-app/components/ImportarBaseServicos.tsx`
3. `src/react-app/components/ObraPlanilhasPanel.tsx`
4. `src/react-app/pages/BasesServicos.tsx`
5. `src/shared/bases-servicos.ts`
6. `src/shared/planilhas.ts`
7. `src/worker/bases/routes.ts`
8. `src/worker/obras/planilhas.ts`

Criados, incluindo auditoria já existente ao retomar:

9. `docs/RELATORIO-AUDITORIA-SBC-CUIABA-09-2026.md`
10. `docs/RELATORIO-IMPLEMENTACAO-SBC-CUIABA-09-2026.md`
11. `migrations/0034_fonte_sbc.sql`
12. `src/react-app/components/ProvenienciaSbc.tsx`
13. `src/react-app/lib/importar-sbc.ts`
14. `src/shared/sbc.ts`
15. `test/sbc.test.ts`
16. `test/ui/sbc.test.tsx`

Scripts, backups, bancos, logs, XLSX e capturas em `.wrangler/` são artefatos locais de ensaio, ignorados pelo Git. Nenhum PDF/backup/banco é incluído no código.

## Etapas posteriores autorizadas: produção e publicação

Esta seção atualiza o estado após a validação local descrita acima. A migration 0034 e a importação SBC foram autorizadas e concluídas em etapas separadas anteriores ao deploy. Não foram repetidas na etapa de publicação.

### Estado de produção antes da publicação

A migration 0034 está registrada com ID 34, aplicada em 31/10/2026 às 01:18:59 UTC (30/10 às 21:18:59 em Cuiabá). A importação posterior criou uma única referência SBC e exatamente 400 itens (200 composições + 200 insumos). A comparação PDF → extração auditada → D1 apresentou zero divergências nos 400 registros e na proveniência; quatro prefixos numéricos, UNN, descrições repetidas e dezesseis descrições multilinha preservados. Zero preços NULL, zero e negativos. O reconhecimento controlado dos mesmos arquivos retornou 0 novos / 400 existentes, sem novas escritas.

Na primeira tentativa de importação, o script operacional omitiu o INSERT RETURNING da base e ocorreu erro FK. O rollback integral foi confirmado. O registro desse INSERT foi corrigido no script ignorado pelo Git, o arquivo SQL completo foi ensaiado e a importação foi concluída com sucesso. Não há divergência remanescente. Essa foi uma etapa anterior; nenhuma reimportação foi executada para publicar.

### Validações imediatamente anteriores ao deploy

- Worker: **248/248**, 28 arquivos (`worker-deploy-final.log`).
- UI com fontes reais SINAPI/SICRO/SBC: **169/169**, 17 arquivos (`ui-deploy-final.log`).
- `npm run test:typecheck`: aprovado (`typecheck-deploy.log`).
- `npm run lint`: aprovado (`lint-deploy.log`).
- `npm run build`: aprovado (`build-deploy.log`). Aviso não bloqueante de tamanho de chunk.
- UTF-8/mojibake: 266 arquivos, zero ocorrências.
- `git diff --check`: aprovado.

### Deploy

Publicado em 30/10/2026, no Worker **existente `voia-app`**, usando a configuração atual, sem criar Worker ou alterar domínio.

- URL: https://voia-app.bbrazgarcia.workers.dev
- **Version ID: `c98c16f8-7b8e-4ece-943a-42b604e22147`**.
- D1 preservado: **`DB` → `voia-db`**, ID `217f7490-d357-4c36-827f-afd54589adb9`.
- R2 preservado: **`DOCUMENTOS_BUCKET` → `voia-documentos`**.
- Log: `.wrangler/implementacao-sbc/deploy.log`.
- Sem migration, importação, escrita administrativa em dados de negócio, commit ou push nesta etapa.

### Smoke tests da versão publicada

HTTP público: login e rota de bases com HTML do build atual; entry e chunks novos servidos com sucesso; `/api/health` retornou status ok, D1 conectado e schema disponível. APIs protegidas sem sessão retornaram 401 conforme esperado. Evidência: `producao/smoke-pos-deploy.json`.

Com sessão autenticada no navegador, a tela publicada Bases de Serviços exibiu exatamente **SBC · Cuiabá/MT · 09/2026 · Relatório importado**, 400 itens, fonte SBC, UF MT, competência 09/2026, origem com completude não comprovada e ação Importar PDFs. SINAPI 15.477 e SICRO 9.017 também foram conferidos na tela. Captura: `producao/bases-publicadas.png`.

As consultas abaixo foram executadas por GET nas APIs da **versão publicada**, com a sessão existente do navegador, e não por executor local de SQL. Filtros de fonte, MT e competência aplicados; para SBC também Cuiabá. Duas páginas verificadas em cada busca, sem repetição de IDs.

| Fonte | Termo | Página 1 | Página 2 |
| --- | --- | ---: | ---: |
| SBC | concreto | 10 | 0 |
| SBC | pintura | 1 | 0 |
| SBC | alvenaria | 4 | 0 |
| SBC | elétrica | 1 | 0 |
| SBC | acessibilidade | 30 | 30 |
| SINAPI | calha | 30 | 30 |
| SINAPI | impermeabilização | 25 | 0 |
| SINAPI | alvenaria | 30 | 30 |
| SINAPI | pintura | 30 | 30 |
| SICRO | escavação | 30 | 30 |
| SICRO | concreto | 30 | 30 |
| SICRO | transporte | 30 | 30 |
| SICRO | pavimentação | 3 | 0 |
| SICRO | drenagem | 30 | 30 |
| SICRO | sinalização | 30 | 30 |

Filtros Composição e Insumo foram testados para cada uma das três fontes: 30 resultados corretos na primeira página de cada combinação. Todos os resultados SBC mantiveram o nome exato do relatório. Evidência: `producao/smoke-autenticado.json`, com páginas, IDs e filtros. Nenhuma ação de importação/criação/edição foi acionada.

A aba que estava aberta antes do deploy tentou inicialmente buscar um chunk do build antigo e exibiu falha de importação dinâmica. Recarregar a página carregou os assets atuais e resolveu a falha; os smokes autenticados foram executados após esse recarregamento. Nenhuma alteração extra no código foi feita após publicar.

### Regressão final do D1

Consultas somente leitura após o deploy confirmaram:

| Dado | Quantidade |
| --- | ---: |
| SINAPI | 15.477 |
| SICRO | 9.017 |
| SBC | 400 |
| Referências oficiais externas | 24.894 |
| Custos tipados SICRO | 18.495 |
| Biblioteca VOIA | 37 |
| Violações FK em produção | 0 |

Export pós-deploy restaurado localmente: `integrity_check = ok`, `foreign_key_check = []`. Comparação das 37 tabelas fora de sessões confirmou todas as linhas de negócio idênticas ao export pós-importação, incluindo dados da Yara. Em usuários, somente `ultimo_login_em` foi excluído da igualdade, pois o login normal da sessão de smoke atualizou esse campo. As sessões são dados de autenticação; a contagem permaneceu 15. Não houve escrita administrativa de dados reais.

SHA-256 do export pós-deploy: `fdeb56fc9272413affc122043d93c8b768abda7687362e54d63fcd2bb81b7d19`. Evidências: `producao/regressao-pos-deploy.json` e `producao/preservacao-pos-deploy.json`, sob `.wrangler/implementacao-sbc/`. Exports e evidências seguem ignorados pelo Git.

### Encerramento

Publicação e smoke tests concluídos. A lista de 16 arquivos da rodada acima permanece a lista candidata ao commit; apenas este relatório foi atualizado após o deploy. Nenhum commit ou push foi realizado. Aguardar autorização específica para commit/push.

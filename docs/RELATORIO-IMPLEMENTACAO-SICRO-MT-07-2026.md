# Implementação e publicação SICRO MT 07/2026

30/10/2026. Branch `claude-modelos-processos-v2`, HEAD `c98d589`. Pacote real auditado `mt-07-2026.7z`, SHA-256 `f3db08cf1934d658e9e0e94ebdec61085ffd0df9ddcac12572121b9ab05d2c2c`. Arquitetura existente SINAPI preservada. **As seções iniciais registram a etapa local anterior às autorizações. A aplicação da 0033, importação real e publicação autorizadas estão documentadas na seção final. Sem commit ou push.**

## Backup atualizado e preservação

Exportado do D1 de produção `voia-db` após `wrangler whoami` confirmar a conta VOIA ENGENHARIA. Arquivo local: `C:\Users\Bruna Braz Garcia\Downloads\voia-app-visual-v2\voia-app\.wrangler\backups\voia-db-pre-0033-2026-10-30T16-00-49.sql`. 30,932,377 bytes. SHA-256 **`203759853b90a18b40bc19a1850d8ce97dd251ba3e743cb1c8188ec4f6a9ff37`**. Restauração SQLite: integrity_check `ok`, foreign_key_check sem linhas. O hash coincide com o último backup pós-SINAPI, confirmando conteúdo exportado idêntico, não reutilização do backup antigo: este arquivo foi novamente exportado nesta rodada.

0033 aplicada somente em cópia Miniflare isolada. Comparação de todas as linhas originais nas **36 tabelas**: idênticas, incluindo clientes, projetos, Obra, RDO/fotos, planilhas/snapshots, Yara, configurações, sessões existentes, histórico de migrations e importações anteriores. Os 15.477 itens SINAPI e 37 serviços VOIA foram preservados. As únicas entidades adicionais de negócio são fixtures explícitas de cliente/projeto/Obra/planilha e uma sessão/usuário **somente locais**, para testar o fluxo sem usar os dados reais.

## Schema exato da 0033

Arquivo `migrations/0033_sicro_custos.sql`. Somente CREATE: duas tabelas relacionadas, índice e triggers de identidade/imutabilidade. Nenhum ALTER, UPDATE, DELETE ou INSERT de dados históricos. Restauração operacional exige backup, não DROP em produção.

```sql
-- Additive only. No existing row, SINAPI regime or worksheet is rewritten.
CREATE TABLE base_item_sicro (
 item_id INTEGER PRIMARY KEY REFERENCES base_itens(id) ON DELETE RESTRICT,
 subtipo TEXT NOT NULL CHECK(subtipo IN('composicao','material','equipamento','mao_de_obra')),
 memorias TEXT NOT NULL CHECK(json_valid(memorias))
);
CREATE TABLE base_item_custos (
 id INTEGER PRIMARY KEY,
 item_id INTEGER NOT NULL REFERENCES base_item_sicro(item_id) ON DELETE RESTRICT,
 tipo TEXT NOT NULL,edicao TEXT NOT NULL,valor_decimal TEXT,
 unidade TEXT NOT NULL,selecionavel INTEGER NOT NULL CHECK(selecionavel IN(0,1)),
 dados TEXT NOT NULL CHECK(json_valid(dados)),
 CHECK(valor_decimal IS NULL OR (length(valor_decimal) BETWEEN 1 AND 60 AND json_valid(valor_decimal) AND valor_decimal NOT GLOB '*[^0-9.]*' AND valor_decimal GLOB '[0-9]*')),
 UNIQUE(item_id,tipo,edicao)
);
CREATE INDEX idx_sicro_subtipo_item ON base_item_sicro(subtipo,item_id);
CREATE TRIGGER sicro_base_unica BEFORE INSERT ON bases_referencia WHEN NEW.tipo='SICRO'
BEGIN
 SELECT RAISE(ABORT,'SICRO: uma referência por UF, competência e versão') WHERE NEW.regime<>'' OR EXISTS(SELECT 1 FROM bases_referencia WHERE tipo='SICRO' AND uf=NEW.uf AND competencia=NEW.competencia AND versao=NEW.versao);
END;
CREATE TRIGGER sicro_contexto_fonte BEFORE INSERT ON base_item_sicro BEGIN
 SELECT RAISE(ABORT,'Contexto SICRO exige item SICRO') WHERE NOT EXISTS(SELECT 1 FROM base_itens i JOIN bases_referencia b ON b.id=i.base_id WHERE i.id=NEW.item_id AND b.tipo='SICRO');
END;
CREATE TRIGGER sicro_contexto_update BEFORE UPDATE ON base_item_sicro BEGIN SELECT RAISE(ABORT,'publique nova versão da base'); END;
CREATE TRIGGER sicro_contexto_delete BEFORE DELETE ON base_item_sicro BEGIN SELECT RAISE(ABORT,'preserve a referência'); END;
CREATE TRIGGER sicro_custo_update BEFORE UPDATE ON base_item_custos BEGIN SELECT RAISE(ABORT,'publique nova versão da base'); END;
CREATE TRIGGER sicro_custo_delete BEFORE DELETE ON base_item_custos BEGIN SELECT RAISE(ABORT,'preserve a referência'); END;
```

`base_item_sicro` guarda subclasse e memórias documentais. `base_item_custos` guarda conceito, edição, unidade/contexto, valor decimal textual NULL ou não negativo, selecionabilidade e JSON de rastreabilidade. Chave única item+tipo de custo+edição; contexto só aceita item de base SICRO. Snapshot de planilhas continua no JSON existente, com campos opcionais. SINAPI não recebe colunas, conversões ou regimes novos.

## Precisão e custos

O campo autoritativo é **decimal textual bruto do OOXML**, sem conversão a float ou centavos. Preserva inclusive dígitos de representação Excel além das quatro casas exibidas nos PDFs. UI apresenta a precisão armazenada, exportação a mantém em texto dentro do snapshot. Na adoção explícita, apenas o preço adotado é convertido a centavos por aritmética inteira BigInt e arredondamento half-up. A referência original nunca é sobrescrita.

| Subtipo | Referência selecionável | Outros dados preservados |
|---|---|---|
| Composição | Total publicado do sintético, conferido com total direto analítico | Bloco analítico integral: produção, FIC/FIT, equipamentos, mão de obra, materiais, auxiliares, tempo fixo, transporte e subtotais |
| Material | Preço unitário oficial, inclusive NULL | Linha e cabeçalho original, unidade, origem MT |
| Mão de obra | Custo total por edição | Analítico de salário, encargos, adicionais, complementares e percentuais originais, nas duas edições |
| Equipamento | Produtivo/improdutivo por edição, sem escolha automática | Aquisição, depreciação, capital, seguros/impostos, manutenção, operação, mão de obra de operação |

Edição de equipamento sem sufixo é rotulada “edição sem sufixo”, sem inventar equivalência documental ao SINAPI. A outra edição mantém “com desoneração”. Mão de obra mantém suas próprias edições “sem desoneração” / “com desoneração”, conforme auditoria aprovada. Uma única base lógica SICRO · MT · 07/2026; não criar uma base por arquivo ou por custo.

## Importador e mapeamento dos arquivos

`src/react-app/lib/importar-sicro.ts` recebe os 12 XLSX oficiais pelo nome do pacote auditado, sem PDF ou 7z no navegador. Sintéticos validam cabeçalho e código; o analítico confirma Mato Grosso/Julho/2026 em todos os blocos e seus totais. UF MT e competência 07/2026 são exigidas pelo fluxo de importação da interface. Arquivos faltantes, repetidos, códigos conflitantes, fórmula em worksheet, erro de célula e total divergente interrompem a importação. Não executa fórmulas nem busca links externos. Os arquivos oficiais possuem partes externalLinks residuais; essas partes são ignoradas, nunca infladas nem seguidas. Nenhuma fórmula foi encontrada nos dados oficiais auditados.

| Relatório XLSX (prefixo MT 07-2026) | Mapeamento |
|---|---|
| Sintético de Composições de Custos | A código textual, B descrição, C unidade, D total publicado |
| Analítico de Composições de Custos | Blocos de cabeçalho com UF/data, código duas linhas abaixo, total direto em I, matriz completa preservada |
| Sintético de Materiais | A código, B descrição, C unidade, D preço unitário |
| Sintético de Equipamentos (2 edições) | A/B identidade; C aquisição; D depreciação; E capital; F seguros/impostos; G manutenção; H operação; I mão de obra de operação; J produtivo; K improdutivo. Custos horários usam unidade h explícita do cabeçalho |
| Sintético de Mão de Obra (2 edições) | A/B identidade, C unidade, D custo total |
| Analítico de Mão de Obra (2 edições) | Blocos desde Código, salário/encargos/custo total e matrizes originais |
| Analítico de Encargos Sociais e Trabalhistas (2 edições) | Código A; dois cabeçalhos e linha percentual integral por código, sem tratá-los como moeda |
| Sintético de Origem de Preços | A código, AD sigla MT; arquivo/hash/aba/linha preservados em metadados |

O número da linha física é preservado mesmo quando o XML omite linhas vazias; células omitidas ou autocontidas não deslocam colunas. Segurança: até 20 MiB por XLSX, 300 entradas ZIP, parte até 150 MiB, partes lidas até 180 MiB por arquivo, até 220 mil linhas/64 colunas; rejeita caminhos suspeitos, VBA, DTD/entidades, XML com substituição inválida e fórmulas. Os limites próprios suportam as 210.814 linhas do analítico real sem relaxar o importador SINAPI/genérico.

## Identidade, ausência, zero e repetições

Identidade pesquisável: fonte SICRO + UF + competência + versão da referência + tipo + código + subclasse. Edição participa da identidade de cada custo, não duplica o resultado pesquisável. O manifesto tem nomes e SHA-256 de todos os XLSX em ordem estável. Assinaturas canônicas incluem custos, origem e memórias. O staging/finalização existente publica itens, contextos e custos numa única transação; alteração de conteúdo exige nova versão. Fonte SICRO agora exige payload tipado no servidor; não aceita importação genérica sem semântica.

**68 materiais “-”**: valor normalizado NULL; texto original “-” permanece na memória documental. **Quatro zeros publicados**: `0307730`, `1110000`, `4900001`, `4915801` permanecem decimal `0`, disponíveis como zero oficial. Não há conversão NULL↔zero. **21 repetições em cada edição** de equipamentos: colapsadas somente quando a linha inteira é idêntica. Todas as linhas físicas de origem são anexadas a cada custo. Total de 42 ocorrências extras, não 42 novos itens. Conteúdo conflitante bloqueia o parser.

## Contagens recalculadas e validação independente

| Subtipo | Linhas por edição | Identidades | Custos tipados |
|---|---:|---:|---:|
| Composição | 6.619 | 6.619 | 6.619 |
| Material | 1.704 | 1.704 | 1.704 |
| Mão de obra | 145 × 2 | 145 | 290 |
| Equipamento | 570 × 2 | 549 | 9.882 |
| Total | — | **9.017** | **18.495** |

Validador independente local em Python/openpyxl + ElementTree (não reutiliza funções do parser TS): compara código/descrição/unidade, valores brutos das células XML, edição, hashes e endereços de todas as fontes. Foram **18,873 verificações de custo** incluindo as repetições e **16,910 memórias técnicas** comparadas célula a célula. Resultado: **zero divergências, falsos NULL, valores inventados ou códigos divergentes**. Segunda conferência após importação compara os 9.017 itens e todos os 18.495 custos/16.910 memórias no SQLite contra a saída validada. Integridade ok, FK zero, duplicação semântica zero.

## Catálogo e planilha

Fonte SICRO integrada à busca existente, tipo Composição/Insumo e subtipo Equipamento/Material/Mão de obra, UF e competência. Somente a página solicitada é transferida; custos tipados são hidratados em lote apenas para os resultados SICRO visíveis. Item sintético e equipamento mostram os valores próprios, sem colunas SINAPI forçadas na consulta/preview SICRO. Gestor continua apenas consulta, escrita continua Admin, parceiro continua sem acesso ao catálogo global.

`itemDoCatalogo` cria snapshot com todos os custos tipados, fonte, origem, código, descrição, unidade, UF, competência, tipo/subtipo e edição. Arquivo/hash/aba/linhas/coluna seguem com cada custo. Referência selecionada é uma chave conceito+edição validada server-side contra o snapshot imutável. Equipamento não recebe escolha automática; custo de uma composição/material único pode ser identificado automaticamente como referência, mas jamais como preço adotado. Mão de obra com duas edições exige escolha. As memórias analíticas integrais ficam no contexto imutável relacionado, sem multiplicar todo analítico em cada linha de planilha.

Ensaio via API real de planilhas no Miniflare: equipamento E9001, seleção alternada nas quatro opções, snapshot validado e preço adotado **98765 centavos mantido**. Exportação XLSX conferida por openpyxl: colunas novas para snapshot SICRO e chave escolhida, preço adotado independente. Nenhum orçamento/medição é criado automaticamente.

## Ensaio local, buscas e performance

Backup restaurado em `.wrangler/implementacao-sicro/estado-1793391524849/miniflare-D1DatabaseObject/9938ee90f8cf6ccbcce93f87f8d80f113b84fb6275455a02cf25b1df1bed552c.sqlite`. Importação real via endpoints e permissões existentes, com **61 lotes**, payload canônico de **38,874,675 bytes** (inclui memórias). Publicação de 9017 novos itens. Tempo local de prévia + recebimento + finalização: **4368 ms**, finalização **1187 ms**. Repetição do mesmo manifesto retorna importação existente. Outra sessão com conteúdo idêntico: **0 novos, 9.017 existentes**, finalização **505 ms**. Não houve ensaio remoto de idempotência.

Catálogo combinado: **24.494 referências + 37 serviços VOIA = 24.531 candidatos**. Resultados abaixo são chamadas autenticadas da API em Miniflare, não estimativas de latência de produção. Cada par indica quantidade página 0 / página 1; páginas sem IDs repetidos.

| Busca | SICRO páginas | SINAPI páginas | SICRO ms | SINAPI ms |
|---|---:|---:|---:|---:|
| escavação | 30 / 30 | 30 / 30 | 16 | 19 |
| concreto | 30 / 30 | 30 / 30 | 9 | 18 |
| transporte | 30 / 30 | 30 / 30 | 10 | 18 |
| pavimentação | 3 / 0 | 30 / 30 | 8 | 18 |
| drenagem | 30 / 30 | 30 / 30 | 9 | 18 |
| sinalização | 30 / 30 | 30 / 12 | 9 | 18 |
| calha | 1 / 0 | 30 / 30 | 8 | 18 |
| impermeabilização | 2 / 0 | 25 / 0 | 8 | 17 |
| alvenaria | 10 / 0 | 30 / 30 | 9 | 18 |
| pintura | 30 / 30 | 30 / 30 | 9 | 17 |

Filtros por subclasse retornam somente custos do subtipo correto, limitados a 30 linhas. Regressão SINAPI código 39577: R$ 31.367,59 em ambos os regimes preservados. Índices existentes de base/tipo/código e base ativa/fonte/UF/competência mantidos. O novo índice subtipo/item é usado pela subconsulta do filtro SICRO por subtipo; hidratação por item usa PK e UNIQUE(item,tipo,edição). Busca por contém continua `instr` normalizado, sem alegar que B-tree resolve substring. Não foi implantado FTS nem carregamento integral no frontend.

SQLite combinado medido: **156,844,032 bytes**. O crescimento inclui memórias analíticas e duas sessões legítimas de staging (importação e reimportação de teste); não extrapolar esse tamanho como custo exato de produção. O payload JSON é maior que XLSX por descompactação/rastreabilidade. A importação remota futura precisa de novo backup, conferência e autorização; limites/tempos reais do D1 remoto ainda não foram ensaiados para SICRO.

## Validação visual e testes

Revisados no navegador local a busca E9001 e o detalhe real da planilha, nas dimensões 1920×1080, 1366×768, 1024×1366 e 375×812. Seleção e preço adotado legíveis; grid de filtros responsivo, detalhe rolável e sem mudança no redesign geral. Evidências em `.wrangler/implementacao-sicro/busca-{1920,1366,1024,375}.png` e `detalhe-{1920,1366,1024,375}.png`. O logo magenta é o placeholder já existente do preview local, não alteração de branding do produto. Servidores e aba temporários encerrados após revisão.

**243 testes Worker (27 arquivos) + 165 testes UI (16 arquivos) = 408 aprovados, nenhum ignorado na validação final.** Os arquivos reais SICRO e SINAPI foram habilitados nos testes. Worker foi novamente executado após fazer o filtro de subtipo consultar o índice da 0033: 243 aprovados. Typecheck (`test:typecheck` e `tsc -b`), lint e build: aprovados. Avisos de build já existentes: anotação Zod e bundle principal >500 kB; nenhum erro. UTF-8 estrito/mojibake: **258 arquivos, zero achados** em src/test/docs/migrations. `git diff --check` aprovado. Filtro de subtipo usa subconsulta com `idx_sicro_subtipo_item`; EXPLAIN QUERY PLAN confirmou uso de índice covering. Esquemas, índices e triggers anteriores foram comparados e permaneceram idênticos. O teste SICRO real pode ser reproduzido com VOIA_SICRO_DIR apontando para a extração local; o SINAPI real com VOIA_SINAPI_REAL apontando para o ZIP validado. Nenhum arquivo oficial grande ou backup será versionado.

## Arquivos alterados / adicionados no working tree

A auditoria inicial já estava não versionada antes desta implementação; os demais arquivos pertencem à presente rodada. Scripts de ensaio e arquivos oficiais estão em `.wrangler`, ignorados pelo Git.
- `docs/RELATORIO-AUDITORIA-SICRO-MT-07-2026.md`
- `docs/RELATORIO-IMPLEMENTACAO-SICRO-MT-07-2026.md`
- `migrations/0033_sicro_custos.sql`
- `src/react-app/components/BuscaCatalogoServicos.tsx`
- `src/react-app/components/CustosSicro.tsx`
- `src/react-app/components/ImportarBaseServicos.tsx`
- `src/react-app/components/ObraPlanilhasPanel.tsx`
- `src/react-app/lib/importar-sicro.ts`
- `src/react-app/lib/planilha-xlsx.ts`
- `src/react-app/pages/BasesServicos.tsx`
- `src/react-app/styles/bases-servicos.css`
- `src/shared/bases-servicos.ts`
- `src/shared/planilhas.ts`
- `src/shared/sicro.ts`
- `src/worker/bases/catalogo.ts`
- `src/worker/bases/routes.ts`
- `src/worker/obras/planilhas.ts`
- `test/bases-servicos.test.ts`
- `test/sicro.test.ts`
- `test/ui/sicro-real.test.tsx`
- `test/ui/sicro.test.tsx`

## Riscos e ponto de parada

- A edição de equipamento sem sufixo não é rotulada como regime SINAPI.
- Siglas de origem MT permanecem literais: a legenda RGB não foi usada para inventar traduções.
- Valores brutos Excel podem exibir mais casas que o PDF; preservados deliberadamente, sem normalização silenciosa.
- Custo direto não é preço final com BDI.
- Adoção arredonda explicitamente a centavos; referência original permanece exata.
- Memórias são imutáveis e armazenadas separadamente; backups/exportações contêm dados reais e permanecem somente locais.
- Antes de qualquer deploy, a migration precisa ser aplicada com autorização; esta versão não deve ser publicada contra schema antigo.

**Ponto de parada da etapa local: foi respeitado. Depois das autorizações explícitas, a 0033 foi aplicada em uma etapa separada e a importação/publicação foram executadas conforme a seção abaixo.**


## Importação real e publicação autorizadas — 30/10/2026

**Resultado final: importação e deploy concluídos, sem divergência. Nenhuma nova migration nesta etapa, reimportação remota de teste, dados de demonstração, commit ou push.**

0033 já registrada como ID 33 antes desta importação. Backup imediatamente anterior novamente exportado e com SHA-256 `504475e153e00885e92a6ebc02e27d9c5acd269a4e09b6a39fe44481f76c9daf`, igual ao pós-migration validado. Pacote e os 12 XLSX novamente conferidos por hash. O SQL exato foi primeiro aplicado a uma cópia local desse backup, com comparação integral aprovada antes da execução remota.

SQL real: 41,385,649 bytes, 726 lotes, instrução máxima 60,187 bytes, SHA-256 `515b7ff5ba3aa9ddb1bf44192f25eaacb981e25338c417b19183054a024cbdb1`. Executado uma única vez via Wrangler D1 no `voia-db`, sem criar sessão de teste ou usuário em produção. Uma nova base real ID 2, `SICRO · MT · 07/2026`, UF MT, competência/versão 07/2026 e regime da base vazio. Uma sessão de importação concluída, `ca4ec6d2-3f28-46af-ad53-105f41bc161d`, manifesto `829a869ebdd0e76aa7651e5af7de49f5f1c4a157991b973ceddbf4aa82317097`. O guard de finalização validou contagens/NULL/zeros, com restrições de identidade e FK existentes.

Contagens reais diretamente no D1: **6.619 composições, 1.704 materiais, 145 itens de mão de obra e 549 equipamentos = 9.017 referências únicas. 18.495 custos tipados e 16.910 memórias técnicas preservados**. Preço de referência continua separado de preço adotado; nenhuma planilha foi alterada. Equipamento não possui uma escolha global automática de produtivo/improdutivo.

| Custo | Edições | Registros |
|---|---|---:|
| Total publicado de composição | publicada | 6.619 |
| Preço unitário de material | publicada | 1.704 |
| Custo total de mão de obra | sem/com desoneração | 145 + 145 |
| Produtivo de equipamento | sem sufixo/com desoneração | 549 + 549 |
| Improdutivo de equipamento | sem sufixo/com desoneração | 549 + 549 |
| Demais 7 componentes de equipamento | ambas as edições | 7.686 |

**68 materiais permanecem NULL**, com “-” original preservado. Quatro zeros oficiais: `0307730`, `1110000`, `4900001`, `4915801`. Linhas de origem dos equipamentos consolidados preservam **21 repetições por edição**, sem novos resultados pesquisáveis. Duplicação semântica: **zero**.

Export pós-importação: `C:\Users\Bruna Braz Garcia\Downloads\voia-app-visual-v2\voia-app\.wrangler\backups\voia-db-pos-importacao-sicro-2026-10-30T16-42-41.sql`. SHA-256 **`36efb2d9acc39cdd0c37b9bcdb0b2c61f536e6ffde22fd0b7ed4d972a6bec4b6`**. Restaurado em SQLite local para executar **integrity_check: ok** e **foreign_key_check: zero violações**. FK também consultada diretamente no D1 remoto. O D1 não disponibiliza integrity_check via sua API; por isso a integridade estrutural foi verificada na restauração integral do export de produção, sem representá-la como um PRAGMA remoto bem-sucedido.

Todas as linhas anteriores das **38 tabelas preexistentes** foram comparadas com o backup pós-0033 e preservadas. As 32 tabelas fora do escopo de importação permanecem integralmente iguais; as seis tabelas de importação/catálogo somente receberam os novos registros autorizados. Schema, índices, triggers e os 33 registros de migrations permanecem idênticos. **15.477 referências SINAPI, 37 serviços VOIA, clientes, projetos, obras, RDOs/fotos, planilhas e Yara preservados.** Cada item/custo/memória SICRO do export foi comparado com a saída normalizada anteriormente validada contra os XLSX, sem diferenças.

### Buscas, filtros e amostras diretamente na produção

Executadas **25 consultas SQL somente leitura no D1 de produção**, reproduzindo o SELECT do catálogo e o filtro indexado por subtipo. Não foram apresentadas como testes HTTP autenticados da interface de produção. Fonte/UF/competência, tipos Composição/Insumo e subtipos Equipamento/Material/Mão de obra aprovados. Amostra distribuída em **20 códigos e 40 custos oficiais**, cobrindo início/quartis/fim de cada subclasse e as duas edições: código, descrição, unidade, valor decimal textual, edição e rastreabilidade coincidem exatamente com os XLSX validados.

| Busca / fonte | Página 1 | Página 2 |
|---|---:|---:|
| escavação · SICRO | 30 | 30 |
| concreto · SICRO | 30 | 30 |
| transporte · SICRO | 30 | 30 |
| pavimentação · SICRO | 3 | 0 |
| drenagem · SICRO | 30 | 30 |
| sinalização · SICRO | 30 | 30 |
| calha · SINAPI | 30 | 30 |
| impermeabilização · SINAPI | 25 | 0 |
| alvenaria · SINAPI | 30 | 30 |
| pintura · SINAPI | 30 | 30 |

Páginas limitadas a 30 itens, com lookahead de 1 e **zero IDs repetidos entre páginas visíveis**. Duração SQL remota observada: **2.28–41.67 ms**, conforme consulta. Não representa latência completa do navegador. Todas as consultas registraram zero linhas escritas.

### Testes finais e deploy

**243 Worker + 165 UI = 408 testes aprovados**, incluindo SICRO e SINAPI reais. Typecheck e lint aprovados. Build aprovado, repetido imediatamente antes do deploy. Avisos já conhecidos de anotações Zod e tamanho de chunk; nenhum erro. UTF-8/mojibake: **258 arquivos, zero achados**. `git diff --check` aprovado.

Publicado somente no Worker existente **voia-app**, URL **https://voia-app.bbrazgarcia.workers.dev**, Version ID **`d32667d1-b68e-4694-8647-3d837be7f12c`**. Bindings confirmados pelo Wrangler: **DB → voia-db** e **DOCUMENTOS_BUCKET → voia-documentos**. Nenhum Worker/domínio/bucket foi criado ou alterado.

Smoke tests HTTP pós-deploy: **12 verificações aprovadas**, incluindo HTML correspondente ao build publicado, assets da busca/planilhas/SICRO, `/api/health` saudável com D1 conectado e endpoints protegidos retornando 401 sem autenticação. Entry publicado: `/assets/index-D3McfZnD.js`. Essas chamadas não criaram dados. A interface autenticada em produção não foi exercitada nesta etapa; as verificações dos dados/buscas foram feitas diretamente no D1, e o fluxo autenticado foi coberto pelos testes Worker/UI e pelo ensaio local.

### Lista final de arquivos no working tree

Os scripts, backups, exportações e arquivos oficiais em `.wrangler` permanecem ignorados pelo Git. A auditoria inicial já estava pendente antes da implementação. Nesta etapa de publicação, o código funcional previamente validado não precisou de alterações adicionais; este relatório foi atualizado.
- `src/react-app/components/BuscaCatalogoServicos.tsx`
- `src/react-app/components/ImportarBaseServicos.tsx`
- `src/react-app/components/ObraPlanilhasPanel.tsx`
- `src/react-app/lib/planilha-xlsx.ts`
- `src/react-app/pages/BasesServicos.tsx`
- `src/react-app/styles/bases-servicos.css`
- `src/shared/bases-servicos.ts`
- `src/shared/planilhas.ts`
- `src/worker/bases/catalogo.ts`
- `src/worker/bases/routes.ts`
- `src/worker/obras/planilhas.ts`
- `test/bases-servicos.test.ts`
- `docs/RELATORIO-AUDITORIA-SICRO-MT-07-2026.md`
- `docs/RELATORIO-IMPLEMENTACAO-SICRO-MT-07-2026.md`
- `migrations/0033_sicro_custos.sql`
- `src/react-app/components/CustosSicro.tsx`
- `src/react-app/lib/importar-sicro.ts`
- `src/shared/sicro.ts`
- `test/sicro.test.ts`
- `test/ui/sicro-real.test.tsx`
- `test/ui/sicro.test.tsx`

**Trabalho encerrado. Aguardar autorização para commit/push.**

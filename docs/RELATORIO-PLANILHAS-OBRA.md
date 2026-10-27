# Planilhas da Obra e Biblioteca Técnica de Reformas

## Ambiente e escopo

- Working copy: `C:\Users\Bruna Braz Garcia\Downloads\voia-app-visual-v2\voia-app`.
- Branch mantida: `claude-modelos-processos-v2`; commit base: `bb8d37d`.
- Esta rodada substitui a medição física. Não implementa medição, financeiro da obra, Curva S, dependências, orçamento consolidado ou integração com bases externas.
- Obras, RDO, fotos, ocorrências, documentos, projetos e cronograma continuam utilizando suas estruturas e regras atuais. Nenhum dado de Yara serve de exemplo ou recebe alterações.

## Auditoria das referências

Foram encontrados e lidos os três arquivos originais em Downloads. Os originais não foram modificados. A auditoria detalhada, extração textual das 11 páginas do PDF e renders de todas as páginas estão em `.wrangler/planilhas-auditoria/`, ignorado pelo Git.

### Skill

O pacote `quantitativo-reforma.skill` contém SKILL.md, formato JSON, exemplo e dois scripts de geração. Foram estudados metodologia, campos, regras de escopo, numeração, geração das abas e geração do PDF.

Status preservados:

| Sigla | Significado |
|---|---|
| FECHADO | Fechado |
| QPE | Quantificado — pendente de especificação |
| CPQ | Confirmado — pendente de quantificação |
| CPP | Confirmado — pendente de projeto/locação |
| PC | Pendente de campo |
| VT | Serviço identificado para validação técnica |
| NC | Não contratado |

Ausência de status permanece ausência; não é convertida em FECHADO. Ausência de preço, quantidade ou confirmação do regime não recebe preenchimento automático. Não há fator de perda aplicado à mão de obra. Serviços por ambiente não criam ambientes adicionais nem quantidade 1 automaticamente. A distinção entre drywall e gesso e entre instalação do cassete, elétrica e dreno foi preservada na biblioteca. Não foi incluída limpeza geral automática.

As 12 etapas do Skill estão disponíveis para seleção, sem inserção automática de serviços: Pintura; Civil/calçadas/muros; Forro/gesso; Cobertura/rufos/marquises; Elétrica; Telecomunicações; Hidráulica/metais; Esquadrias/serralheria/ferragens; Marcenaria; Acabamentos; Limpeza; Climatização.

### XLSX 002

Inspeção com fórmulas e valores cacheados, dimensões, estilos, formatos, filtros, congelamentos, mesclagens, linhas/colunas e agrupamentos:

| Aba | Dimensão | Fórmulas | Organização |
|---|---|---|---|
| QUANTITATIVO MESTRE | 98 × 13 | 5 | 97 itens, filtro A1:M98, congelamento F16 |
| PRECIFICAÇÃO POR AMBIENTE | 101 × 9 | 679 | introdução mesclada A1:I2, cabeçalho na linha 4, congelamento C5 |
| TOTAIS POR AMBIENTE | 36 × 6 | 116 | totais por ambiente e pavimento |

O mestre efetivo possui código, etapa, categoria, subcategoria, serviço, escopo, edificação, ambiente, unidade, quantidade, memória, observações e pendências. Diferentemente do gerador do Skill, não possui colunas STATUS e FONTE nem abas RESUMO e PENDÊNCIAS. Isso impede um futuro importador baseado cegamente em posições de colunas.

Foram identificadas quantidades calculadas, como 115,09 m² de calçada, acompanhadas de memória textual independente. Os preços de proposta estão ausentes; os totais zero cacheados no resumo não representam orçamento fechado. No aplicativo, ausência de preço aparece como ausente; um parcial cotado só aparece quando pelo menos um item possui quantidade e preço, incluindo zero explícito.

Visual: Arial, cabeçalhos azul técnico, variação discreta por etapas, textos longos com quebra e células de precificação destacadas. O navegador preserva densidade tabular, sem tentar reproduzir alturas de linhas do Excel.

### PDF 002

As 11 páginas A4 paisagem organizam os mesmos serviços por pavimento/ambiente, mantendo códigos do mestre. Foram conferidas todas as páginas renderizadas e sua extração textual. Há identificação da obra, prestador, contato, prazo, validade, condições de contratação, código/escopo/unidade/quantidade, campos de preços vazios, subtotais e assinatura/data. Não há nome de cliente no documento externo.

A metodologia transforma levantamento em quantitativo técnico; a precificação adiciona ofertas sem inventá-las; a solicitação reorganiza os mesmos itens por ambiente, eliminando informações internas inadequadas ao prestador. Uma futura solicitação deverá preservar essa distinção e exigir confirmação do regime de mão de obra e identificação pública da obra.

## Auditoria de banco e decisão arquitetural

Foram inspecionadas as migrations 0001–0029 e estruturas/endpoints de Obras, acesso ao Projeto, etapas, tarefas, modelos de serviço/processo, documentos e financeiro.

- `tipos_servico`, `tipo_servico_etapas_modelo` e `tipo_servico_modelo_tarefa` representam serviços profissionais/processos administrativos e modelos de tarefas. Não são composições ou serviços de quantitativo de obra.
- `projeto_etapas` e `projeto_tarefas` representam cronograma/execução administrativa. Não foram reutilizados como itens quantitativos.
- `projeto_documentos` representa documentos/arquivos vinculados ao Projeto, com permissões e R2 próprios. Não foi usado para armazenar linhas.
- `projeto_parceiro_remuneracoes` e `projeto_parceiro_pagamentos` representam remuneração de parceiros. Não são preços ou cotações da obra.
- Não há tabelas `propostas`, `proposta_itens`, biblioteca de custos ou orçamento com a semântica necessária nesta cópia.
- Reutilizados: identidade de usuários, Obra → Projeto e `requireObraAccess`. Não se cria nova régua de acesso ao Projeto.

Decisão: migration **0030_planilhas_obra.sql**, aditiva, sem alterar tabelas existentes.

| Tabela nova | Responsabilidade |
|---|---|
| `obra_planilhas` | Obra 1:N planilhas; metadados, versão e token de operação |
| `obra_planilha_grupos` | etapas da própria planilha e ordem; independentes do cronograma |
| `obra_planilha_itens` | identidade estável, código, ordem, quantidade, preço, memória e snapshot técnico tipado |
| `voia_biblioteca_servicos` | serviços reutilizáveis, sem quantidade, ambiente ou preço de obra |
| `voia_planilha_modelos` | modelo Reforma VOIA e estrutura de etapas versionada |
| `obra_planilha_snapshots` | histórico imutável de salvamentos e emissões |

Categorias/subcategorias pertencem ao serviço e seu snapshot nesta fundação; não se criam tabelas vazias apenas para reproduzir uma lista conceitual. Metodologia e etapas possuem modelo próprio; unidades e campos técnicos são extensíveis. Uma taxonomia normalizada e editável poderá ser adicionada quando houver administração real dessa taxonomia.

A migration inclui 28 serviços genéricos deliberados, derivados das referências, cobrindo as 12 etapas. Não copia nomes de clientes, locais, medidas, preços ou quantidades das obras de referência. Serviços de biblioteca têm código próprio `REF-*`, diferente do código sequencial `01.01` do item de uma planilha.

## Integridade, memória e códigos

- Quantidade numérica nullable, preço unitário em centavos nullable e memória textual em campo independente. Zero é um valor válido.
- Memória é editável/exportável, preservada nos snapshots, nunca executada como fórmula. Entrada numérica aceita números, não expressões arbitrárias.
- UUID estável de item; código sequencial por etapa, alocado no servidor e nunca renumerado por filtro, ordenação ou exclusão.
- Exclusão lógica mantém código reservado. Duplicar linha cria nova identidade/código; duplicar planilha cria novas identidades e preserva sua numeração como novo documento independente.
- Código/grupo de item salvo são imutáveis. Para transferir item entre etapas, crie uma nova linha na etapa correta e exclua a antiga; o histórico permanece preservado.
- Snapshot de serviço permite editar todos os campos da obra sem alterar a biblioteca. Publicação global exige ação explícita e Admin.
- JSON técnico tem schema compartilhado estrito; quantidade, memória e preço também possuem colunas explícitas. Referência de preço já comporta origem/código/competência/UF/tipo/referência, sem baixar bases nem criar preços.
- Não há vínculo obrigatório com tarefa nem medição derivada de tarefas concluídas. O UUID do item permite futuras relações de medição.

## Salvamento, concorrência e performance

Edição é local; botão Salvar envia um lote. Há estados Salvo, Alterações não salvas, Salvando e erro visível. Rascunho de sessão é recuperável e guardado antes de desmontar a aba; beforeunload protege fechamento de página. Não há requisição por tecla. Rascunho local não substitui o salvamento no D1.

Atualização usa versão esperada e token de operação. Todas as escritas do batch D1 são condicionadas ao token da reivindicação bem-sucedida; conflito devolve 409 sem misturar cabeçalho, linhas e histórico. Snapshots são imutáveis com triggers. Todas as relações são verificadas no servidor e os códigos possuem constraints/triggers adicionais.

Inserções em lote usam `json_each`, sem centenas de parâmetros SQL nem uma requisição por linha. Limite de 2.000 itens e 1,5 MB por envio. Editor pagina 75 linhas e possui rolagem interna/sticky header; fixture de 500 itens testada. Criações simultâneas podem receber 409 por concorrência na reserva do ID; nenhuma criação parcial é mantida e a operação pode ser repetida.

## Permissões e endpoints

Planilhas contêm preços. Na primeira versão, Admin e Gestor acessam o módulo; somente Admin publica serviço global. Parceiro, mesmo membro do Projeto, não recebe planilhas com preços ou biblioteca global. O restante do acesso operacional do parceiro não muda. Visualizador também não ganha acesso comercial implícito.

Todos os endpoints de obra passam por autenticação, perfil, `requireObraAccess` e validação da relação planilha/obra. Item estrangeiro, ID de biblioteca inválido, snapshot de outra planilha e seleção com IDs externos são rejeitados. Dados desconhecidos são recusados, não enviados diretamente ao SQL.

- `GET/POST /api/obras/biblioteca-planilhas` — catálogo/modelos; POST exclusivo Admin.
- `GET/POST /api/obras/:id/planilhas` — listar/criar.
- `GET/PUT /api/obras/:id/planilhas/:planilha` — ler/salvar lote com versão.
- `POST /api/obras/:id/planilhas/:planilha/snapshots` — emissão de snapshot da seleção salva.
- `GET /api/obras/:id/planilhas/:planilha/snapshots/:snapshot` — recuperar histórico específico.

## Interface e saídas

`ObraPlanilhasPanel` integrado como aba adicional apenas para quem possui permissão. As demais abas não foram redesenhadas.

- Lista de planilhas; criação em branco ou por modelo de Reforma com escolha de etapas; duplicação de planilha salva.
- Grade com células inline, Tab/Enter/setas verticais, inclusão de 1–100 linhas, cópia tabular das linhas selecionadas, colagem TSV de até 500 linhas, duplicação/exclusão múltipla e movimento de linha.
- Ordenação de visualização e busca/filtro por etapa preservam códigos e ordem técnica armazenada. Reorganização explícita é persistida ao salvar.
- Detalhe técnico edita escopo, descrição, categoria/subcategoria, ambiente/pavimento, unidade, quantidade, memória, fonte, observações, pendências, fornecedor e status do Skill.
- Lápis dourado e lixeira vermelha por linha reutilizam `AcaoIcone`, com rótulos acessíveis, títulos e confirmação de exclusão.
- Mobile mantém grade compacta de código/serviço/ações e acesso ao detalhe completo.
- Subtotais por etapa e parcial cotado com contagens de campos ausentes. Não se apresentam valores não cotados como orçamento zero.
- Biblioteca pesquisável; seleção copia os campos; serviço próprio permanece na obra até publicação explícita.

### Exportação implementada

XLSX OOXML real, utilizando `fflate` já instalado. Cinco abas conforme o gerador do Skill: mestre, precificação por ambiente, totais por ambiente, resumo e pendências. Exportação integral ou parcial após salvar, com snapshot histórico imutável antes do download. Texto fornecido pela usuária é string inline, nunca fórmula executável. Números permanecem numéricos; ausências ficam vazias. Memória, escopo e fontes são exportados.

Limite deliberado: exportação representa valores congelados no momento da emissão; não reproduz ainda todas as fórmulas interabas, estilos, agrupamentos e totalização por pavimento do XLSX oficial. Alterações no arquivo baixado não alteram a planilha viva nem o histórico. Antes de adotá-lo como planilha externa de cotação dinâmica, implementar e validar fórmulas controladas e fidelidade adicional ao modelo.

### Preparado, sem botão funcional falso

- Importação XLSX: não implementada. Modelo suporta os campos, mas faltam leitor limitado contra ZIP bombs/relacionamentos externos, detecção de abas/cabeçalhos, mapeamento dinâmico (13/15 colunas), prévia, tratamento de duplicatas, fórmulas cacheadas e confirmação antes de persistir. A interface informa indisponibilidade; upload não grava nada.
- Solicitação de proposta: não implementada. Snapshot/seleção já existem; faltam identificação pública da obra, dados de prestador/contato/prazo/validade, revisão das condições por regime e renderizador paginado validado contra o PDF oficial, sem nome de cliente e sem notas internas.
- Não foram expostos botões de orçamento/medição/cotação que aparentem executar funções inexistentes.
- Pendências preservam texto/códigos por linha; um registro global estruturado de responsáveis e vínculos entre pendências ainda não foi implementado.
- Fórmula de quantidade não é interpretada; usar quantidade explícita e memória textual. Não há motor de cálculo arbitrário.
- Não há merge automático de conflitos; erro 409 conserva o rascunho para conciliação explícita.

## Validação

Validação local concluída: 202 testes Worker (24 arquivos) e 124 testes UI (11 arquivos), total **326 aprovados**. São 19 testes Worker e 14 testes UI novos nesta rodada. Incluem edição em lote, concorrência simultânea, memória, códigos históricos, exclusão lógica, snapshot parcial, isolamento/IDOR, permissões, biblioteca, zero versus ausência, teclado, colagem e 500 linhas.

`npm.cmd run test:typecheck`, `npx.cmd tsc -b --pretty false`, `npm.cmd run lint`, `npm.cmd run build` e `git diff --check` passaram. Verificador UTF-8: 249 arquivos, zero arquivos inválidos e zero ocorrências de mojibake. A última repetição da suíte UI passou fora do sandbox após uma tentativa ter falhado no acesso aos arquivos temporários do runtime (ENOENT); não foi necessária alteração funcional por esse erro de ambiente.

O XLSX produzido pelo exportador real foi reaberto com leitor independente (openpyxl) sem avisos: cinco abas válidas, quantidade numérica, memória preservada e preços/totais ausentes vazios. Planilhas e exportador usam carregamento sob demanda; não são carregados na Home. Permanecem os avisos preexistentes de anotações de Zod e tamanho do bundle principal, sem erros de build.

Os testes utilizam fixtures isoladas, nunca dados reais. Validação visual usa componentes reais do AppShell/ObraWorkspace com transporte mockado local, nas resoluções 1920×1080, 1366×768, 1024×1366 e 375×812. Renders do editor de 500 linhas e do detalhe/biblioteca estão em `.wrangler/planilhas-auditoria/`. Regressões operacionais possuem as suítes existentes e conferência das abas vazias na fixture; isso não substitui validação manual dos dados reais pela usuária.

## Operação

Migration remota **0030_planilhas_obra.sql aplicada com sucesso** em 26/10/2026. Antes dela, backup novo exportado e restaurado em memória com integridade e FKs válidas; 0030 aplicada tanto sobre essa cópia isolada quanto numa instância Wrangler D1 local exclusiva.

- Backup anterior: `.wrangler/backups/voia-db-pre-0030-20261026-221825.sql`, 441.452 bytes.
- SHA-256: `e0d3f8d5ae8bd351f11608fa057c8b5dd9d1202ceca3984be45f3a75c113b0ac`.
- Exportação posterior de conferência: `.wrangler/backups/voia-db-pos-0030-2026-10-27T02-25-06-851Z.sql`.
- Conferência pós-migration: integridade ok, zero violações de FK, hashes e quantidades preservados nas 23 tabelas de negócio comparadas. Sessões e histórico de migrations foram excluídos da comparação deliberadamente.
- Produção contém zero planilhas de demonstração e 28 serviços globais deliberados. Nenhuma obra/projeto foi criada, incluindo Yara. Nenhum objeto R2 foi criado, removido ou duplicado nesta rodada.
- Backups anteriores não foram sobrescritos; dumps e dados de auditoria permanecem ignorados pelo Git.

Bindings preservados e conferidos no build e na publicação: `DB → voia-db` (`217f7490-d357-4c36-827f-afd54589adb9`) e `DOCUMENTOS_BUCKET → voia-documentos`. Worker: `voia-app`.

Build de produção repetido imediatamente antes de `npm.cmd run deploy`; publicação concluída com sucesso em **26/10/2026**.

- URL: https://voia-app.bbrazgarcia.workers.dev
- **Version ID: `5c3793ba-16dc-4012-96e4-071fc876044c`**.
- Smoke público após deploy: login 200, health 200/ok, JS do módulo e exportador 200; endpoints de Planilhas/Biblioteca sem sessão retornam 401 JSON.
- Não foi feita criação/edição de planilha em produção para demonstração. A validação autenticada com dados reais fica para a usuária.
- Nenhuma alteração funcional feita após o deploy; apenas registro do resultado neste relatório.

Nenhum push, commit, troca de branch, reset, npm audit fix ou --force foi executado.

## Arquivos da rodada

Criados (caminhos relativos à working copy absoluta informada no início):

- `docs/RELATORIO-PLANILHAS-OBRA.md`
- `migrations/0030_planilhas_obra.sql`
- `src/shared/planilhas.ts`
- `src/worker/obras/planilhas.ts`
- `src/react-app/components/ObraPlanilhasPanel.tsx`
- `src/react-app/lib/planilha-xlsx.ts`
- `src/react-app/styles/planilhas.css`
- `test/planilhas-obra.test.ts`
- `test/ui/planilhas-obra.test.tsx`

Alterados:

- `src/worker/index.ts` — registro das rotas antes da rota dinâmica de Obras, com middlewares limitados aos novos endpoints.
- `src/react-app/pages/ObraWorkspace.tsx` — aba adicional com permissão e carregamento sob demanda/Suspense.

`git status --short` final:

```text
 M src/react-app/pages/ObraWorkspace.tsx
 M src/worker/index.ts
?? docs/RELATORIO-PLANILHAS-OBRA.md
?? migrations/0030_planilhas_obra.sql
?? src/react-app/components/ObraPlanilhasPanel.tsx
?? src/react-app/lib/planilha-xlsx.ts
?? src/react-app/styles/planilhas.css
?? src/shared/planilhas.ts
?? src/worker/obras/planilhas.ts
?? test/planilhas-obra.test.ts
?? test/ui/planilhas-obra.test.tsx
```

Arquivos auxiliares de auditoria, fixtures visuais e backups ficam em `.wrangler/`, já ignorado pelo projeto. Nenhuma dependência, lockfile, configuração de autorização existente, binding ou domínio foi alterado.

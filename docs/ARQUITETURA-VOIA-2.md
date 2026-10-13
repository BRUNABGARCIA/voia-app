# Arquitetura para o VOIA 2.0 — Admin, Parceiro, Cliente, Obras, Financeiro

Documento de análise arquitetural (rodada "Hardening + Testes + Autorização +
Fundação do VOIA 2.0"). **Nada aqui foi implementado** — é mapeamento de
pontos de extensão e riscos para orientar as próximas rodadas, evitando que a
base atual seja desenvolvida de um jeito que dificulte essa expansão.

## 1. Modelo de perfis hoje vs. "Parceiro"

`usuarios.perfil` aceita (CHECK, `migrations/0003_equipe_permissoes.sql`):
`administrador`, `gestor`, `engenheiro`, `colaborador`, `financeiro`,
`visualizador`. Na prática (API/UI), só 4 são utilizáveis hoje:
`administrador`, `gestor`, `colaborador`, `visualizador` — `engenheiro` e
`financeiro` existem só por compatibilidade com dados legados, sem caminho de
criação atual (`src/worker/usuarios/routes.ts:6-9`).

"Parceiro" **não precisa de migration nova agora**: o valor técnico
`colaborador` pode continuar sendo o identificador interno/persistido
indefinidamente — a mudança de nome é só de rótulo visível. Hoje existem 3
cópias independentes do dicionário de rótulo (`PERFIL_LABEL` em
`EquipeAcessos.tsx`, `NovoUsuarioModal.tsx`, `EditarUsuarioModal.tsx`) mais
`FUNCAO_MEMBRO_LABEL` em `lib/projeto-tipos.ts` (rótulo de *função dentro do
projeto*, conceito diferente de *perfil*). Antes de qualquer rename visual
mais amplo que o já feito na tela de login, a próxima rodada deveria
**centralizar esse dicionário em um único módulo** (`lib/perfis.ts` ou
similar) importado pelos 3 lugares — sem isso, qualquer rename futuro
("Parceiro" em todo canto) vira uma edição espalhada e arriscada de
divergir.

## 2. De role-based para capabilities — caminho de migração sem quebrar nada

Hoje a autorização é 100% role-based: `requireRole("administrador", "gestor",
...)` no middleware, mais 2 pontos de regra manual dentro do handler
(`projetos/routes.ts:534` — colaborador não cancela projeto;
`usuarios/routes.ts:109` — admin não troca o próprio perfil). Não há
nenhuma tabela de permissões por módulo — decisão deliberada da Etapa C
("mantido simples, controle via perfil").

Caminho recomendado para migrar para capabilities **sem big-bang**:

1. Definir o catálogo de capabilities como constantes TypeScript (não banco
   ainda): `project.read`, `project.write`, `project.delete`, `client.read`,
   `client.write`, `task.read`, `task.write`, `document.read`,
   `document.write`, `financial.company.read`, `financial.own.read`,
   `team.manage`, `portal.configure`, `work.manage`.
2. Criar um mapa `PERFIL_CAPABILITIES: Record<Perfil, Capability[]>` em
   código (não banco) que hoje reproduz EXATAMENTE o que `requireRole` já
   decide — ou seja, a migração inicial não muda nenhum comportamento, só
   redescreve a mesma regra em outro vocabulário.
3. Trocar `requireRole(...)` por um novo `requireCapability(...)` que
   consulta esse mapa. Nesse momento, as duas regras manuais
   (`projetos/routes.ts:534`, `usuarios/routes.ts:109`) continuam sendo casos
   especiais fora do mapa — não force tudo a caber em capabilities, regra de
   auto-proteção pontual pode continuar como `if`.
4. Só quando houver necessidade real de permissão *configurável por usuário*
   (não só por perfil fixo) — provavelmente quando "Parceiro" ganhar
   permissões diferentes por contrato — vale criar uma tabela
   `usuario_capabilities` (override por usuário) consultada *além* do mapa
   por perfil, nunca em vez dele.

Isso **não precisa de migration agora** (passo 1-3 são só código). Uma
migration só entra no passo 4, e só quando houver decisão de produto
concreta sobre o que é configurável.

## 3. Admin

A estrutura de rotas por domínio (`clientes`, `projetos`, `usuarios`,
`dashboard`, `tipos-servico`, cada um com seu próprio `src/worker/<domínio>/
routes.ts`) já é o padrão certo para crescer. "Financeiro", "Custos",
"Obras", "Indicadores" devem nascer como módulos novos nesse mesmo padrão
(`src/worker/financeiro/routes.ts`, `src/worker/obras/routes.ts`, ...),
nunca inflando `projetos/routes.ts` (que já tem ~1700 linhas e concentra
etapas/tarefas/documentos/membros do projeto).

## 4. Parceiro

A visibilidade restrita (sem faturamento/margem/remuneração de outros) é o
primeiro caso no sistema de **response shaping por perfil** — hoje não existe
nenhum precedente disso (confirmado: nenhuma rota filtra campos por
`c.get("user").perfil`, `valor_contratado` é devolvido a qualquer perfil
autenticado em `GET /projetos` e `GET /projetos/:id`). Recomendação: não
resolver isso ad-hoc por rota — criar um helper central, por exemplo
`serializarProjeto(projeto, perfilOuCapability)` que decide quais campos
entram na resposta, chamado nos poucos pontos que hoje montam o JSON de
projeto. Isso vale tanto para "Parceiro não vê valor_contratado/margem"
quanto para o futuro "Cliente só vê o que foi liberado" (seção 7).

## 5. Cliente / Portal configurável

A base **já segue o princípio DEFAULT DENY** que o próximo ciclo pede:
- `cliente_contato_processos`: concessão explícita, por pessoa, de quais
  projetos ela acompanha — nunca "todos os projetos do cliente" por padrão
  (`migrations/0014_portal_cliente.sql`, comentário de arquitetura explícito).
- `projeto_etapas.visivel_cliente` e `projeto_tarefas.visivel_cliente`:
  granularidade por linha, nasce oculta por padrão em alguns casos.
- `projeto_documentos.visivel_cliente`: mesma ideia, nasce 0 (oculto).

Para "visibilidade por bloco" (dados do projeto, etapas, documentos, fotos,
RDO, cronograma, financeiro, aprovações) a extensão natural **não é**
inventar uma tabela de booleans nova por bloco — é generalizar o padrão que
já existe: uma tabela `projeto_portal_visibilidade (projeto_id, bloco,
visivel)` (bloco = enum fechado: `resumo`, `etapas`, `documentos`, `fotos`,
`rdo`, `cronograma`, `financeiro`, `aprovacoes`, ...), com DEFAULT DENY
(ausência de linha = oculto). Isso evita "dezenas de booleans espalhados"
(exigência explícita desta rodada) e reaproveita exatamente a filosofia que
`visivel_cliente` já implementa por linha.

## 6. "Visualizar como"

Já existe o modelo de referência para isso: o Portal do Cliente é servido
por funções próprias (`src/worker/portal/processos.ts`) que recebem
`contatoId`/`projetoId` e aplicam as MESMAS regras de autorização e os MESMOS
filtros de visibilidade que o contato real teria. "Visualizar como Cliente"
pelo admin deve chamar essas mesmas funções passando o `projetoId` escolhido,
**sem nunca criar uma sessão de portal real nem trocar identidade** — o
admin continua autenticado como admin, só a RESPOSTA é calculada como se
fosse o contato (preview server-side, não impersonation). Para "Visualizar
como Parceiro" o princípio é igual: reaproveitar o futuro helper de
serialização por perfil (seção 4) chamando-o com o perfil escolhido, sem
logar como outro usuário.

## 7. Financeiro de Parceiros e Financeiro do Projeto

Nenhuma tabela financeira existe hoje (confirmado: `valor_contratado` é a
única coluna monetária em todo o schema). Modelo mínimo proposto para quando
houver decisão de produto (não implementar ainda):

```
projeto_financeiro_lancamentos
  id, projeto_id → projetos, tipo (receita|despesa|custo),
  categoria, valor, data, descricao, criado_por_id → usuarios

projeto_parceiro_remuneracoes
  id, projeto_id → projetos, parceiro_id → usuarios,
  tipo (fixo|percentual|por_etapa|por_entrega|bonus|adiantamento|reembolso),
  valor_acordado, etapa_id → projeto_etapas (nullable, só quando tipo=por_etapa),
  status (pendente|confirmado|pago), confirmado_por_id → usuarios (só admin),
  comprovante_documento_id → projeto_documentos (reaproveita a tabela de documentos já existente)
```

Reaproveita `projeto_documentos` para o comprovante/NF em vez de criar outra
tabela de arquivo — mesma lógica de R2 (`storage_key`) já validada nesta
rodada. `ADMIN` vê tudo via `projeto_financeiro_lancamentos` +
`projeto_parceiro_remuneracoes` sem filtro; `PARCEIRO` vê só as linhas de
`projeto_parceiro_remuneracoes` onde `parceiro_id = próprio usuário`
(`financial.own.read`); confirmação de pagamento exige `administrador`
(mesmo padrão já usado em ações sensíveis, ex. `requireRole("administrador")`
em `configuracoes/routes.ts`).

## 8. Gestão de Obras — reutilizar vs. estender vs. criar novo

| Domínio | Decisão | Por quê |
|---|---|---|
| Dados da obra | **CRIAR NOVO** (`obras`, 1:1 ou 1:N com `projetos`) | Conceito novo (endereço de execução, dados técnicos da obra) sem equivalente hoje |
| Equipe | **REUTILIZAR** `projeto_membros` | Já modela "usuário + função específica neste projeto" |
| Cronograma/Etapas/Gantt | **REUTILIZAR** `projeto_etapas` (+ view/cálculo Gantt no frontend) | `data_inicio_prevista`/`data_fim_prevista`/`progresso` já existem; Gantt é visualização, não schema novo |
| Diário de obra / RDO | **CRIAR NOVO** (`obra_rdo`, 1:N com `obras`) | Estrutura própria (clima, mão de obra no dia, ocorrências do dia) sem equivalente |
| Fotos | **ESTENDER** `projeto_documentos` (categoria `foto` já cabe no CHECK de categoria, ou adicionar valor ao enum em migration futura) | Já é storage de arquivo com metadado — fotos são só um tipo de documento |
| Planilha orçamentária / Custos / Compras | **CRIAR NOVO**, ligado a `projeto_financeiro_lancamentos` (seção 7) | Depende do módulo financeiro, que ainda não existe |
| Medições | **CRIAR NOVO** (`obra_medicoes`) | Conceito de engenharia/construção civil sem equivalente |
| Pendências/Ocorrências | **ESTENDER** `projeto_atualizacoes` (já é histórico de eventos genérico, `tipo_evento` em 0018 é texto livre) ou **CRIAR NOVO** se precisar de workflow próprio (status de resolução) | Para registro simples, reaproveita; para workflow com responsável/prazo, precisa de tabela própria |
| Aprovações | **CRIAR NOVO** (`obra_aprovacoes` ou genérico `aprovacoes` reutilizável por Portal) | Não existe conceito de aprovação em lugar nenhum hoje |
| Documentos | **REUTILIZAR** `projeto_documentos` | Já serve a qualquer tipo de documento, com R2 e `visivel_cliente` |
| Histórico | **REUTILIZAR** `projeto_atualizacoes` | Já é a timeline de eventos do projeto |
| Calendário | **ESTENDER** (view derivada de prazos de etapas/tarefas/RDO) | Não precisa de tabela própria inicialmente — é uma composição de datas já existentes |
| Indicadores | **CRIAR NOVO** (camada de agregação/dashboard, sem tabela de dados própria) | KPIs são cálculo sobre dados existentes |
| Portal do Cliente (obra) | **REUTILIZAR** o padrão de `visivel_cliente` / futura `projeto_portal_visibilidade` (seção 5) | Mesma filosofia, blocos novos (`obra`, `rdo`, `fotos`, `medicoes`) |

## 9. Importação Inteligente de Propostas — modelo de staging

Nunca grava direto em `clientes`/`projetos`. Modelo mínimo:

```
propostas_importadas
  id, arquivo_documento_id → projeto_documentos (ou tabela própria antes de existir projeto),
  status (processando|em_revisao|aprovada|rejeitada), criado_em

propostas_importadas_campos
  id, proposta_id → propostas_importadas,
  campo (cliente_nome|cliente_documento|endereco|servico|valor|prazo|etapa|entregavel|...),
  valor_extraido, fonte (ex. "página 3"), confianca (0-1),
  revisado (boolean, default false), valor_confirmado (nullable, preenchido na revisão humana)
```

Cada campo carrega `{valor, fonte, confianca, revisado}` exatamente como
pedido. Só depois de `status = 'aprovada'` (toda revisão humana concluída) um
processo separado lê `propostas_importadas_campos` e grava
cliente/projeto/financeiro/etapas de verdade — nunca o parser grava direto.

## 10. Renderizador

Sem necessidade de preparação de schema agora. Only ponto de atenção: ao
nascer, reservar `render.read`/`render.create` no catálogo de capabilities
(seção 2) e um item de menu próprio — nada no código atual impede isso.

## 11. "Meu Dia" / Dashboard Parceiro / Dashboard Admin

O que **já existe e pode alimentar direto**: `sqlProjetoAtrasado`/
`sqlEtapaAtrasada`/`sqlTarefaAtrasada` (`projetos/atraso.ts`) dão atrasos;
`projeto_tarefas` com `responsavel_id`/`prazo` dá "minhas tarefas" e
"prazos"; `dashboard/routes.ts` já agrega KPIs operacionais.

O que **falta** (não implementar agora, só identificar): "frase motivacional
diária" (conteúdo estático, sem necessidade de schema), "aprovações" e
"pendências" como conceito cross-módulo (dependem das tabelas de aprovação
da seção 8), "meus recebimentos" (depende do financeiro de parceiros, seção
7), calendário unificado (composição, seção 8).

## 12. Resumo — o que NÃO fazer

- Não inflar `projetos/routes.ts` com financeiro/obras — módulos novos.
- Não criar tabela de visibilidade por bloco com um boolean por coluna —
  usar `(projeto_id, bloco, visivel)` genérico.
- Não implementar capabilities como tabela no banco antes de precisar de
  permissão por usuário (não só por perfil) — comece em código.
- Não duplicar storage de arquivo para fotos/comprovantes — reaproveitar
  `projeto_documentos` + R2.
- Não fazer o parser de propostas gravar direto em dado real — sempre
  staging + revisão humana.

---

# Rodada 04 — Central Operacional + Gestão de Obras (implementado)

As seções 1-12 acima são o mapeamento original (Rodada 02), anterior a
qualquer implementação — mantidas como estavam. Esta parte final registra o
que a Rodada 04 efetivamente construiu sobre essa base, e as decisões
tomadas nos pontos em que a seção 11 só identificava lacunas.

## 13. Central de Tarefas — "Meu Dia" e Kanban

`projeto_tarefas` (0017) já tinha quase tudo que "Meu Dia" precisava
(status, prioridade, responsavel_id, prazo). Faltavam duas coisas, ambas
endereçadas pela migration **0024_projeto_tarefas_geral**:

- `etapa_id` passou a ser opcional (era `NOT NULL`) — uma tarefa pode
  pertencer ao projeto sem estar amarrada a uma etapa específica. Rebuild de
  tabela (mesmo padrão de `0003_equipe_permissoes.sql` sobre `usuarios`):
  recria, copia dados pelos mesmos IDs, descarta a antiga, renomeia — nenhuma
  FK externa referenciava `projeto_tarefas.id`, então nada mais precisou ser
  tocado.
- `criado_por_id` foi adicionado (nullable — tarefas anteriores não têm essa
  informação e não é inventada retroativamente).

Novo módulo `src/worker/tarefas/routes.ts`, **só leitura**, montado em
`/api/tarefas`:
- `GET /api/tarefas/meu-dia`: tarefas atrasadas/hoje/próximas do usuário
  autenticado (sempre `responsavel_id = sessão`) + próximas entregas
  (etapas) do universo dele.
- `GET /api/tarefas`: lista filtrável (projeto/responsável/prioridade/
  status/prazo) para o Kanban — Parceiro é escopado por
  `sqlProjetosDoParceiro`, os demais perfis mantêm a visão administrativa.

Toda mutação continua em `/api/projetos/:id/tarefas*` (já auditado) — o
módulo de tarefas nunca escreve, só agrega, para não duplicar a superfície
de autorização. `POST /api/projetos/:id/tarefas` (nova) cria tarefa sem
etapa; `POST /:id/etapas/:etapaId/tarefas` (já existente) continua para quem
já está no contexto de uma etapa.

Segurança adicionada: quando o ator é Parceiro, o `responsavel_id`
atribuído a uma tarefa precisa ser membro do mesmo projeto
(`responsavelPermitidoParaAtor`, em `projetos/routes.ts`) — administrador/
gestor continuam livres para atribuir a qualquer usuário.

Frontend: Kanban com drag-and-drop nativo HTML5 (sem biblioteca) + botões
←/→ como alternativa sem drag para touch/mobile.

## 14. Cronograma e Calendário — sem tabela nova

**Cronograma** (`CronogramaPanel.tsx`, aba nova em `ProjetoWorkspace`):
reaproveita só `projeto_etapas` (datas previstas, status, progresso via
`tarefas_concluidas`/`tarefas_total`) — nenhuma lib de Gantt, barras
posicionadas por CSS. Mobile cai para lista cronológica (`sm:hidden` /
`hidden sm:block` sobre os mesmos dados).

**Calendário** (`src/worker/calendario/routes.ts`, `/api/calendario`, só
leitura): exatamente a composição que a seção 11 identificava como
pendente — agrega tarefas com prazo, etapas com entrega prevista, datas de
obra e (só para Parceiro) os próprios pagamentos programados/pagos. Nenhuma
tabela nova. Decisão de apresentação: lista agrupada por data em vez de
grade de mês, em ambos os breakpoints — cobre "lista por data no mobile"
pedido nesta rodada com menos superfície para manter.

## 15. Gestão de Obras — a decisão da seção 8, implementada

A seção 8 (tabela de decisão CRIAR/REUTILIZAR/ESTENDER) foi seguida à
risca:

| Domínio | Como foi implementado |
|---|---|
| Dados da obra | `obras` (migration 0025), 1:N com `projetos`, FK `CASCADE` (sub-recurso do projeto, não registro financeiro independente) |
| Equipe | `projeto_membros`, reaproveitado via `requireObraAccess` → `temAcessoAoProjeto` |
| Cronograma/Gantt | `projeto_etapas` do projeto da obra, via `CronogramaPanel` reaproveitado dentro do `ObraWorkspace` |
| RDO | `obra_rdo` (migration 0026), nova — sem equivalente |
| Fotos | `obra_fotos` (migration 0027), tabela própria de metadado, mas **mesmo R2** (`DOCUMENTOS_BUCKET`) e mesmos helpers de `projeto_documentos` |
| Pendências/Ocorrências | `obra_ocorrencias` (migration 0028), nova — workflow próprio (status/responsável/prazo) que `projeto_atualizacoes` não tinha |
| Documentos | `projeto_documentos` do projeto da obra, via `DocumentosPanel` reaproveitado dentro do `ObraWorkspace` |
| Histórico | `projeto_atualizacoes`, recebe o evento (obra criada, RDO criado, ocorrência aberta/resolvida) — `historico.ts` ganhou `"obra"`/`"rdo"`/`"ocorrencia"` como `entidade_tipo` (coluna já era livre, sem `CHECK`, desde a 0018) |
| Calendário | Seção 14 acima |

`progresso` da obra é **sempre manual** (0-100, documentado em código e na
tela com o rótulo "manual") — a seção 11 já apontava que derivar
automaticamente dependeria de decisão de produto; esta rodada optou por não
inventar a fórmula e deixar explícito que é um campo editado por
administrador/gestor.

Acesso: `src/worker/obras/acesso.ts` (`requireObraAccess`) resolve o
`projeto_id` da obra e reaproveita `temAcessoAoProjeto` de
`projetos/acesso.ts` — nenhuma régua de autorização nova, só uma indireção.
404 (nunca 403) quando o Parceiro não tem acesso, mesmo padrão
anti-enumeração do resto do sistema.

## 16. Notificações — decisão: não persistir ainda

A seção 11 apontava "pendências"/"aprovações" como dependentes de tabelas
que não existiam. Com Obras/Ocorrências agora implementadas, a Rodada 04
ainda optou por **não criar uma tabela de notificações persistentes**: os
"alertas" continuam sendo lidos direto das tabelas de origem a cada request
(dashboard, Meu Dia, calendário) — dois KPIs novos (`obrasEmExecucao`,
`ocorrenciasAbertas`) foram adicionados ao dashboard administrativo seguindo
exatamente esse padrão. Perseguir "notificação lida/não lida" persistente
exigiria decidir semântica de leitura por usuário × evento, o que não havia
pedido de produto concreto o suficiente para justificar agora — fica
identificado para uma rodada futura, não implementado por conveniência.

## 17. "Meu foco de hoje" — por que não foi estendido ao Admin

`parceiro_foco_diario` (migration 0022) é estruturalmente genérica
(`usuario_id, data, texto`) — nada no schema impede reaproveitá-la para
qualquer perfil. Mesmo assim, a Rodada 04 decidiu **não** adicionar "Meu
foco de hoje" à Home do Admin: o nome da tabela carrega semântica de
Parceiro, e reaproveitá-la só por conveniência de implementação confundiria
o modelo para quem lê o schema depois (uma tabela chamada
"parceiro_foco_diario" guardando o foco do dia de um administrador). Se um
dia houver decisão de produto de que Admin também precisa dessa
funcionalidade, a rota correta é uma tabela própria (`foco_diario`, sem o
prefixo "parceiro"), não reaproveitar esta.

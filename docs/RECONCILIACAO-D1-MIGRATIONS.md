# Reconciliação do histórico de migrations do D1 remoto

Este documento é só **plano e instruções** — nenhum comando de escrita
descrito aqui foi executado contra o banco remoto. Reflete a auditoria
feita na rodada "Fechamento definitivo do VOIA App interno".

## Por que o histórico está dessincronizado

A tabela de controle `d1_migrations` do banco `voia-db` remoto só registra:

```
0001_init_base.sql
0002_auth.sql
```

Apesar disso, o schema remoto real já contém as estruturas de todas as
migrations até `0020_projeto_documentos_arquivo.sql`. Isso aconteceu
porque, em algum momento entre 0003 e 0018, as migrations foram aplicadas
sem passar pelo mecanismo `wrangler d1 migrations apply` (que é o único
que escreve em `d1_migrations`), e as duas mais recentes —
`0019_projeto_documentos.sql` e `0020_projeto_documentos_arquivo.sql` —
foram aplicadas deliberadamente via `wrangler d1 execute --remote
--file=...`, que nunca grava na tabela de controle.

Resultado: o banco tem o schema certo, mas o Wrangler "acha" que só duas
migrations foram aplicadas.

## Por que NÃO devemos simplesmente reexecutar 0003–0020

Rodar `wrangler d1 migrations apply --remote` hoje trataria 0003–0020
como pendentes e tentaria executá-las contra um banco que **já tem o
estado final delas**. Isso não é um erro inofensivo em todos os casos:

- A maioria (`ADD COLUMN` isolado, ou um `CREATE TABLE` sem
  `IF NOT EXISTS` com `INSERT` de seed único) falharia com erro de coluna
  ou linha duplicada — o batch simplesmente pararia. Chato, mas não
  destrutivo.
- **`0003_equipe_permissoes.sql` é o caso genuinamente perigoso.** Ela
  faz um rebuild de tabela (cria `usuarios_new` com a lista fixa de
  colunas, copia os dados, derruba a `usuarios` antiga, renomeia). Se
  reaplicada contra o banco remoto real, ela reconstruiria `usuarios` a
  partir dessa lista fixa — qualquer dado real acumulado em produção que
  não estivesse nela seria perdido silenciosamente, sem lançar erro.
- `0006_clientes_e_projetos.sql` tem o mesmo padrão de rebuild
  (`organizacoes` → `clientes`, reconstrução de `projetos`) — mesmo
  risco.

Por isso a orientação é: **nunca deixar o comando genérico `apply`
reexecutar o arquivo original de uma migration já presente** — só
reconciliar a tabela de controle diretamente (bookkeeping).

## Como rodar o script de auditoria

```bash
node scripts/auditar-migrations-remotas.mjs
```

Por padrão consulta o D1 **local** (seguro, é o que foi usado para validar
o próprio script nesta rodada). Para consultar o remoto:

```bash
VOIA_D1_REMOTE=SIM node scripts/auditar-migrations-remotas.mjs
```

O script só executa `SELECT`/`PRAGMA` (nunca `INSERT`/`UPDATE`/`DELETE`/
`ALTER`/`DROP`/`CREATE`) e não grava nada em `d1_migrations`, schema ou
dado nenhum — ele só lê e relata.

## Como interpretar a saída

Para cada migration de 0003 a 0020, uma linha:

- **PRESENTE** — todas as verificações daquela migration (tabela, coluna,
  linha de seed, texto do `CHECK`) bateram com o que o banco consultado
  já tem. Candidata a bookkeeping.
- **DIVERGENTE** — pelo menos uma verificação falhou (tabela/coluna
  ausente, seed ausente). **Não fazer bookkeeping** dela sem investigar
  por quê — pode ser que ela realmente nunca tenha sido aplicada.
- **REVISÃO MANUAL** — a migration tem um efeito que o script
  deliberadamente não tenta comprovar sozinho (hoje, só
  `0006_clientes_e_projetos`, por ser um rebuild com renomeação de
  tabela — confirmar manualmente que `organizacoes` não existe mais e que
  os dados copiados batem antes de tratar como reconciliada). O script
  **nunca assume PRESENTE** nesse caso.

## Estratégia de reconciliação

1. Rodar o script contra o remoto (`VOIA_D1_REMOTE=SIM`) e conferir a
   saída completa.
2. Para toda migration que saiu **PRESENTE**, o "bookkeeping" é só
   inserir a linha correspondente em `d1_migrations` — **sem executar o
   SQL da migration original**. A tabela `d1_migrations` tem
   `id INTEGER PRIMARY KEY AUTOINCREMENT`, `name TEXT UNIQUE`,
   `applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` — não é preciso
   informar `id` nem `applied_at` manualmente.
3. Para `0006` (ou qualquer outra que saia DIVERGENTE/REVISÃO MANUAL),
   tratar individualmente, com verificação humana adicional, antes de
   decidir se ela também entra no bookkeeping.
4. Só depois de todo o histórico reconciliado, voltar a usar
   `wrangler d1 migrations apply --remote` normalmente para qualquer
   migration nova — e nunca mais usar `--file` fora desse mecanismo, para
   o histórico não dessincronizar de novo.

### Comandos de bookkeeping PROPOSTOS (NÃO executados nesta rodada)

Só devem ser rodados, um a um, **depois** de o script confirmar PRESENTE
para a migration correspondente contra o banco remoto real. Não rodar em
lote sem essa confirmação linha a linha — em especial, **não incluir
`0006` nesta lista até ela ser resolvida manualmente** (o script já a
sinaliza como REVISÃO MANUAL por padrão, nunca PRESENTE).

```sql
INSERT INTO d1_migrations (name) VALUES ('0003_equipe_permissoes.sql');
INSERT INTO d1_migrations (name) VALUES ('0004_configuracoes_aparencia.sql');
INSERT INTO d1_migrations (name) VALUES ('0005_logo_escala.sql');
-- 0006_clientes_e_projetos.sql: NÃO incluir aqui — REVISÃO MANUAL (ver acima).
INSERT INTO d1_migrations (name) VALUES ('0007_tipos_servico_contadores.sql');
INSERT INTO d1_migrations (name) VALUES ('0008_projeto_membros.sql');
INSERT INTO d1_migrations (name) VALUES ('0009_projeto_etapas.sql');
INSERT INTO d1_migrations (name) VALUES ('0010_aparencia_cores.sql');
INSERT INTO d1_migrations (name) VALUES ('0011_tipo_servico_etapas_modelo.sql');
INSERT INTO d1_migrations (name) VALUES ('0012_projeto_etapas_processo.sql');
INSERT INTO d1_migrations (name) VALUES ('0013_projeto_atualizacoes.sql');
INSERT INTO d1_migrations (name) VALUES ('0014_portal_cliente.sql');
INSERT INTO d1_migrations (name) VALUES ('0015_tipo_servico_modelo_ativa.sql');
INSERT INTO d1_migrations (name) VALUES ('0016_tipo_servico_modelo_tarefa.sql');
INSERT INTO d1_migrations (name) VALUES ('0017_projeto_tarefas.sql');
INSERT INTO d1_migrations (name) VALUES ('0018_projeto_atualizacoes_generico.sql');
-- 0019 e 0020 já existem fisicamente no remoto (aplicadas via --file);
-- o bookkeeping delas segue a mesma lógica assim que confirmadas PRESENTE:
INSERT INTO d1_migrations (name) VALUES ('0019_projeto_documentos.sql');
INSERT INTO d1_migrations (name) VALUES ('0020_projeto_documentos_arquivo.sql');
```

Execução sugerida, quando chegar a hora (não rodar agora):

```bash
wrangler d1 execute voia-db --remote --command "INSERT INTO d1_migrations (name) VALUES ('0003_equipe_permissoes.sql')"
```

(repetir uma a uma, ou agrupar num único `--file` só com esses `INSERT`,
nunca com o SQL original das migrations).

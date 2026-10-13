# Modelo Operacional do VOIA App

Fluxo ponta a ponta de como um trabalho nasce e é concluído no sistema, e
onde cada etapa vive hoje no código (Rodada 04). Não duplica o detalhamento
de autorização/schema — isso está em `docs/ARQUITETURA-VOIA-2.md`; este
documento é o mapa de "o que acontece em que ordem".

```
Cliente
  │  cadastro em clientes (status lead/ativo/inativo)
  ▼
Projeto
  │  projetos, ligado a cliente_id; valor_contratado nunca visível ao Parceiro
  ▼
Equipe
  │  projeto_membros — vincula administrador/gestor/Parceiro ao projeto;
  │  é a ÚNICA fonte de escopo do Parceiro (projetos/acesso.ts)
  ▼
Etapas
  │  projeto_etapas — cronograma (datas previstas/reais), geradas por
  │  modelo de tipo de serviço ou criadas manualmente
  ▼
Tarefas
  │  projeto_tarefas — agora também sem etapa obrigatória (migration 0024);
  │  alimentam "Meu Dia", Kanban e o progresso do projeto
  ▼
Obra (quando o projeto tem execução física)
  │  obras — 1:N com o projeto; progresso manual, nunca derivado
  ├─ RDO/Ocorrências/Fotos
  │    obra_rdo / obra_ocorrencias / obra_fotos — sub-recursos da obra,
  │    acesso sempre derivado do acesso ao projeto dela
  ▼
Entregas
  │  marcadas no cronograma (projeto_etapas.data_fim_prevista) e no
  │  calendário operacional (/api/calendario, composição de datas)
  ▼
Documentos
  │  projeto_documentos (+ R2) — visivel_cliente e visivel_parceiro são
  │  colunas independentes; Interno = nenhuma das duas marcada
  ▼
Recebimentos do Parceiro
  │  projeto_parceiro_remuneracoes (o acordo) + projeto_parceiro_pagamentos
  │  (cada pagamento) — Parceiro só lê a própria remuneração, nunca o
  │  valor_contratado do projeto
  ▼
Conclusão
     status do projeto → concluído; obra → concluída; etapas/tarefas 100%
```

## Onde cada perfil entra nesse fluxo

- **Administrador/Gestor**: cria cliente → projeto → equipe → etapas →
  (opcional) obra; acompanha tudo pelo Dashboard (Home), Meu Dia, Obras e
  Calendário sem filtro de escopo.
- **Parceiro** (perfil técnico `colaborador`): entra no fluxo a partir de
  "Equipe" — só vê o que está downstream dos projetos em que é membro
  (etapas, tarefas, obra, documentos liberados para ele, a própria
  remuneração). Nunca vê o cliente fora desse escopo, nem o
  `valor_contratado`, nem a remuneração de outro Parceiro.
- **Cliente** (Portal): só vê o que foi explicitamente marcado
  `visivel_cliente = 1` em cada tabela que já suporta essa granularidade
  (etapas, tarefas, documentos, atualizações) — nunca o inverso do que o
  Parceiro vê, mesmo quando ambos têm acesso ao mesmo registro.

## Eventos registrados no histórico (`projeto_atualizacoes`)

Reaproveitada como o feed operacional unificado do projeto (e, por
extensão, da obra) desde a Rodada 02/04:

| Evento | Quando |
|---|---|
| `tarefa_criada` / `tarefa_concluida` / `tarefa_reaberta` | Mutação em `projeto_tarefas` |
| `etapa_iniciada` / `etapa_concluida` / `etapa_reaberta` | Status de etapa derivado do andamento das tarefas |
| `obra_criada` | `POST /api/obras` |
| `rdo_criado` | `POST /api/obras/:id/rdo` |
| `ocorrencia_aberta` / `ocorrencia_resolvida` | `POST`/`PATCH` em `obra_ocorrencias` |

Pagamento confirmado como pago **não** gera evento em `projeto_atualizacoes`
— fica só no módulo financeiro, lido pelo próprio Parceiro em "Meus
Recebimentos" e pelo calendário (seção 14 de `ARQUITETURA-VOIA-2.md`),
para não misturar histórico operacional com dado financeiro na mesma
timeline que o Cliente poderia eventualmente herdar via `visivel_cliente`.

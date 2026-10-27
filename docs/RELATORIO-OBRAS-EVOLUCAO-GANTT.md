# Obras — edição e cronograma integrado

Rodada de 26/10/2026, America/Cuiaba. Publicada no Worker existente voia-app.

## Fotos

Lápis dourado e lixeira vermelha nas fotos, com title e aria-label. Legenda editável após upload, com Salvar/Cancelar e erro mantendo o rascunho. A confirmação permanece somente na exclusão.

PATCH /api/obras/:obraId/fotos/:fotoId aceita estritamente legenda (até 500 caracteres, ou null). Não recebe novo arquivo nem chama R2. Preserva obra_id, rdo_id, data, enviado_por_id, nome original e storage_key. O escopo opcional rdo_id é validado com a Obra e a foto antes da edição. Admin, gestor e parceiro com acesso à Obra podem editar metadados; exclusão continua exclusiva de Admin/gestor. Visualizador não escreve. O acesso continua derivado do Projeto.

## Ocorrências

Ação de edição com lápis dourado. Editor de título, descrição, categoria, prioridade, responsável e prazo; envia somente mudanças. Status continua nas ações existentes. Autor, Obra, IDs e campos de auditoria não são editáveis.

O PATCH existente agora rejeita campos desconhecidos/protegidos; confirma ocorrência + Obra acessível; responsável informado precisa ser membro ativo do Projeto. Registra evento interno ocorrencia_editada no histórico existente e preserva o evento de resolução e as datas históricas.

## Timeline e Gantt

Apenas no contexto da Obra, a Timeline agrupa tarefas pelas etapas, exibindo período, status e contagem de conclusões no cabeçalho de cada grupo. Tarefas datadas vêm antes das tarefas A agendar dentro de cada grupo; tarefas sem etapa ficam em seção própria, com as sem data ao final. O bloco isolado Períodos das etapas foi removido neste contexto. A apresentação aprovada do Cronograma do Projeto foi preservada.

Timeline e Gantt recebem o mesmo estado de etapas/tarefas carregado pelos endpoints existentes do Projeto vinculado à Obra. Não há segundo cronograma persistido, nova tabela ou gravação pelo gráfico. As edições operacionais recarregam esse estado compartilhado. Um Projeto pode ter várias Obras: o gráfico é o cronograma do Projeto vinculado, não uma associação nova de tarefas exclusivamente a uma frente de Obra.

Implementação própria leve, sem dependência nova: modelo puro de grupos, linhas e curvas em cronograma-obra.ts; ObraTimeline e ObraGantt cuidam da apresentação. O modelo de linhas pode evoluir para novas relações, sem implementar dependências, caminho crítico, baseline ou medição física nesta rodada.

### Tempo

Calendário horizontal com barras de etapas/tarefas, hierarquia, status, conclusões quando existentes, atraso já identificado pelo backend, tooltips, indicador de hoje e escalas Semana/Mês/Trimestre. Rolagem horizontal fica contida no calendário. Duração em dias corridos somente quando início e fim estão cadastrados e válidos. Data isolada aparece como marco de início/prazo, sem inventar duração. Itens sem datas ou com período inválido ficam fora da escala, em A agendar / revisar período.

### Valor × Tempo

O schema financeiro existente contém remunerações e pagamentos de parceiros por Projeto, com etapa opcional, sem vínculo financeiro inequívoco à Obra. Obras têm relação 1:N com Projeto, não possuem orçamento/custo temporal por Obra nem medições financeiras estruturadas. Não é correto atribuir remunerações, valor contratado ou parcelas do Projeto à Obra por inferência.

Por isso, o modo mostra Dados financeiros insuficientes para gerar a curva Valor × Tempo, com o que falta. Não consulta ou expõe remunerações de terceiros, não rateia valores e não fabrica curva. Para desenhar uma curva financeira real futuramente, será necessária uma fonte explicitamente associada à Obra e ao período; apenas preencher dados financeiros do Projeto não é suficiente para ativar uma curva da Obra com segurança.

### Progresso × Tempo

Exibe Conclusão de tarefas (%) — previsto × registrado. Previsto é a fração de tarefas válidas cujo prazo já chegou; registrado é a fração de tarefas atualmente concluídas, pela data de conclusão registrada. Canceladas são excluídas. São curvas em degraus; realizado não é projetado para datas futuras. Mostra desvio em pontos percentuais na data atual.

Exige prazos válidos nas tarefas e pelo menos uma conclusão com data válida; faltas/inconsistências geram explicação em vez de curva artificial. É reconstrução dos registros atuais, sem baseline ou histórico de reaberturas; não é avanço físico medido. O progresso manual da Obra não vira série histórica nem é alterado por esse cálculo.

## Validação

| Verificação | Resultado |
| --- | --- |
| Worker | 183 testes em 23 arquivos, aprovados |
| UI | 110 testes em 10 arquivos, aprovados |
| Total | 293 testes: 278 anteriores + 15 novos |
| npm run test:typecheck | Aprovado |
| npm run lint | Aprovado, sem erros/avisos |
| npm run test:run | Aprovado |
| npm run build | Aprovado |
| UTF-8/mojibake | 240 arquivos incluindo este relatório, zero problemas |
| git diff --check | Aprovado |

Inspeção visual em preview local sintético, com requisições de escrita bloqueadas: Timeline integrada, Gantt Tempo e mensagens de insuficiência financeira/progresso. Captura local: .wrangler/gantt-obras-evolucao.png. Helpers de preview removidos, servidor encerrado. Nenhum exemplo foi criado em produção. Não foi feito smoke autenticado de edição de dados reais em produção.

O build mantém apenas os avisos preexistentes de comentários Zod e chunk principal acima de 500 kB. Nenhuma biblioteca/dependência instalada e nenhum npm audit fix executado.

## Arquivos desta rodada

- src/worker/obras/routes.ts
- src/react-app/components/ObraFotosPanel.tsx
- src/react-app/components/ObraRdoPanel.tsx
- src/react-app/components/ObraOcorrenciasPanel.tsx
- src/react-app/components/CronogramaPanel.tsx
- src/react-app/pages/ObraWorkspace.tsx
- src/react-app/components/AcaoIcone.tsx (novo)
- src/react-app/components/OcorrenciaEditor.tsx (novo)
- src/react-app/components/ObraTimeline.tsx (novo)
- src/react-app/components/ObraGantt.tsx (novo)
- src/react-app/lib/cronograma-obra.ts (novo)
- test/obra-rdo-fotos.test.ts
- test/ui/obras-evolucao.test.tsx (novo)
- docs/RELATORIO-OBRAS-EVOLUCAO-GANTT.md (este relatório)

Alterações locais das rodadas anteriores foram preservadas. Sem checkout, reset, pull, commit ou push. Branch claude-modelos-processos-v2, HEAD 24dfb93.

## Produção

- Nenhuma migration criada, alterada ou aplicada. Nenhuma alteração em bindings ou configuração Wrangler.
- URL preservada: https://voia-app.bbrazgarcia.workers.dev.
- Version ID: fdc00ec9-d4f6-4ebe-b506-3b6ca3d27291.
- Bindings: DB → voia-db (217f7490-d357-4c36-827f-afd54589adb9); DOCUMENTOS_BUCKET → voia-documentos.
- Página respondeu HTTP 200 e referenciou os assets novos index-C6m05crZ.js e index-DlWlmNj9.css.
- Comparação somente leitura antes/depois: hashes iguais para obras, obra_rdo, obra_fotos, obra_ocorrencias, projeto_etapas, projeto_tarefas, projeto_atualizacoes, projeto_parceiro_remuneracoes e projeto_parceiro_pagamentos. Nenhuma alteração nos dados reais para demonstrar ou testar.
- Nenhum push realizado.

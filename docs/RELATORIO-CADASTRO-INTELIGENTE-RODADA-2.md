Validação local — Cadastro Inteligente e gestão de projetos

Rodada de 14/10/2026. Projeto: C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app.

**1. Arquivos alterados/criados nesta rodada (27, incluindo este relatório)**

- [package.json](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/package.json>)
- [package-lock.json](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/package-lock.json>)
- [tsconfig.ui-test.json](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/tsconfig.ui-test.json>)
- [vitest.ui.config.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/vitest.ui.config.ts>)
- [src/shared/documentos.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/shared/documentos.ts>)
- [src/react-app/pdf-worker.d.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/pdf-worker.d.ts>)
- [src/react-app/lib/documentos-texto.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/lib/documentos-texto.ts>)
- [src/react-app/lib/consolidar-trabalho.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/lib/consolidar-trabalho.ts>)
- [src/react-app/lib/novo-trabalho.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/lib/novo-trabalho.ts>)
- [src/react-app/lib/local-projeto.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/lib/local-projeto.ts>)
- [src/react-app/lib/projeto-tipos.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/lib/projeto-tipos.ts>)
- [src/react-app/components/AnexosTrabalho.tsx](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/components/AnexosTrabalho.tsx>)
- [src/react-app/components/NovoTrabalhoInteligenteModal.tsx](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/components/NovoTrabalhoInteligenteModal.tsx>)
- [src/react-app/components/DocumentoModal.tsx](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/components/DocumentoModal.tsx>)
- [src/react-app/components/DocumentosPanel.tsx](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/components/DocumentosPanel.tsx>)
- [src/react-app/components/EtapasPanel.tsx](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/components/EtapasPanel.tsx>)
- [src/react-app/components/TarefaModal.tsx](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/components/TarefaModal.tsx>)
- [src/react-app/pages/ProjetoWorkspace.tsx](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/react-app/pages/ProjetoWorkspace.tsx>)
- [src/worker/storage/documentos.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/worker/storage/documentos.ts>)
- [src/worker/projetos/routes.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/worker/projetos/routes.ts>)
- [src/worker/projetos/historico.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/src/worker/projetos/historico.ts>)
- [test/novo-trabalho.test.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/test/novo-trabalho.test.ts>)
- [test/gestao-cadastro.test.ts](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/test/gestao-cadastro.test.ts>)
- [test/ui/documentos-texto.test.tsx](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/test/ui/documentos-texto.test.tsx>)
- [test/ui/novo-trabalho-modal.test.tsx](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/test/ui/novo-trabalho-modal.test.tsx>)
- [test/ui/projetos-gestao.test.tsx](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/test/ui/projetos-gestao.test.tsx>)
- [docs/RELATORIO-CADASTRO-INTELIGENTE-RODADA-2.md](<C:/Users/Bruna Braz Garcia/Downloads/voia-app-visual-v2/voia-app/docs/RELATORIO-CADASTRO-INTELIGENTE-RODADA-2.md>)

O build também regenerou seus artefatos em dist e os tipos do Worker. Nenhuma configuração de bindings foi alterada.

**2. Seleção de múltiplos arquivos**

Não há limite fixo de quantidade. A seleção é cumulativa: selecionar três arquivos e depois quatro mantém sete. O input é limpo após cada seleção para permitir selecionar novamente o mesmo arquivo. Duplicatas exatas são detectadas pelo nome, tipo, tamanho e comparação dos bytes; arquivos com o mesmo nome e conteúdos diferentes são mantidos e suas fontes são diferenciadas na revisão.

**3. Remover um anexo antes de salvar**

Cada item tem Remover. A remoção afeta apenas aquele arquivo, não envia DELETE e não grava nada. Também é possível alterar a seleção na revisão; isso volta à etapa de conteúdo, exigindo nova análise para não manter sugestões de uma fonte removida. A lista tem rolagem, contagem, nome, extensão, tipo, tamanho e status de análise.

**4. Limites de upload e análise**

Upload: 20 MiB (20 × 1024 × 1024 bytes) por arquivo, mantendo o limite já existente no servidor. Arquivos vazios e extensões fora da lista permitida são recusados. O upload ocorre arquivo a arquivo, após confirmar. Não há limite fixo de quantidade nem requisição única contendo todos os documentos.

O servidor atual processa multipart e mantém o arquivo em memória antes do R2. Mantive a política de 20 MiB para não elevar a pressão sobre esse fluxo: Cloudflare documenta 128 MB por isolate e limites de corpo de requisição a partir de 100 MB. Esses números são limites da infraestrutura, não a justificativa para aceitar um arquivo de 100 MB com buffering. [Limites oficiais do Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/).

Limites separados para extração no navegador: 200 mil caracteres por documento; um milhão de caracteres por revisão; PDF com até 200 páginas e prazo de 15 segundos, com término do worker em caso de timeout; DOCX com XML principal descomprimido de até 5 MiB e até 50 mil marcações XML. A descompressão é feita em chunks, mede os bytes realmente emitidos e recusa inclusive ZIP com tamanho declarado adulterado. Exceder um limite de análise torna o arquivo apenas anexável; não altera o limite de upload de 20 MiB.

**5. Formatos realmente analisados**

PDF com texto selecionável via PDF.js, DOCX pelo texto do corpo principal e TXT em UTF-8. Extração local, sem serviço externo, novos secrets, OCR, execução de macros ou conversão de HTML para a interface. XML com entidades ou DOCTYPE é recusado. Conteúdo e arquivos permanecem locais até Confirmar e criar.

**6. Formatos apenas anexados**

DOC, XLS, XLSX, DWG, DXF, ZIP, JPG, JPEG e PNG. PDF/DOCX/TXT que não possam ser extraídos também continuam na seleção, com o motivo visível, para anexação após a confirmação. As validações de extensão, MIME, assinatura e tamanho já existentes na API permanecem aplicáveis; arquivos inválidos podem ser recusados pelo servidor. TXT foi adicionado à lista de formatos de upload permitidos.

**7. Consolidação de fontes**

Texto colado e cada documento analisado viram fontes identificadas. Informações complementares são reunidas em um único rascunho editável. Fontes dos campos identificados podem ser consultadas. Ações equivalentes são consolidadas por nome, preservando divergências de data, horário e descrição para revisão. Follow-ups explicitamente solicitados podem usar a data de vistoria de outra fonte; prazo comercial ou prazo de pagamento não gera follow-up por si só.

O analisador é determinístico e genérico, sem regras com nomes de clientes. Campos ausentes ficam vazios. Datas relativas como amanhã são sugestões com sua data de referência explícita, para revisão. Uma menção isolada a ART não inventa emissão de ART, e a presença de um contato WhatsApp não presume, por si só, a origem do atendimento.

**8. Conflitos entre fontes**

Valores reconhecidos divergentes aparecem em Conflito identificado, com opções e fontes. Nenhuma opção é escolhida automaticamente e Confirmar e criar fica bloqueado até a decisão. Depois de escolher, o campo continua editável. Repetições conflitantes de campos rotulados dentro do mesmo documento também são apresentadas, com indicação de linha. Mudanças de cidade/UF invalidam a confirmação anterior de VG.

**9. Corrigir cadastros criados por engano**

Projeto: ação discreta Mais ações → Cancelar cadastro criado por engano, somente para administrador/gestor, com confirmação clara. Usa o status cancelado e o histórico já existentes. Não adiciona DELETE de projeto nem remove cliente, tarefas, etapas, documentos, obras ou financeiro. A relação financeira possui ON DELETE RESTRICT; o cancelamento preserva esse vínculo e todos os demais registros.

Tarefas e etapas: exclusão pelas rotas existentes, com confirmação e menus discretos. Excluir etapa remove suas tarefas por cascade; documentos permanecem, com o vínculo à etapa removido. Progresso é recalculado. A edição/criação de tarefas sem etapa usa as rotas gerais existentes.

Documentos: confirmação informa a remoção do registro/arquivo e a desvinculação das referências, mantendo registros relacionados. Usa a rota existente de DELETE e a remoção idempotente do objeto R2. As exclusões de tarefa, etapa e documento registram evento no histórico existente. O evento de documento não contém seu nome/conteúdo privado, evitando revelar essas informações na timeline dos parceiros.

As regras de roles e acesso ao projeto foram preservadas. Parceiros vinculados continuam recebendo 403 ao tentar excluir tarefas, etapas, documentos ou cancelar projeto. Não foi criada nova permissão administrativa.

**10. Tarefas sem etapa**

A aba Etapas e Tarefas inclui Tarefas sem etapa, mesmo sem nenhuma etapa cadastrada e também ao usar a subvisão cronograma. Mostra nome, status, prazo e responsável. Permite criar/editar usando etapa nula e as permissões atuais. Tarefas sem etapa já participavam da fórmula central de progresso; essa regra foi mantida e testada. Projetos sem etapa mostram Sem etapa definida, na visão geral e no painel, sem indicar falsamente que todas foram concluídas.

**11. Preservação do local/condomínio**

Local, endereço completo e pagamento continuam preservados em linhas identificadas das observações existentes, sem novo schema. A visão geral apresenta Local/Condomínio, Cidade, UF e Endereço completo separadamente. Para os registros anteriores da Yara, a linha Local: Condomínio Parque Chapada dos Campos já salva é reconhecida. Cidade/UF não são usadas como endereço completo; quando falta, aparece Não informado — pendente. A sanitização existente de observações para parceiros permanece intacta.

**12. Build**

npm run build: aprovado, código de saída 0. PDF.js e seu worker são assets carregados sob demanda. Permanecem avisos não bloqueantes do Zod/Rollup e de tamanho do bundle.

**13. Typecheck**

npm run test:typecheck: aprovado, código de saída 0. Verifica os testes Cloudflare e a suíte DOM. O build também passou pelo tsc -b da aplicação.

**14. Lint**

npm run lint: aprovado, código de saída 0.

**15. Testes**

npm run test:run: 172 testes aprovados em 24 arquivos: 151 testes Cloudflare/backend em 21 arquivos e 21 testes de interface/extração em três arquivos. O comando inclui a suíte UI; não foi necessário executá-la separadamente para concluir a validação final.

Cobertura: mais de três anexos, seleções cumulativas, remoção individual, deduplicação exata, arquivos apenas anexáveis, parsers reais PDF/DOCX/TXT, limites de descompressão inclusive com tamanho adulterado, combinação de fontes, conflitos, nenhuma gravação antes da confirmação, cinco tarefas e datas reais da Yara, tarefas sem etapa, local preservado, nenhuma Obra automática, exclusões com autorização/confirmação/histórico, progresso, cancelamento preservando vínculos e regressões de autorização/isolamento/financeiro.

Busca adicional: 151 arquivos de código, estilos e testes verificados com decodificação UTF-8 estrita; zero problemas de encoding/mojibake ou caracteres de substituição.

**16. Limitações e estado da entrega**

Não há OCR. DOCX analisa apenas o corpo principal; cabeçalhos, rodapés, comentários e imagens não são extraídos. PDFs sem camada textual, protegidos ou acima dos limites podem ficar apenas anexados. TXT fora de UTF-8 não é decodificado por suposição.

A extração de texto é real, mas a interpretação dos campos continua heurística: textos livres sem rótulos ou formulações que o analisador não reconhece precisam de preenchimento manual. Conflitos são detectados entre os valores reconhecidos; a revisão humana continua obrigatória. Os documentos reais de Lincoln e Nayara ainda não foram fornecidos; o teste genérico usa documentos construídos para validar extração e consolidação.

A criação permanece sequencial e pode ser parcial se uma chamada falhar após outras terem sido concluídas; os erros são mostrados e a retomada continua dos registros já confirmados. Exclusões individuais são definitivas e pedem confirmação; cancelamento de projeto preserva os dados. O mecanismo existente de limpeza R2 é idempotente e não representa uma transação distribuída com D1.

O npm manteve 17 alertas de auditoria nas dependências. Não foi executado npm audit fix, e não foram feitas atualizações indiscriminadas de dependências.

Sem deploy, sem push, sem novas migrations ou alteração de banco em produção. As migrations existentes foram usadas somente pelo setup do banco isolado de testes. Nenhum secret, serviço externo ou binding foi adicionado; regras de autorização, isolamento e financeiro foram preservadas.

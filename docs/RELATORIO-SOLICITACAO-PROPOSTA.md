# Solicitação de Proposta VOIA

Rodada local de 02/11/2026. Branch `claude-modelos-processos-v2`, iniciada limpa no commit `27d39e524efd4298d62e9bc2b2d036b6a5a44d8c`.

## Arquitetura encontrada

Planilhas já possuem seleção por UUID, códigos técnicos estáveis, ordem, grupos, pavimento/ambiente, versão otimista e snapshots imutáveis. Os snapshots existentes e o XLSX de Quantitativo/Orçamento incluem preços, referências e notas internas. O antigo valor de finalidade `solicitacao` não implementava um documento externo e não é utilizado pelo novo fluxo.

O acesso às Planilhas exige administrador/gestor e deriva do acesso à Obra/Projeto. Não havia histórico específico de solicitações, documento PDF externo ou numeração própria. Projetos usam o formato `PRJ-ANO-SEQUÊNCIA` com contador atômico. Foi adotada identificação equivalente `SP-ANO-SEQUÊNCIA`, com sequência global própria proveniente de `AUTOINCREMENT`, sem modificar os contadores de projetos. A sequência não reinicia anualmente e não reutiliza números cancelados.

## Fluxo implementado

1. Abrir uma planilha salva e selecionar uma ou mais linhas pela seleção existente, inclusive entre etapas, pavimentos e ambientes.
2. Acionar **Gerar solicitação de proposta**. A ação fica desabilitada sem seleção ou com alterações não salvas.
3. Revisar os dados reconstruídos pelo servidor. Esta etapa não grava uma solicitação nem um snapshot comercial.
4. Editar título, escopo da solicitação, destinatário/empresa, contato, telefone, e-mail, prazo, condições e observações gerais externas. Incluir nome do cliente é opcional e independente do prestador.
5. Preencher, quando necessário, escopo e observação externos de cada serviço. Os campos começam vazios; descrição auxiliar, escopo mestre, memória, observações e pendências internos não são copiados automaticamente.
6. Remover itens somente da emissão. Quantidade, unidade e serviço vêm da planilha; correções desses dados exigem corrigir/salvar a planilha e fazer nova revisão.
7. Confirmar explicitamente a emissão. Itens sem quantidade/unidade exigem aceite específico ou remoção/correção. Ausência permanece vazia/NULL e não vira zero.
8. Visualizar a solicitação emitida e baixar PDF/XLSX do mesmo snapshot persistido.

O rascunho da revisão é transitório. Cancelar/fechar descarta esse rascunho e não grava nada. A planilha mestre, orçamento, referência, regime SINAPI, preço adotado, BDI e desconto não são alterados pela emissão.

## Persistência e migration necessária

Preparada **`migrations/0036_solicitacoes_proposta.sql`**, exclusivamente aditiva:

- tabela `obra_solicitacoes_proposta`: identificação sequencial; chave de tentativa única; hash interno da intenção de emissão; FK da planilha; versão; UUIDs de origem separados; JSON externo; autor e data; status e metadados de cancelamento;
- índice `idx_solicitacoes_planilha` para o histórico;
- trigger `solicitacao_conteudo_imutavel`, que impede alterar identidade, origem, conteúdo e autoria/data da emissão; registros cancelados não podem ser alterados;
- trigger `solicitacao_sem_exclusao`, que impede apagar o histórico.

Nenhuma tabela anterior é reconstruída ou modificada. Nenhum serviço mestre é duplicado. Os itens emitidos são somente fotografias históricas dos campos externos, dentro do JSON da solicitação. Não há arquivos persistidos no R2 nem tabelas prematuras de propostas recebidas.

Status persistidos: **Emitida** e **Cancelada**. Rascunho é o estado transitório anterior à emissão. Uma futura proposta recebida poderá se relacionar à solicitação por seu ID, sem limitar a mesma seleção a um único prestador e sem atualizar preço adotado automaticamente. Não foi implementada a fase de resposta/comparação nem Medição.

### Ensaio local

Origem do ensaio: cópia local já existente `.wrangler/importacao-inteligente/ensaio-0035.sqlite`. Não é uma afirmação de backup atualizado da produção nesta rodada.

Antes do ensaio foi realizado backup SQLite consistente, preservado em `.wrangler/solicitacao-proposta/backup-antes-0036.sqlite`.

SHA-256 do backup final verificado:

`9e5f9449ef08defa11a2c584c06baa438f6da299518f2ffbb8e616f1ac8f3da1`

A migration foi aplicada somente sobre outra cópia, `.wrangler/solicitacao-proposta/ensaio-0036.sqlite`:

- `PRAGMA integrity_check`: **ok**;
- `PRAGMA foreign_key_check`: **zero violações**;
- **39 tabelas anteriores**, com contagem e SHA-256 de todas as linhas preservados;
- **115 objetos anteriores de schema**, incluindo índices/triggers, preservados exatamente;
- nova tabela inicialmente vazia;
- somente os quatro objetos novos previstos foram acrescentados.

O ensaio e suas evidências ficam ignorados em `.wrangler/`. A SQL deve ser executada uma vez pelo controle de migrations; não é uma instrução para reaplicar livremente o arquivo. Nos testes, o runner de migrations aplica a estrutura em D1 descartável.

**A 0036 não foi aplicada em produção.** Antes de eventual aplicação autorizada será necessário conferir estado remoto, migrations pendentes e backup atualizado de produção.

## Contrato externo e privacidade

`src/shared/solicitacoes-proposta.ts` define schemas estritos e uma whitelist explícita. Não existe spread de item mestre, referência ou planilha dentro do documento externo.

O documento contém apenas dados de identificação comercial externos, obra/projeto, cliente opcional, endereço existente, condições e itens com código técnico, serviço completo, escopo/observação externos, unidade, quantidade e agrupamento. O texto legado que coincide exatamente com o prefixo de 300 caracteres de uma descrição oficial recupera a descrição completa pela função já existente.

Não entram no documento: UUIDs/IDs internos, usuário, hash, preços de qualquer base, preço adotado, BDI, desconto, orçamento, margem, memória ou notas internas. A rastreabilidade mínima fica em colunas internas da solicitação e não é entregue aos geradores.

PDF e XLSX aceitam somente o contrato público estrito `{numero, emitida_em, documento}`. Campos extras e snapshots internos são rejeitados. Não há exportação de abas comerciais/ocultas, metadados de referências ou arquivo de autoria interna.

Texto que a usuária escrever deliberadamente em campos externos será incluído no documento; esses campos são identificados na revisão. Não há envio automático a prestadores ou a serviços externos.

## API, segurança e concorrência

Rotas em `/api/obras/:id/planilhas/:planilha/solicitacoes`:

- `POST /revisao`: leitura, reconstrução e validação da seleção;
- `POST /`: emissão explícita;
- `GET /`: histórico;
- `GET /:solicitacao`: leitura histórica;
- `POST /:solicitacao/duplicar`: novo rascunho para revisão;
- `POST /:solicitacao/cancelar`: cancelamento com motivo.

Todas estão no router de Planilhas, atrás dos middlewares existentes de sessão, autenticação, administrador/gestor, limite de corpo e acesso à Obra derivado do Projeto. Parceiro não ganha acesso ao conteúdo comercial por ser membro. Planilha e solicitação são sempre consultadas no escopo da Obra e da planilha acessíveis. UUIDs repetidos, removidos ou de outra planilha são recusados. O frontend não pode enviar quantidade/unidade/preço/snapshot autoritativos.

O servidor relê os itens e usa a versão da planilha. A inserção é condicional à mesma versão ainda existir no momento da gravação; mudança entre revisão e confirmação retorna 409 e exige nova revisão. Uma solicitação emitida continua disponível após edições/exclusões de linhas da planilha mestre.

A chave única com hash da intenção normalizada torna retries, inclusive simultâneos, idempotentes. Reutilizar a chave com outro conteúdo é conflito. Emissões distintas para a mesma seleção são permitidas e recebem números diferentes. Uma solicitação externa excessivamente extensa é recusada com orientação para dividir a seleção.

Duplicação não altera o documento anterior: usa os itens atuais da planilha, copia somente os campos externos editáveis, informa que é nova revisão e recusa itens de origem já removidos. Escopos são pareados por identidade/código estável, não pela posição enviada pelo navegador. Cancelamento exige motivo e não modifica o conteúdo original, que continua disponível para consulta/download.

## PDF e XLSX

Ambos representam o mesmo snapshot, agrupado por pavimento e ambiente, com pavimentos contíguos. Na ausência dos dois, utilizam a etapa real existente. Não inventam local ou classificação por IA.

Tabela externa:

`CÓD. | SERVIÇO E ESCOPO | UN. | QTD. | VALOR UNIT. (R$) | TOTAL (R$)`

O PDF utiliza `pdf-lib` e `@pdf-lib/fontkit`, carregados sob demanda, fonte Noto Sans local com licença OFL, assinatura tipográfica VOIA em preto/dourado, paginação e cabeçalhos repetidos. Descrições respeitam palavras e continuam em novas páginas quando necessário. Datas de criação/modificação do arquivo são as da emissão, e autoria é apenas VOIA Engenharia. Caracteres ausentes na fonte geram erro explícito, sem substituir silenciosamente por símbolos quebrados.

O asset preexistente `public/branding/logo-voia.png` nesta cópia é um retângulo magenta sem marca legível. Ele não foi alterado nem incorporado no PDF. A assinatura tipográfica evita colocar esse placeholder no documento externo.

O XLSX utiliza o writer OOXML/fflate do projeto em um gerador separado, com **uma única aba visível**. Possui identidade VOIA, agrupamentos, wrap, freeze panes, cabeçalho de impressão, valores BRL e células editáveis, sem proteção. Descrições extensas continuam em linhas visíveis para respeitar o limite de altura do Excel. Código é armazenado como texto (`inlineStr`, formato `@`), preservando zeros à esquerda.

Valor unitário começa vazio. Total usa fórmula do sistema, por exemplo:

`IF(AND(ISNUMBER(D12),ISNUMBER(E12)),ROUND(D12*E12,2),"")`

Quantidade/preço ausente deixa o total vazio. Zero numérico continua zero. Strings de usuário são células de texto, não fórmulas executáveis. Subtotais são campos vazios para preenchimento do prestador, não somas de preços internos.

### Conferência dos arquivos

Uma fixture local com 30 itens gerou PDF de **3 páginas** e XLSX de uma aba. Conferência independente por `pypdf` e `openpyxl` confirmou os mesmos **30 códigos**, preços unitários vazios e 30 fórmulas condicionais. Os dois formatos foram produzidos do mesmo JSON histórico persistido, sem nova leitura do mestre.

As páginas do PDF foram renderizadas pelo Poppler e inspecionadas. Cabeçalho, rodapé, texto longo, continuação, agrupamentos e campos vazios foram conferidos. O XLSX foi importado/renderizado no runtime de planilhas nos trechos de cabeçalho, itens e condições. Em uma cópia em memória, preço 17,50 × quantidade 10 calculou 175; preço zero calculou zero; ausência de quantidade deixou vazio.

Limite da conferência XLSX: não houve abertura no Excel nativo. O renderer de auditoria normaliza visualmente alguns códigos que parecem números; o arquivo original foi conferido separadamente como texto por OOXML/openpyxl, com os códigos `01.01` etc. preservados. A renderização de auditoria não foi exportada sobre o XLSX original.

## Testes e regressões

Resultados finais locais:

| Validação | Resultado |
|---|---:|
| Worker completo | 326 aprovados |
| UI completo, incluindo arquivos oficiais locais | 249 aprovados |
| Solicitação Worker | 27 aprovados |
| Solicitação UI/exportações | 25 aprovados |
| Planilhas Worker | 19 aprovados |
| Planilhas UI | 16 aprovados |
| Orçamento/cálculo/regimes Worker | 52 aprovados |
| Orçamento/SINAPI UI com arquivo oficial | 26 aprovados |
| Autocomplete Worker | 4 aprovados |
| Autocomplete UI | 17 aprovados |
| Seletor de regime SINAPI e wrap UI | 13 aprovados |
| Bases/SICRO/SBC Worker | 33 aprovados |
| Bases UI | 12 aprovados |
| Build | Aprovado |
| Typecheck de testes e aplicação | Aprovado |
| Lint | Aprovado |
| UTF-8/mojibake | 303 arquivos, zero problemas |

Os 52 testes específicos estão incluídos nos totais Worker/UI, não são uma contagem adicional de casos únicos. Foram exercitados seleção parcial/múltipla, revisão sem gravação, remoção/cancelamento, aceite de ausências, campos editáveis, confidencialidade por origem, referência dual, serviço legado longo, PDF/XLSX e downloads reais, agrupamento, fórmulas, zero/NULL, histórico, versão concorrente, retries simultâneos, cancelamento imutável, autorização e IDOR. As suítes completas abrangem também Obras, RDO, Documentos, cronograma/Gantt, Cadastro Inteligente e Importação Inteligente.

O build pode emitir avisos de comentários de anotação do Zod e chunks grandes, sem erros. O gerador PDF/fontkit fica em chunk lazy separado; não foi silenciado o aviso nem ampliado artificialmente o limite de tamanho.

## Validação visual local

Preview isolado em `127.0.0.1:4195`, com API/SQLite local em 4196 e fixture de obra/projeto/cliente de teste. Não houve uso da aplicação publicada para gravações ou smoke tests.

Conferidos **1920×1080, 1366×768, 1024×1366 e 375×812**: seleção já existente, ação habilitada, revisão, campos opcionais, descrições longas, ausências, confirmação, histórico e ações PDF/XLSX. O modal não apresentou overflow horizontal em nenhum tamanho. O corpo de fundo fica bloqueado durante o modal; foco é contido e restaurado, Escape fecha, ações durante operação ficam bloqueadas. No celular os campos ficam em uma coluna e o conteúdo mantém rolagem vertical.

Evidências de screenshots, arquivos gerados e logs ficam somente em `.wrangler/solicitacao-proposta/`, fora do escopo de commit.

## Arquivos da rodada

Modificados:

- `package.json`
- `package-lock.json`
- `src/react-app/components/ObraPlanilhasPanel.tsx`
- `src/worker/obras/planilhas.ts`

Criados:

- `migrations/0036_solicitacoes_proposta.sql`
- `public/fonts/NotoSans-Regular.ttf`
- `public/fonts/OFL-NotoSans.txt`
- `src/shared/solicitacoes-proposta.ts`
- `src/worker/obras/solicitacoes-proposta.ts`
- `src/react-app/components/SolicitacoesProposta.tsx`
- `src/react-app/components/solicitacoes-proposta.css`
- `src/react-app/lib/solicitacao-pdf.ts`
- `src/react-app/lib/solicitacao-xlsx.ts`
- `test/solicitacoes-proposta.test.ts`
- `test/ui/solicitacoes-proposta.test.tsx`
- `docs/RELATORIO-SOLICITACAO-PROPOSTA.md`

## Ponto de parada

Sem migration remota, deploy, commit ou push. Nenhuma importação, competência nova, upload R2, solicitação real, alteração da Yara ou gravação em produção. Bindings/configuração Cloudflare não foram alterados. A produção permanece fora do escopo executado nesta rodada; não se afirma uma nova auditoria remota de contagens.

Aguardar autorização específica para aplicar a **0036 em produção**, com backup atualizado e validação do destino antes da execução. A publicação também permanece pendente. Não iniciar propostas recebidas/comparação ou Medição.

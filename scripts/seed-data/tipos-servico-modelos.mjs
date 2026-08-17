// Dados dos modelos padrão de processo (etapas + tarefas) por Tipo de
// Serviço — Etapa F, Rodada F3.
//
// O Arquitetônico (piloto aprovado na Rodada F2, com 8 etapas / 44
// tarefas) NÃO aparece aqui de propósito: scripts/seed-tipos-servico-modelos.mjs
// só atua sobre tipos de serviço que ainda não têm nenhuma etapa modelo
// cadastrada, então incluir o Arquitetônico aqui seria irrelevante (seria
// sempre ignorado) e arriscaria divergir do piloto já validado.
//
// Convenções usadas em todos os modelos abaixo (mesmo padrão do piloto
// Arquitetônico):
//   - prazo_dias: null quando o prazo depende do porte/contrato do
//     projeto e um número fixo seria inventado sem base real (ex.:
//     acompanhamento de exigências de órgãos públicos, execução de obra).
//   - visivel_cliente: etapas de conferência interna, revisão de
//     arquivos, compatibilização técnica e verificações administrativas
//     ficam ocultas; briefing, levantamentos que o cliente percebe
//     diretamente (vistorias, visitas), desenvolvimento/estudo que gera
//     entregável, protocolo, acompanhamento de exigências relevantes,
//     aprovação e entrega ficam visíveis.
//   - responsavel_padrao_id: sempre null (nenhum responsável fixo
//     inventado).
//   - prioridade_padrao: sempre "normal" (padrão neutro; ajustável depois
//     por projeto).
//   - descricao: null em todas as etapas/tarefas, mesma convenção do
//     piloto Arquitetônico aprovado na F2. A coluna já existe no schema
//     (migrations 0011/0016) e pode ser preenchida depois, por etapa,
//     sem nenhuma alteração de schema.

export const MODELOS = [
	{
		nomeTipoServico: "Aprovação",
		etapas: [
			{
				nome: "Levantamento Documental",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Conferir documentação do cliente",
					"Verificar exigências do órgão competente",
					"Organizar documentos necessários",
				],
			},
			{
				nome: "Preparação do Processo",
				prazo_dias: 5,
				visivel_cliente: true,
				tarefas: [
					"Elaborar peças gráficas para aprovação",
					"Preencher formulários e requerimentos",
					"Revisar conformidade com a legislação aplicável",
					"Reunir documentação final do processo",
				],
			},
			{
				nome: "Protocolo",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: [
					"Protocolar processo no órgão competente",
					"Registrar número de protocolo",
					"Comunicar cliente sobre o protocolo",
				],
			},
			{
				nome: "Acompanhamento de Exigências",
				prazo_dias: null,
				visivel_cliente: true,
				tarefas: [
					"Acompanhar andamento do processo no órgão",
					"Registrar exigências recebidas",
					"Providenciar adequações solicitadas",
					"Reenviar documentação complementar",
				],
			},
			{
				nome: "Aprovação",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Obter deferimento/aprovação do órgão", "Emitir alvará ou certidão", "Arquivar documento aprovado"],
			},
			{
				nome: "Entrega",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: [
					"Organizar documentação aprovada para entrega",
					"Entregar aprovação ao cliente",
					"Encerrar processo técnico",
				],
			},
		],
	},
	{
		nomeTipoServico: "Consultoria",
		etapas: [
			{
				nome: "Briefing",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Realizar reunião inicial de consultoria", "Registrar demanda do cliente", "Definir escopo da consultoria"],
			},
			{
				nome: "Levantamento e Diagnóstico",
				prazo_dias: 5,
				visivel_cliente: false,
				tarefas: [
					"Levantar informações técnicas relevantes",
					"Realizar visita técnica quando necessário",
					"Analisar situação atual",
					"Identificar pontos críticos",
				],
			},
			{
				nome: "Análise Técnica",
				prazo_dias: 5,
				visivel_cliente: false,
				tarefas: ["Avaliar alternativas técnicas", "Elaborar estudo comparativo", "Consolidar recomendações técnicas"],
			},
			{
				nome: "Elaboração do Parecer",
				prazo_dias: 4,
				visivel_cliente: true,
				tarefas: [
					"Redigir parecer/relatório de consultoria",
					"Revisar parecer tecnicamente",
					"Preparar apresentação de recomendações",
				],
			},
			{
				nome: "Entrega",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Apresentar parecer ao cliente", "Registrar aceite da entrega", "Encerrar consultoria"],
			},
		],
	},
	{
		nomeTipoServico: "Elétrico",
		etapas: [
			{
				nome: "Briefing",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: [
					"Levantar necessidades de cargas e uso",
					"Realizar reunião inicial com o cliente",
					"Definir escopo do projeto elétrico",
				],
			},
			{
				nome: "Levantamento",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Levantar quadro de cargas existente",
					"Vistoriar instalação existente quando aplicável",
					"Registrar padrão de entrada de energia",
				],
			},
			{
				nome: "Estudo de Cargas e Dimensionamento",
				prazo_dias: 5,
				visivel_cliente: false,
				tarefas: ["Calcular demanda de carga", "Dimensionar quadros e circuitos", "Dimensionar proteção e aterramento"],
			},
			{
				nome: "Projeto Elétrico",
				prazo_dias: 7,
				visivel_cliente: true,
				tarefas: [
					"Elaborar planta de distribuição elétrica",
					"Elaborar diagrama unifilar",
					"Elaborar quadro de cargas",
					"Especificar materiais e equipamentos",
				],
			},
			{
				nome: "Compatibilização",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Compatibilizar com o projeto arquitetônico",
					"Verificar interferências com outras disciplinas",
					"Ajustar traçado de eletrodutos",
				],
			},
			{
				// Etapa opcional conforme o projeto (Rodada F3.1): nem todo
				// projeto elétrico exige protocolo junto à concessionária. A
				// estrutura atual não suporta marcar uma etapa do modelo como
				// "opcional" no momento da geração (só ativa/inativa, que vale
				// para TODOS os projetos futuros) — quando não for aplicável a
				// um projeto específico, remover via DELETE
				// /api/projetos/:id/etapas/:etapaId (já existente), como
				// documentado no relatório da F3.1.
				nome: "Aprovação / Concessionária",
				prazo_dias: null,
				visivel_cliente: true,
				tarefas: [
					"Preparar documentação para a concessionária, quando aplicável",
					"Protocolar projeto junto à concessionária, quando aplicável",
					"Acompanhar análise e exigências da concessionária",
					"Registrar aprovação/liberação da concessionária",
				],
			},
			{
				nome: "Entrega",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Emitir versão final do projeto elétrico", "Entregar documentação técnica ao cliente"],
			},
		],
	},
	{
		nomeTipoServico: "Estrutural",
		etapas: [
			{
				nome: "Briefing",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: [
					"Realizar reunião inicial com o cliente",
					"Levantar dados do projeto arquitetônico de referência",
					"Definir sistema estrutural",
				],
			},
			{
				nome: "Levantamento",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Levantar cargas e sobrecargas de projeto",
					"Levantar dados do solo quando disponíveis",
					"Conferir compatibilidade com o projeto arquitetônico",
				],
			},
			{
				nome: "Anteprojeto Estrutural",
				prazo_dias: 5,
				visivel_cliente: true,
				tarefas: [
					"Definir lançamento estrutural",
					"Pré-dimensionar elementos estruturais",
					"Elaborar esquema estrutural preliminar",
				],
			},
			{
				nome: "Projeto Estrutural Executivo",
				prazo_dias: 10,
				visivel_cliente: false,
				tarefas: [
					"Calcular a estrutura",
					"Detalhar elementos estruturais",
					"Elaborar plantas de formas",
					"Elaborar plantas de armação e detalhamento",
				],
			},
			{
				nome: "Compatibilização",
				prazo_dias: 5,
				visivel_cliente: false,
				tarefas: [
					"Compatibilizar com o projeto arquitetônico",
					"Compatibilizar com as instalações prediais",
					"Ajustar detalhamento conforme interferências identificadas",
				],
			},
			{
				nome: "Entrega",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Revisar documentação estrutural", "Emitir versão final", "Entregar documentação ao cliente"],
			},
		],
	},
	{
		nomeTipoServico: "Execução",
		etapas: [
			{
				nome: "Planejamento da Execução",
				prazo_dias: 5,
				visivel_cliente: true,
				tarefas: [
					"Elaborar cronograma físico-financeiro",
					"Definir equipe e fornecedores",
					"Levantar quantitativos e insumos",
				],
			},
			{
				nome: "Mobilização",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Mobilizar canteiro de obras",
					"Providenciar documentação inicial da obra (ART/RRT, licenças)",
					"Instalar canteiro e sinalização",
				],
			},
			{
				nome: "Execução da Obra",
				prazo_dias: null,
				visivel_cliente: true,
				tarefas: [
					"Acompanhar execução conforme cronograma",
					"Registrar avanço físico da obra",
					"Realizar reuniões periódicas de obra",
					"Controlar qualidade da execução",
				],
			},
			{
				// Rodada F3.1: camada formal de medição/controle (retaguarda),
				// distinta do acompanhamento qualitativo em campo já coberto
				// pela etapa "Execução da Obra" (cronograma no campo, reuniões,
				// qualidade) — evita repetir os mesmos itens.
				nome: "Medições e Controle",
				prazo_dias: null,
				visivel_cliente: false,
				tarefas: [
					"Medir avanço físico executado",
					"Conferir quantitativos e serviços executados",
					"Acompanhar custos realizados x orçados",
					"Registrar ocorrências da obra",
					"Registrar alterações de escopo",
					"Atualizar controles e indicadores da obra",
				],
			},
			{
				nome: "Entrega da Obra",
				prazo_dias: 5,
				visivel_cliente: true,
				tarefas: [
					"Realizar vistoria final da obra",
					"Elaborar relatório de entrega",
					"Emitir termo de recebimento",
					"Entregar obra ao cliente",
				],
			},
		],
	},
	{
		nomeTipoServico: "Gestão de Obra",
		etapas: [
			{
				nome: "Planejamento da Gestão",
				prazo_dias: 4,
				visivel_cliente: true,
				tarefas: [
					"Definir plano de gestão da obra",
					"Levantar cronograma e orçamento de referência",
					"Definir indicadores de acompanhamento",
				],
			},
			{
				nome: "Acompanhamento de Execução",
				prazo_dias: null,
				visivel_cliente: true,
				tarefas: [
					"Realizar visitas técnicas periódicas",
					"Acompanhar cronograma físico-financeiro",
					"Fiscalizar qualidade dos serviços executados",
					"Registrar não conformidades",
				],
			},
			{
				// Rodada F3.1: frente explícita de controle, separada do
				// acompanhamento qualitativo em campo (etapa anterior) —
				// mesmo padrão interno de "Controle de Fornecedores e
				// Contratos", logo também oculta ao cliente (o resumo
				// consolidado é o que o cliente vê, na etapa seguinte de
				// Relatórios de Gestão).
				nome: "Controle Físico-Financeiro",
				prazo_dias: null,
				visivel_cliente: false,
				tarefas: [
					"Acompanhar cronograma físico da obra",
					"Registrar avanço físico",
					"Acompanhar medições",
					"Acompanhar custos previstos x realizados",
					"Registrar desvios",
					"Apoiar atualização das projeções da obra",
				],
			},
			{
				nome: "Controle de Fornecedores e Contratos",
				prazo_dias: null,
				visivel_cliente: false,
				tarefas: [
					"Acompanhar contratos com fornecedores e empreiteiros",
					"Conferir medições de terceiros",
					"Validar notas fiscais e pagamentos",
				],
			},
			{
				nome: "Relatórios de Gestão",
				prazo_dias: null,
				visivel_cliente: true,
				tarefas: ["Elaborar relatório periódico de acompanhamento", "Apresentar status da obra ao cliente"],
			},
			{
				nome: "Encerramento",
				prazo_dias: 5,
				visivel_cliente: true,
				tarefas: [
					"Realizar vistoria final de encerramento",
					"Consolidar relatório final de gestão",
					"Entregar documentação ao cliente",
				],
			},
		],
	},
	{
		nomeTipoServico: "Hidrossanitário",
		etapas: [
			{
				nome: "Briefing",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: [
					"Realizar reunião inicial com o cliente",
					"Levantar necessidades hidrossanitárias",
					"Definir escopo do projeto",
				],
			},
			{
				nome: "Levantamento",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Levantar pontos hidráulicos e sanitários existentes",
					"Verificar disponibilidade de rede pública de água e esgoto",
					"Levantar dados do terreno para drenagem",
				],
			},
			{
				nome: "Dimensionamento",
				prazo_dias: 5,
				visivel_cliente: false,
				tarefas: [
					"Dimensionar rede de água fria e quente",
					"Dimensionar rede de esgoto e ventilação",
					"Dimensionar drenagem pluvial",
				],
			},
			{
				nome: "Projeto Hidrossanitário",
				prazo_dias: 7,
				visivel_cliente: true,
				tarefas: [
					"Elaborar planta hidráulica",
					"Elaborar planta sanitária e de esgoto",
					"Elaborar planta de águas pluviais",
					"Especificar materiais e equipamentos",
				],
			},
			{
				nome: "Compatibilização",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Compatibilizar com o projeto arquitetônico",
					"Compatibilizar com o projeto estrutural",
					"Verificar interferências com outras disciplinas",
				],
			},
			{
				// Etapa opcional conforme o projeto (Rodada F3.1) — mesma
				// lógica e mesma limitação de suporte do Elétrico: sem toggle
				// "opcional" no momento da geração, remover via DELETE
				// /api/projetos/:id/etapas/:etapaId quando não aplicável.
				nome: "Aprovação / Concessionária",
				prazo_dias: null,
				visivel_cliente: true,
				tarefas: [
					"Preparar documentação para concessionária/órgão competente, quando aplicável",
					"Protocolar projeto junto à concessionária/órgão competente, quando aplicável",
					"Acompanhar análise e exigências",
					"Registrar aprovação/liberação",
				],
			},
			{
				nome: "Entrega",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Emitir versão final do projeto", "Entregar documentação técnica ao cliente"],
			},
		],
	},
	{
		nomeTipoServico: "Interiores",
		etapas: [
			{
				nome: "Briefing",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: [
					"Realizar reunião inicial com o cliente",
					"Registrar preferências de estilo e uso dos ambientes",
					"Definir programa de necessidades",
				],
			},
			{
				nome: "Levantamento",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Levantar medidas dos ambientes",
					"Realizar levantamento fotográfico",
					"Conferir projeto arquitetônico de referência",
				],
			},
			{
				nome: "Estudo Preliminar",
				prazo_dias: 5,
				visivel_cliente: true,
				tarefas: [
					"Desenvolver conceito e moodboard",
					"Elaborar layout preliminar de mobiliário",
					"Apresentar proposta inicial ao cliente",
					"Registrar aprovação ou solicitações de alteração",
				],
			},
			{
				nome: "Projeto de Interiores",
				prazo_dias: 7,
				visivel_cliente: true,
				tarefas: [
					"Detalhar plantas de layout e mobiliário",
					"Especificar materiais, acabamentos e revestimentos",
					"Elaborar projeto de iluminação",
					"Elaborar detalhamento de marcenaria",
				],
			},
			{
				nome: "Compatibilização",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Compatibilizar com projetos complementares (elétrico, hidráulico)",
					"Verificar interferências com a estrutura",
				],
			},
			{
				nome: "Entrega",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Consolidar caderno de especificações", "Emitir versão final", "Entregar ao cliente"],
			},
		],
	},
	{
		nomeTipoServico: "Laudo",
		etapas: [
			{
				nome: "Coleta Documental",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Reunir documentação do imóvel ou objeto do laudo",
					"Levantar histórico e informações relevantes",
					"Conferir escopo solicitado pelo cliente",
				],
			},
			{
				nome: "Inspeção Técnica",
				prazo_dias: 3,
				visivel_cliente: true,
				tarefas: [
					"Realizar vistoria/inspeção in loco",
					"Registrar evidências fotográficas",
					"Coletar dados técnicos necessários",
				],
			},
			{
				nome: "Análise Técnica",
				prazo_dias: 5,
				visivel_cliente: false,
				tarefas: [
					"Analisar dados coletados",
					"Realizar cálculos/verificações técnicas quando aplicável",
					"Consultar normas técnicas pertinentes",
				],
			},
			{
				nome: "Diagnóstico",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: ["Consolidar diagnóstico técnico", "Formular conclusões técnicas", "Revisar conformidade com normas"],
			},
			{
				nome: "Elaboração do Laudo",
				prazo_dias: 5,
				visivel_cliente: true,
				tarefas: ["Redigir laudo técnico", "Elaborar anexos e memoriais", "Revisar laudo tecnicamente"],
			},
			{
				nome: "Emissão",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: [
					"Assinar e registrar responsabilidade técnica (ART/RRT)",
					"Emitir laudo final",
					"Entregar laudo ao cliente",
				],
			},
		],
	},
	{
		nomeTipoServico: "Medição",
		etapas: [
			{
				nome: "Levantamento de Escopo",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: [
					"Realizar reunião inicial para definir escopo da medição",
					"Conferir documentação de referência (contrato, projeto)",
				],
			},
			{
				nome: "Vistoria",
				prazo_dias: 3,
				visivel_cliente: true,
				tarefas: ["Realizar vistoria em campo", "Coletar medidas e quantidades executadas", "Registrar evidências fotográficas"],
			},
			{
				nome: "Quantificação",
				prazo_dias: 4,
				visivel_cliente: false,
				tarefas: ["Processar dados de campo", "Elaborar planilha de quantitativos", "Calcular percentual executado"],
			},
			{
				nome: "Conferência",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Conferir quantitativos com projeto e contrato",
					"Validar medição com o engenheiro responsável",
					"Identificar divergências",
				],
			},
			{
				nome: "Documentação",
				prazo_dias: 2,
				visivel_cliente: false,
				tarefas: ["Elaborar memória de cálculo da medição", "Organizar boletim de medição"],
			},
			{
				nome: "Entrega",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Emitir boletim de medição final", "Entregar medição ao cliente/contratante"],
			},
		],
	},
	{
		nomeTipoServico: "Orçamento",
		etapas: [
			{
				nome: "Levantamento de Escopo",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Realizar reunião inicial para levantar escopo do orçamento", "Conferir projeto e memorial descritivo"],
			},
			{
				nome: "Levantamento de Quantitativos",
				prazo_dias: 5,
				visivel_cliente: false,
				tarefas: [
					"Extrair quantitativos do projeto",
					"Conferir quantitativos por disciplina",
					"Organizar planilha de quantitativos",
				],
			},
			{
				nome: "Cotação e Composição de Custos",
				prazo_dias: 5,
				visivel_cliente: false,
				tarefas: ["Pesquisar preços de insumos e serviços", "Compor custos unitários", "Aplicar BDI e encargos"],
			},
			{
				nome: "Elaboração do Orçamento",
				prazo_dias: 4,
				visivel_cliente: true,
				tarefas: [
					"Consolidar planilha orçamentária",
					"Elaborar cronograma físico-financeiro",
					"Revisar orçamento",
				],
			},
			{
				nome: "Entrega",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Emitir orçamento final", "Apresentar orçamento ao cliente", "Entregar documentação"],
			},
		],
	},
	{
		// Modelo genérico e enxuto (Parte 6 da Rodada F3): não tenta prever um
		// serviço específico, serve de ponto de partida editável.
		nomeTipoServico: "Outros",
		etapas: [
			{
				nome: "Entrada da Demanda",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Registrar solicitação do cliente", "Definir escopo da demanda"],
			},
			{
				nome: "Levantamento de Informações",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: ["Levantar informações necessárias", "Reunir documentação relevante"],
			},
			{
				nome: "Desenvolvimento",
				prazo_dias: 5,
				visivel_cliente: true,
				tarefas: ["Desenvolver o trabalho solicitado", "Registrar andamento do trabalho"],
			},
			{
				nome: "Revisão",
				prazo_dias: 2,
				visivel_cliente: false,
				tarefas: ["Revisar trabalho desenvolvido", "Ajustar conforme necessário"],
			},
			{
				nome: "Entrega",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: ["Emitir versão final", "Entregar ao cliente"],
			},
		],
	},
	{
		nomeTipoServico: "Prevenção e Combate a Incêndio",
		etapas: [
			{
				nome: "Levantamento",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: [
					"Levantar dados da edificação",
					"Verificar classificação de risco e ocupação",
					"Conferir legislação do corpo de bombeiros aplicável",
				],
			},
			{
				nome: "Desenvolvimento Técnico",
				prazo_dias: 7,
				visivel_cliente: false,
				tarefas: [
					"Dimensionar sistema de hidrantes e extintores",
					"Dimensionar sistema de alarme e detecção",
					"Elaborar plano de saídas de emergência",
				],
			},
			{
				nome: "Elaboração do Projeto",
				prazo_dias: 5,
				visivel_cliente: true,
				tarefas: [
					"Elaborar plantas técnicas de PCI",
					"Elaborar memorial descritivo",
					"Especificar equipamentos de combate a incêndio",
				],
			},
			{
				nome: "Documentação e Protocolo",
				prazo_dias: 3,
				visivel_cliente: true,
				tarefas: ["Preparar documentação para o corpo de bombeiros", "Protocolar projeto no órgão competente"],
			},
			{
				// Rodada F3.1: etapa final consolidada — "aprovação do
				// projeto" e "emissão de AVCB/CLCB" não são necessariamente o
				// mesmo ato (o AVCB, quando exigido, normalmente depende de
				// vistoria posterior à aprovação do projeto). Nomenclatura
				// mais abrangente para não presumir uma modalidade única de
				// exigência do Corpo de Bombeiros.
				nome: "Aprovação / Regularização junto ao Corpo de Bombeiros",
				prazo_dias: null,
				visivel_cliente: true,
				tarefas: [
					"Acompanhar análise do processo pelo Corpo de Bombeiros",
					"Responder exigências, quando houver",
					"Registrar aprovação do projeto",
					"Acompanhar vistoria, quando fizer parte do escopo",
					"Registrar emissão de AVCB/CLCB ou documento equivalente, quando aplicável",
					"Preparar entrega final ao cliente",
				],
			},
		],
	},
	{
		nomeTipoServico: "Regularização",
		etapas: [
			{
				nome: "Levantamento Documental",
				prazo_dias: 5,
				visivel_cliente: false,
				tarefas: [
					"Levantar documentação existente do imóvel",
					"Verificar situação registral e cadastral",
					"Identificar pendências e irregularidades",
				],
			},
			{
				nome: "Análise Técnica e Legal",
				prazo_dias: 5,
				visivel_cliente: false,
				tarefas: [
					"Analisar conformidade com a legislação vigente",
					"Avaliar alternativas de regularização",
					"Consultar órgãos competentes quando necessário",
				],
			},
			{
				nome: "Adequações",
				prazo_dias: null,
				visivel_cliente: false,
				tarefas: ["Elaborar peças técnicas de adequação", "Ajustar projeto conforme exigências legais"],
			},
			{
				nome: "Protocolo",
				prazo_dias: 3,
				visivel_cliente: true,
				tarefas: ["Preparar documentação para protocolo", "Protocolar processo de regularização no órgão competente"],
			},
			{
				nome: "Acompanhamento de Exigências",
				prazo_dias: null,
				visivel_cliente: true,
				tarefas: ["Acompanhar andamento do processo", "Providenciar documentação complementar exigida"],
			},
			{
				nome: "Aprovação / Regularização",
				prazo_dias: null,
				visivel_cliente: true,
				tarefas: [
					"Obter aprovação/certidão de regularização junto ao órgão competente",
					"Registrar deferimento do processo",
				],
			},
			{
				// Rodada F3.1: o processo não termina necessariamente na
				// aprovação administrativa — averbação em cartório e
				// documentação fiscal/previdenciária só entram quando fazem
				// parte do escopo contratado, nunca presumidas por padrão.
				nome: "Documentação Final / Averbação",
				prazo_dias: null,
				visivel_cliente: true,
				tarefas: [
					"Organizar documentação aprovada",
					"Verificar necessidade de procedimentos posteriores",
					"Acompanhar averbação em cartório, quando fizer parte do escopo",
					"Acompanhar documentação fiscal/previdenciária, quando aplicável",
					"Consolidar documentação final",
					"Entregar processo ao cliente",
				],
			},
		],
	},
	{
		nomeTipoServico: "Vistoria",
		etapas: [
			{
				nome: "Agendamento e Preparação",
				prazo_dias: 1,
				visivel_cliente: true,
				tarefas: ["Agendar vistoria com o cliente", "Reunir documentação de referência para a vistoria"],
			},
			{
				nome: "Execução da Vistoria",
				prazo_dias: 2,
				visivel_cliente: true,
				tarefas: [
					"Realizar vistoria técnica in loco",
					"Registrar evidências fotográficas",
					"Coletar dados e medições necessárias",
				],
			},
			{
				nome: "Análise",
				prazo_dias: 3,
				visivel_cliente: false,
				tarefas: ["Analisar dados coletados na vistoria", "Identificar não conformidades ou pontos de atenção"],
			},
			{
				nome: "Elaboração do Relatório",
				prazo_dias: 3,
				visivel_cliente: true,
				tarefas: ["Redigir relatório de vistoria", "Revisar relatório tecnicamente"],
			},
			{
				nome: "Entrega",
				prazo_dias: 1,
				visivel_cliente: true,
				tarefas: ["Emitir relatório final", "Entregar relatório ao cliente"],
			},
		],
	},
];

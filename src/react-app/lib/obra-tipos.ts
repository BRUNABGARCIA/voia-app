export type StatusObra = "planejamento" | "aguardando_inicio" | "em_execucao" | "pausada" | "concluida" | "cancelada";

export const STATUS_OBRA: StatusObra[] = [
	"planejamento",
	"aguardando_inicio",
	"em_execucao",
	"pausada",
	"concluida",
	"cancelada",
];

export const STATUS_OBRA_LABEL: Record<StatusObra, string> = {
	planejamento: "Planejamento",
	aguardando_inicio: "Aguardando início",
	em_execucao: "Em execução",
	pausada: "Pausada",
	concluida: "Concluída",
	cancelada: "Cancelada",
};

export const STATUS_OBRA_BADGE: Record<StatusObra, string> = {
	planejamento: "bg-voia-neutral-100 text-voia-neutral-500",
	aguardando_inicio: "bg-voia-info/15 text-voia-info",
	em_execucao: "bg-voia-success/15 text-voia-success",
	pausada: "bg-voia-warning/15 text-voia-warning",
	concluida: "bg-voia-success/15 text-voia-success",
	cancelada: "bg-voia-danger/15 text-voia-danger",
};

export interface Obra {
	id: number;
	projeto_id: number;
	projeto_nome: string;
	cliente_nome: string;
	nome: string;
	endereco: string | null;
	responsavel_tecnico_id: number | null;
	responsavel_tecnico_nome: string | null;
	responsavel_operacional_id: number | null;
	responsavel_operacional_nome: string | null;
	data_inicio_prevista: string | null;
	data_fim_prevista: string | null;
	data_inicio_real: string | null;
	data_fim_real: string | null;
	status: StatusObra;
	progresso: number;
	observacoes: string | null;
	criado_em: string;
	atualizado_em: string;
	atrasada: number;
}

export type CategoriaOcorrencia =
	| "incompatibilidade"
	| "atraso"
	| "material"
	| "qualidade"
	| "seguranca"
	| "cliente"
	| "projeto"
	| "execucao";

export const CATEGORIAS_OCORRENCIA: CategoriaOcorrencia[] = [
	"incompatibilidade",
	"atraso",
	"material",
	"qualidade",
	"seguranca",
	"cliente",
	"projeto",
	"execucao",
];

export const CATEGORIA_OCORRENCIA_LABEL: Record<CategoriaOcorrencia, string> = {
	incompatibilidade: "Incompatibilidade",
	atraso: "Atraso",
	material: "Material",
	qualidade: "Qualidade",
	seguranca: "Segurança",
	cliente: "Cliente",
	projeto: "Projeto",
	execucao: "Execução",
};

export type StatusOcorrencia = "aberta" | "em_tratamento" | "resolvida" | "cancelada";

export const STATUS_OCORRENCIA: StatusOcorrencia[] = ["aberta", "em_tratamento", "resolvida", "cancelada"];

export const STATUS_OCORRENCIA_LABEL: Record<StatusOcorrencia, string> = {
	aberta: "Aberta",
	em_tratamento: "Em tratamento",
	resolvida: "Resolvida",
	cancelada: "Cancelada",
};

export const STATUS_OCORRENCIA_BADGE: Record<StatusOcorrencia, string> = {
	aberta: "bg-voia-danger/15 text-voia-danger",
	em_tratamento: "bg-voia-warning/15 text-voia-warning",
	resolvida: "bg-voia-success/15 text-voia-success",
	cancelada: "bg-voia-neutral-100 text-voia-neutral-500",
};

export interface Ocorrencia {
	id: number;
	obra_id: number;
	titulo: string;
	descricao: string | null;
	categoria: CategoriaOcorrencia;
	prioridade: "baixa" | "normal" | "alta" | "urgente";
	status: StatusOcorrencia;
	responsavel_id: number | null;
	responsavel_nome: string | null;
	prazo: string | null;
	criado_por_id: number;
	criado_por_nome: string | null;
	resolvido_em: string | null;
	criado_em: string;
	atualizado_em: string;
}

export interface Rdo {
	id: number;
	obra_id: number;
	data: string;
	criado_por_id: number;
	criado_por_nome: string | null;
	condicoes_climaticas: string | null;
	mao_de_obra: string | null;
	servicos_executados: string | null;
	equipamentos: string | null;
	materiais: string | null;
	ocorrencias: string | null;
	observacoes: string | null;
	criado_em: string;
	atualizado_em: string;
}

export interface FotoObra {
	id: number;
	obra_id: number;
	rdo_id: number | null;
	legenda: string | null;
	data: string;
	enviado_por_id: number | null;
	enviado_por_nome: string | null;
	nome_arquivo_original: string | null;
	mime_type: string | null;
	tamanho_bytes: number | null;
	criado_em: string;
}

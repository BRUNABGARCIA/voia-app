export interface Projeto {
	id: number;
	cliente_id: number;
	cliente_nome: string;
	codigo: string | null;
	nome: string;
	descricao: string | null;
	status: StatusProjeto;
	prioridade: PrioridadeProjeto;
	progresso: number;
	valor_contratado: number | null; // centavos
	data_inicio: string | null;
	prazo_previsto: string | null;
	cep: string | null;
	logradouro: string | null;
	numero: string | null;
	complemento: string | null;
	bairro: string | null;
	cidade: string | null;
	estado: string | null;
	gerente_id: number | null;
	gerente_nome: string | null;
	criado_por_id: number;
	observacoes: string | null;
	criado_em: string;
	atualizado_em: string;
}

export interface TipoServico {
	id: number;
	nome: string;
}

export interface MembroProjeto {
	usuario_id: number;
	funcao: FuncaoMembro;
	adicionado_em: string;
	nome: string;
	email: string;
}

export type StatusEtapa = "pendente" | "em_andamento" | "concluida";

export interface Etapa {
	id: number;
	projeto_id: number;
	nome: string;
	descricao: string | null;
	ordem: number;
	status: StatusEtapa;
	data_inicio_prevista: string | null;
	data_fim_prevista: string | null;
	data_inicio_real: string | null;
	data_conclusao: string | null;
	observacao_interna: string | null;
	visivel_cliente: number;
	peso: number;
	tipo_servico_id: number | null;
	modelo_etapa_id: number | null;
	criado_em: string;
	atualizado_em: string;
	// (data_fim_prevista vencida e status <> concluida) — calculado no backend.
	atrasada: number;
}

export type TipoAtualizacao = "geral" | "protocolo" | "pendencia" | "aprovacao" | "etapa" | "sistema";

export interface Atualizacao {
	id: number;
	projeto_id: number;
	etapa_id: number | null;
	etapa_nome: string | null;
	titulo: string;
	descricao: string | null;
	tipo: TipoAtualizacao;
	visivel_cliente: number;
	criado_em: string;
	criado_por_nome: string;
}

export const TIPO_ATUALIZACAO: TipoAtualizacao[] = ["geral", "protocolo", "pendencia", "aprovacao", "etapa", "sistema"];

export const TIPO_ATUALIZACAO_LABEL: Record<TipoAtualizacao, string> = {
	geral: "Geral",
	protocolo: "Protocolo",
	pendencia: "Pendência",
	aprovacao: "Aprovação",
	etapa: "Etapa",
	sistema: "Sistema",
};

export const STATUS_ETAPA: StatusEtapa[] = ["pendente", "em_andamento", "concluida"];

export const STATUS_ETAPA_LABEL: Record<StatusEtapa, string> = {
	pendente: "Pendente",
	em_andamento: "Em andamento",
	concluida: "Concluída",
};

export const STATUS_ETAPA_BADGE: Record<StatusEtapa, string> = {
	pendente: "bg-voia-neutral-100 text-voia-neutral-500",
	em_andamento: "bg-voia-info/15 text-voia-info",
	concluida: "bg-voia-success/15 text-voia-success",
};

export type StatusProjeto =
	| "prospeccao"
	| "planejamento"
	| "em_andamento"
	| "aguardando_cliente"
	| "aguardando_terceiro"
	| "pausado"
	| "concluido"
	| "cancelado";

export type PrioridadeProjeto = "baixa" | "normal" | "alta" | "urgente";

export type FuncaoMembro = "responsavel" | "projetista" | "fiscal" | "orcamentista" | "colaborador";

export const STATUS_PROJETO: StatusProjeto[] = [
	"prospeccao",
	"planejamento",
	"em_andamento",
	"aguardando_cliente",
	"aguardando_terceiro",
	"pausado",
	"concluido",
	"cancelado",
];

export const STATUS_PROJETO_LABEL: Record<StatusProjeto, string> = {
	prospeccao: "Prospecção",
	planejamento: "Planejamento",
	em_andamento: "Em andamento",
	aguardando_cliente: "Aguardando cliente",
	aguardando_terceiro: "Aguardando terceiro",
	pausado: "Pausado",
	concluido: "Concluído",
	cancelado: "Cancelado",
};

export const STATUS_PROJETO_BADGE: Record<StatusProjeto, string> = {
	prospeccao: "bg-voia-neutral-100 text-voia-neutral-500",
	planejamento: "bg-voia-info/15 text-voia-info",
	em_andamento: "bg-voia-success/15 text-voia-success",
	aguardando_cliente: "bg-voia-warning/15 text-voia-warning",
	aguardando_terceiro: "bg-voia-warning/15 text-voia-warning",
	pausado: "bg-voia-neutral-100 text-voia-neutral-500",
	concluido: "bg-voia-success/15 text-voia-success",
	cancelado: "bg-voia-danger/15 text-voia-danger",
};

export const PRIORIDADES: PrioridadeProjeto[] = ["baixa", "normal", "alta", "urgente"];

export const PRIORIDADE_LABEL: Record<PrioridadeProjeto, string> = {
	baixa: "Baixa",
	normal: "Normal",
	alta: "Alta",
	urgente: "Urgente",
};

export const PRIORIDADE_BADGE: Record<PrioridadeProjeto, string> = {
	baixa: "bg-voia-neutral-100 text-voia-neutral-500",
	normal: "bg-voia-info/15 text-voia-info",
	alta: "bg-voia-warning/15 text-voia-warning",
	urgente: "bg-voia-danger/15 text-voia-danger",
};

export const FUNCOES_MEMBRO: FuncaoMembro[] = ["responsavel", "projetista", "fiscal", "orcamentista", "colaborador"];

export const FUNCAO_MEMBRO_LABEL: Record<FuncaoMembro, string> = {
	responsavel: "Responsável",
	projetista: "Projetista",
	fiscal: "Fiscal",
	orcamentista: "Orçamentista",
	colaborador: "Colaborador",
};

export const STATUS_FINALIZADOS: StatusProjeto[] = ["concluido", "cancelado"];

/** Formata centavos (armazenados no banco) como "R$ 1.234,56". */
export function formatarMoeda(centavos: number | null): string {
	if (centavos === null) return "—";
	return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(valor: string | null): string {
	if (!valor) return "—";
	const data = new Date(valor.length <= 10 ? `${valor}T00:00:00` : valor.replace(" ", "T"));
	if (Number.isNaN(data.getTime())) return "—";
	return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function projetoAtrasado(projeto: Pick<Projeto, "prazo_previsto" | "status">): boolean {
	if (!projeto.prazo_previsto) return false;
	if (STATUS_FINALIZADOS.includes(projeto.status)) return false;
	return new Date(`${projeto.prazo_previsto}T23:59:59`).getTime() < Date.now();
}

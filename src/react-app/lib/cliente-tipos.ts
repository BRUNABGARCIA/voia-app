export interface Cliente {
	id: number;
	tipo: "PF" | "PJ";
	nome: string;
	nome_fantasia: string | null;
	documento: string | null;
	email: string | null;
	telefone: string | null;
	whatsapp: string | null;
	cep: string | null;
	logradouro: string | null;
	numero: string | null;
	complemento: string | null;
	bairro: string | null;
	cidade: string | null;
	estado: string | null;
	status: "lead" | "ativo" | "inativo";
	origem: string | null;
	responsavel_interno_id: number | null;
	responsavel_interno_nome: string | null;
	observacoes: string | null;
	criado_em: string;
	atualizado_em: string;
}

export interface ProjetoDoCliente {
	id: number;
	codigo: string | null;
	nome: string;
	status: string;
	prioridade: string;
	progresso: number;
	prazo_previsto: string | null;
	gerente_nome: string | null;
}

export const STATUS_LABEL: Record<Cliente["status"], string> = {
	lead: "Lead",
	ativo: "Ativo",
	inativo: "Inativo",
};

export const STATUS_BADGE: Record<Cliente["status"], string> = {
	lead: "bg-voia-info/15 text-voia-info",
	ativo: "bg-voia-success/15 text-voia-success",
	inativo: "bg-voia-neutral-100 text-voia-neutral-500",
};

export const TIPO_LABEL: Record<Cliente["tipo"], string> = {
	PF: "Pessoa Física",
	PJ: "Pessoa Jurídica",
};

export interface ContatoCliente {
	id: number;
	cliente_id: number;
	nome: string;
	email: string;
	telefone: string | null;
	ativo: number;
	ultimo_login_em: string | null;
	criado_em: string;
	atualizado_em: string;
}

export interface ProcessoAutorizavel {
	id: number;
	codigo: string | null;
	nome: string;
	status: string;
	autorizado: number;
}

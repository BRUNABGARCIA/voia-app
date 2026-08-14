export interface TipoServicoAdmin {
	id: number;
	nome: string;
	ativo: number;
	total_etapas_modelo: number;
}

export interface TarefaModelo {
	id: number;
	modelo_etapa_id: number;
	nome: string;
	descricao: string | null;
	ordem: number;
	prazo_dias: number | null;
	prioridade_padrao: "baixa" | "normal" | "alta" | "urgente";
	responsavel_padrao_id: number | null;
	responsavel_padrao_nome: string | null;
	visivel_cliente: number;
	exige_aprovacao: number;
	ativa: number;
	criado_em: string;
	atualizado_em: string;
}

export interface EtapaModelo {
	id: number;
	tipo_servico_id: number;
	nome: string;
	descricao: string | null;
	ordem: number;
	prazo_dias: number | null;
	peso: number;
	visivel_cliente: number;
	notificar_cliente: number;
	ativa: number;
	criado_em: string;
	atualizado_em: string;
	tarefas: TarefaModelo[];
}

export interface TipoServicoAdmin {
	id: number;
	nome: string;
	ativo: number;
	total_etapas_modelo: number;
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
	criado_em: string;
	atualizado_em: string;
}

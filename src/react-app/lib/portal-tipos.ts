export interface ProcessoResumoPortal {
	id: number;
	codigo: string | null;
	nome: string;
	status: string;
	progresso: number;
	prazoPrevisto: string | null;
	tiposServico: { id: number; nome: string }[];
	etapaAtual: { nome: string; atrasada: boolean } | null;
	proximoPrazo: string | null;
}

export interface TarefaPortal {
	id: number;
	nome: string;
	descricao: string | null;
	status: string;
	prazo: string | null;
	dataConclusao: string | null;
	atrasada: boolean;
}

export interface EtapaPortal {
	id: number;
	nome: string;
	descricao: string | null;
	ordem: number;
	status: string;
	dataInicioPrevista: string | null;
	dataFimPrevista: string | null;
	dataConclusao: string | null;
	atrasada: boolean;
	tarefas: TarefaPortal[];
}

export interface AtualizacaoPortal {
	id: number;
	titulo: string;
	descricao: string | null;
	tipo: string;
	criadoEm: string;
}

export interface DocumentoPortal {
	id: number;
	nome: string;
	categoria: string;
	descricao: string | null;
	criadoEm: string;
	mimeType: string | null;
	tamanhoBytes: number | null;
	possuiArquivo: boolean;
}

export function formatarTamanhoArquivo(bytes: number | null): string {
	if (bytes === null || bytes <= 0) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ProcessoDetalhePortal {
	processo: {
		id: number;
		codigo: string | null;
		nome: string;
		status: string;
		progresso: number;
		baseadoEm: "tarefas" | "etapas";
		totalEtapas: number;
		etapasConcluidas: number;
		totalTarefas: number;
		tarefasConcluidas: number;
		tiposServico: { id: number; nome: string }[];
	};
	etapaAtual: EtapaPortal | null;
	proximaEtapa: EtapaPortal | null;
	etapas: EtapaPortal[];
	atualizacoes: AtualizacaoPortal[];
	documentos: DocumentoPortal[];
}

export const CATEGORIA_DOCUMENTO_PORTAL_LABEL: Record<string, string> = {
	contrato: "Contrato",
	proposta: "Proposta",
	projeto: "Projeto",
	levantamento: "Levantamento",
	relatorio: "Relatório",
	art_rrt: "ART/RRT",
	aprovacao: "Aprovação",
	documento_cliente: "Documento do Cliente",
	outros: "Outros",
};

export const STATUS_PROCESSO_LABEL: Record<string, string> = {
	prospeccao: "Prospecção",
	planejamento: "Planejamento",
	em_andamento: "Em andamento",
	aguardando_cliente: "Aguardando cliente",
	aguardando_terceiro: "Aguardando terceiro",
	pausado: "Pausado",
	concluido: "Concluído",
	cancelado: "Cancelado",
};

export function formatarDataPortal(valor: string | null): string {
	if (!valor) return "—";
	const data = new Date(`${valor}T00:00:00`);
	if (Number.isNaN(data.getTime())) return "—";
	return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

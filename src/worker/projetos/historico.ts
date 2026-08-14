/**
 * Registro automático de eventos no histórico de andamento
 * (projeto_atualizacoes, 0013/0018) — a mesma tabela que já alimenta a
 * timeline "Andamento" e o Portal do Cliente, evitando uma segunda
 * estrutura quase idêntica. Eventos automáticos usam a coluna "tipo"
 * (categoria ampla, já existente) e a nova "tipo_evento" (chave
 * específica), sem inventar um novo enum.
 */

interface EventoAutomatico {
	projetoId: number;
	tipo: "etapa" | "sistema";
	tipoEvento: string;
	entidadeTipo: "etapa" | "tarefa" | "projeto";
	entidadeId: number;
	titulo: string;
	descricao?: string | null;
	usuarioId: number;
	visivelCliente: boolean;
	etapaId?: number | null;
}

export async function registrarEvento(db: D1Database, evento: EventoAutomatico): Promise<void> {
	await db
		.prepare(
			`INSERT INTO projeto_atualizacoes (
				projeto_id, etapa_id, titulo, descricao, tipo, visivel_cliente, criado_por_id,
				entidade_tipo, entidade_id, tipo_evento
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			evento.projetoId,
			evento.etapaId ?? null,
			evento.titulo,
			evento.descricao ?? null,
			evento.tipo,
			evento.visivelCliente ? 1 : 0,
			evento.usuarioId,
			evento.entidadeTipo,
			evento.entidadeId,
			evento.tipoEvento,
		)
		.run();
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

interface EventoCalendario {
	data: string;
	tipo: "tarefa" | "etapa" | "pagamento" | "obra";
	titulo: string;
	projetoId: number | null;
	projetoNome: string | null;
}

const TIPO_LABEL: Record<string, string> = {
	tarefa: "Tarefa",
	etapa: "Entrega de etapa",
	obra: "Obra",
	pagamento: "Pagamento",
};

const TIPO_BADGE: Record<string, string> = {
	tarefa: "bg-voia-info/15 text-voia-info",
	etapa: "bg-voia-warning/15 text-voia-warning",
	obra: "bg-voia-green-100 text-voia-green-900",
	pagamento: "bg-voia-success/15 text-voia-success",
};

function formatarCabecalhoData(iso: string): string {
	const data = new Date(`${iso}T00:00:00`);
	if (Number.isNaN(data.getTime())) return iso;
	const hoje = new Date();
	hoje.setHours(0, 0, 0, 0);
	const diffDias = Math.round((data.getTime() - hoje.getTime()) / 86400000);
	const formatado = data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
	if (diffDias === 0) return `Hoje — ${formatado}`;
	if (diffDias === -1) return `Ontem — ${formatado}`;
	if (diffDias === 1) return `Amanhã — ${formatado}`;
	return formatado;
}

/**
 * Agenda operacional — "calendário mensal simples; lista por data no
 * mobile" (pedido da Rodada 04). Optamos pela lista-por-data como
 * apresentação única (desktop e mobile): cobre o mesmo requisito sem a
 * complexidade adicional de uma grade de mês, mantendo a fundação simples
 * de auditar e testar. Composição pura de dados existentes — nenhuma
 * tabela nova.
 */
export default function Calendario() {
	const [eventos, setEventos] = useState<EventoCalendario[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/calendario", { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<{ eventos: EventoCalendario[] }>;
			})
			.then((data) => {
				if (!cancelled) setEventos(data.eventos);
			})
			.catch(() => {
				if (!cancelled) setError("Não foi possível carregar o calendário.");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const porData = useMemo(() => {
		const mapa = new Map<string, EventoCalendario[]>();
		for (const evento of eventos ?? []) {
			const lista = mapa.get(evento.data) ?? [];
			lista.push(evento);
			mapa.set(evento.data, lista);
		}
		return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b));
	}, [eventos]);

	return (
		<div>
			<h1 className="font-display text-2xl font-light text-voia-neutral-900">Calendário</h1>
			<p className="mt-1 text-sm text-voia-neutral-700">Tarefas, entregas e compromissos dos próximos dias.</p>

			{error && <p className="mt-6 text-sm text-voia-danger">{error}</p>}
			{!error && !eventos && <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>}

			{eventos && eventos.length === 0 && (
				<p className="mt-6 text-sm text-voia-neutral-500">Nenhum compromisso nos próximos dias.</p>
			)}

			{eventos && eventos.length > 0 && (
				<div className="mt-6 space-y-4">
					{porData.map(([data, itens]) => (
						<div key={data} className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<h2 className="font-display text-base capitalize text-voia-green-900">{formatarCabecalhoData(data)}</h2>
							<ul className="mt-3 space-y-2">
								{itens.map((evento, i) => (
									<li key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">
										<div>
											<span className="font-medium text-voia-neutral-900">{evento.titulo}</span>
											{evento.projetoId && (
												<Link to={`/projetos/${evento.projetoId}`} className="ml-2 text-xs text-voia-neutral-500 hover:underline">
													{evento.projetoNome}
												</Link>
											)}
										</div>
										<span className={`rounded-control px-2 py-0.5 text-xs font-medium ${TIPO_BADGE[evento.tipo]}`}>
											{TIPO_LABEL[evento.tipo]}
										</span>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

import { useEffect, useState } from "react";
import { STATUS_ETAPA_BADGE, STATUS_ETAPA_LABEL, formatarData, type Etapa } from "../lib/projeto-tipos";

/**
 * Cronograma leve (sem biblioteca de Gantt) — reaproveita só os dados que
 * projeto_etapas já tem (data_inicio_prevista/data_fim_prevista/progresso
 * via tarefas_concluidas/tarefas_total/status). Desktop mostra barras
 * posicionadas proporcionalmente ao período do projeto; mobile cai para
 * lista cronológica (mesmos dados, só a apresentação muda via classes
 * responsivas — nenhuma requisição extra).
 */
export default function CronogramaPanel({ projetoId }: { projetoId: number }) {
	const [etapas, setEtapas] = useState<Etapa[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch(`/api/projetos/${projetoId}/etapas`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<{ etapas: Etapa[] }>;
			})
			.then((data) => {
				if (!cancelled) setEtapas(data.etapas);
			})
			.catch(() => {
				if (!cancelled) setError("Não foi possível carregar o cronograma.");
			});
		return () => {
			cancelled = true;
		};
	}, [projetoId]);

	if (error) return <p className="mt-6 text-sm text-voia-danger">{error}</p>;
	if (!etapas) return <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>;

	const comDatas = etapas.filter((e) => e.data_inicio_prevista && e.data_fim_prevista);
	if (etapas.length === 0) {
		return (
			<div className="mt-6 rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
				<p className="text-sm text-voia-neutral-500">Nenhuma etapa cadastrada ainda.</p>
			</div>
		);
	}

	const datasInicio = comDatas.map((e) => new Date(e.data_inicio_prevista!).getTime());
	const datasFim = comDatas.map((e) => new Date(e.data_fim_prevista!).getTime());
	// Fallback (nenhuma etapa com datas): só precisa de dois valores
	// distintos para a matemática de posicionamento não dividir por zero —
	// não representa "hoje", por isso não usa Date.now() (valor impuro
	// durante a renderização).
	const minData = datasInicio.length > 0 ? Math.min(...datasInicio) : 0;
	const maxData = datasFim.length > 0 ? Math.max(...datasFim) : 86400000;
	const amplitude = Math.max(maxData - minData, 86400000);

	function progressoEtapa(etapa: Etapa): number {
		if (etapa.status === "concluida") return 100;
		if (etapa.tarefas_total > 0) return Math.round((etapa.tarefas_concluidas / etapa.tarefas_total) * 100);
		return etapa.status === "em_andamento" ? 50 : 0;
	}

	return (
		<div className="mt-6 space-y-4">
			{/* Desktop/tablet: barras posicionadas pelo período do projeto. */}
			<div className="hidden overflow-x-auto rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card sm:block">
				<div className="min-w-[640px] space-y-3">
					{etapas.map((etapa) => {
						const temData = etapa.data_inicio_prevista && etapa.data_fim_prevista;
						const inicio = temData ? new Date(etapa.data_inicio_prevista!).getTime() : minData;
						const fim = temData ? new Date(etapa.data_fim_prevista!).getTime() : minData + 86400000;
						const left = ((inicio - minData) / amplitude) * 100;
						const width = Math.max(((fim - inicio) / amplitude) * 100, 2);
						const progresso = progressoEtapa(etapa);
						return (
							<div key={etapa.id} className="flex items-center gap-3">
								<div className="w-48 shrink-0 truncate text-sm font-medium text-voia-neutral-900" title={etapa.nome}>
									{etapa.nome}
								</div>
								<div className="relative h-6 flex-1 rounded-control bg-voia-beige-100">
									<div
										className={`absolute top-0 h-full rounded-control ${
											etapa.atrasada ? "bg-voia-danger/30" : "bg-voia-green-100"
										}`}
										style={{ left: `${left}%`, width: `${width}%` }}
									>
										<div
											className={`h-full rounded-control ${etapa.atrasada ? "bg-voia-danger" : "bg-voia-gold-500"}`}
											style={{ width: `${progresso}%` }}
										/>
									</div>
								</div>
								<div className="w-24 shrink-0 text-right text-xs text-voia-neutral-500">
									{temData ? formatarData(etapa.data_fim_prevista) : "sem prazo"}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Mobile: lista cronológica — mesma informação, sem barras. */}
			<div className="space-y-3 sm:hidden">
				{etapas.map((etapa) => (
					<div key={etapa.id} className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
						<div className="flex items-center justify-between gap-2">
							<span className="font-medium text-voia-neutral-900">{etapa.nome}</span>
							<span className={`rounded-control px-2 py-0.5 text-xs font-medium ${STATUS_ETAPA_BADGE[etapa.status]}`}>
								{STATUS_ETAPA_LABEL[etapa.status]}
							</span>
						</div>
						<div className="mt-1 flex items-center justify-between text-xs">
							<span className="text-voia-neutral-500">
								{formatarData(etapa.data_inicio_prevista)} → {formatarData(etapa.data_fim_prevista)}
							</span>
							{etapa.atrasada ? (
								<span className="font-medium text-voia-danger">Atrasada</span>
							) : (
								<span className="text-voia-neutral-500">{progressoEtapa(etapa)}%</span>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

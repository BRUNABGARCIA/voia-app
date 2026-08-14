import { Fragment } from "react";
import {
	STATUS_ETAPA_BADGE,
	STATUS_ETAPA_LABEL,
	STATUS_TAREFA_BADGE,
	STATUS_TAREFA_LABEL,
	formatarData,
	type Etapa,
	type Tarefa,
} from "../lib/projeto-tipos";

function situacaoEtapa(etapa: Etapa): { label: string; classe: string } {
	if (etapa.status === "concluida") return { label: "Concluída", classe: STATUS_ETAPA_BADGE.concluida };
	if (etapa.atrasada) return { label: "Atrasada", classe: "bg-voia-danger/15 text-voia-danger" };
	return { label: STATUS_ETAPA_LABEL[etapa.status], classe: STATUS_ETAPA_BADGE[etapa.status] };
}

function situacaoTarefa(tarefa: Tarefa): { label: string; classe: string } {
	if (tarefa.atrasada) return { label: "Atrasada", classe: "bg-voia-danger/15 text-voia-danger" };
	return { label: STATUS_TAREFA_LABEL[tarefa.status], classe: STATUS_TAREFA_BADGE[tarefa.status] };
}

/** Visão cronológica em tabela — período previsto de cada etapa, com as tarefas dela logo abaixo. */
export default function CronogramaView({ etapas, tarefasPorEtapa }: { etapas: Etapa[]; tarefasPorEtapa: Map<number, Tarefa[]> }) {
	if (etapas.length === 0) {
		return <p className="mt-4 text-sm text-voia-neutral-500">Nenhuma etapa cadastrada ainda.</p>;
	}

	return (
		<div className="mt-4 overflow-x-auto rounded-control border border-voia-neutral-100">
			<table className="w-full min-w-[720px] text-left text-sm">
				<thead>
					<tr className="border-b border-voia-neutral-100 bg-voia-beige-50 text-xs uppercase tracking-wide text-voia-neutral-500">
						<th className="px-3 py-2 font-medium">Etapa / Tarefa</th>
						<th className="px-3 py-2 font-medium">Período previsto</th>
						<th className="px-3 py-2 font-medium">Status</th>
						<th className="px-3 py-2 font-medium">Progresso</th>
					</tr>
				</thead>
				<tbody>
					{etapas.map((etapa, idx) => {
						const situacao = situacaoEtapa(etapa);
						const tarefas = tarefasPorEtapa.get(etapa.id) ?? [];
						const progressoEtapa = etapa.tarefas_total > 0 ? Math.round((etapa.tarefas_concluidas / etapa.tarefas_total) * 100) : null;

						return (
							<Fragment key={etapa.id}>
								<tr className="border-b border-voia-neutral-100 bg-voia-beige-50/40">
									<td className="px-3 py-2 font-medium text-voia-neutral-900">
										#{idx + 1} {etapa.nome}
									</td>
									<td className="px-3 py-2 text-voia-neutral-700">
										{formatarData(etapa.data_inicio_prevista)} — {formatarData(etapa.data_fim_prevista)}
									</td>
									<td className="px-3 py-2">
										<span className={`rounded-control px-2 py-0.5 text-xs font-medium ${situacao.classe}`}>{situacao.label}</span>
									</td>
									<td className="px-3 py-2 text-voia-neutral-700">
										{progressoEtapa !== null
											? `${progressoEtapa}% (${etapa.tarefas_concluidas}/${etapa.tarefas_total})`
											: "—"}
									</td>
								</tr>
								{tarefas.map((tarefa) => {
									const situacaoT = situacaoTarefa(tarefa);
									return (
										<tr key={`tarefa-${tarefa.id}`} className="border-b border-voia-neutral-100 last:border-b-0">
											<td className="px-3 py-2 pl-8 text-voia-neutral-700">{tarefa.nome}</td>
											<td className="px-3 py-2 text-voia-neutral-500">{formatarData(tarefa.prazo)}</td>
											<td className="px-3 py-2">
												<span className={`rounded-control px-2 py-0.5 text-xs font-medium ${situacaoT.classe}`}>{situacaoT.label}</span>
											</td>
											<td className="px-3 py-2 text-voia-neutral-500">{tarefa.responsavel_nome ?? "—"}</td>
										</tr>
									);
								})}
							</Fragment>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

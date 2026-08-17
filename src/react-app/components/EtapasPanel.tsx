import { useCallback, useEffect, useMemo, useState } from "react";
import ProgressoBar from "./ProgressoBar";
import EtapaModal from "./EtapaModal";
import TarefaModal from "./TarefaModal";
import AdicionarEstruturaModal from "./AdicionarEstruturaModal";
import CronogramaView from "./CronogramaView";
import {
	STATUS_ETAPA,
	STATUS_ETAPA_BADGE,
	STATUS_ETAPA_LABEL,
	STATUS_TAREFA,
	STATUS_TAREFA_BADGE,
	STATUS_TAREFA_LABEL,
	PRIORIDADE_BADGE,
	PRIORIDADE_LABEL,
	formatarData,
	type Etapa,
	type Tarefa,
} from "../lib/projeto-tipos";

interface EtapasResposta {
	etapas: Etapa[];
	progresso: number;
	baseadoEm: "tarefas" | "etapas";
	totalEtapas: number;
	etapasConcluidas: number;
	totalTarefas: number;
	tarefasConcluidas: number;
}

function situacaoEtapa(etapa: Etapa): { label: string; classe: string } {
	if (etapa.status === "concluida") return { label: "Concluída", classe: STATUS_ETAPA_BADGE.concluida };
	if (etapa.atrasada) return { label: "Atrasada", classe: "bg-voia-danger/15 text-voia-danger" };
	return { label: STATUS_ETAPA_LABEL[etapa.status], classe: STATUS_ETAPA_BADGE[etapa.status] };
}

function situacaoTarefa(tarefa: Tarefa): { label: string; classe: string } {
	if (tarefa.atrasada) return { label: "Atrasada", classe: "bg-voia-danger/15 text-voia-danger" };
	return { label: STATUS_TAREFA_LABEL[tarefa.status], classe: STATUS_TAREFA_BADGE[tarefa.status] };
}

export default function EtapasPanel({
	projetoId,
	podeEditar,
	podeExcluir,
	onProgressoChange,
}: {
	projetoId: number;
	podeEditar: boolean;
	podeExcluir: boolean;
	onProgressoChange: (progresso: number) => void;
}) {
	const [dados, setDados] = useState<EtapasResposta | null>(null);
	const [tarefas, setTarefas] = useState<Tarefa[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [subvisao, setSubvisao] = useState<"lista" | "cronograma">("lista");
	const [criandoEtapa, setCriandoEtapa] = useState(false);
	const [editandoEtapa, setEditandoEtapa] = useState<Etapa | null>(null);
	const [criandoTarefaEm, setCriandoTarefaEm] = useState<Etapa | null>(null);
	const [editandoTarefa, setEditandoTarefa] = useState<Tarefa | null>(null);
	const [adicionandoEstrutura, setAdicionandoEstrutura] = useState(false);
	const [temTiposDisponiveis, setTemTiposDisponiveis] = useState(false);
	// Id da etapa/tarefa com uma mudança de status em voo — desabilita só os
	// controles daquele item (evita duplo clique/corrida) sem travar o resto
	// da tela.
	const [salvandoEtapaId, setSalvandoEtapaId] = useState<number | null>(null);
	const [salvandoTarefaId, setSalvandoTarefaId] = useState<number | null>(null);

	const carregar = useCallback(() => {
		Promise.all([
			fetch(`/api/projetos/${projetoId}/etapas`, { credentials: "same-origin" }).then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar as etapas");
				return res.json() as Promise<EtapasResposta>;
			}),
			fetch(`/api/projetos/${projetoId}/tarefas`, { credentials: "same-origin" }).then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar as tarefas");
				return res.json() as Promise<{ tarefas: Tarefa[] }>;
			}),
		])
			.then(([etapasData, tarefasData]) => {
				setDados(etapasData);
				setTarefas(tarefasData.tarefas);
				onProgressoChange(etapasData.progresso);
			})
			.catch(() => setError("Não foi possível carregar as etapas."));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projetoId]);

	// Mais leve que carregar(): só re-busca as etapas (que podem ter mudado
	// de status automaticamente pelo backend) sem refazer a busca de
	// tarefas, já que quem chama isso normalmente já tem a tarefa
	// atualizada em mãos (resposta do PATCH).
	const recarregarEtapas = useCallback(() => {
		fetch(`/api/projetos/${projetoId}/etapas`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar as etapas");
				return res.json() as Promise<EtapasResposta>;
			})
			.then((etapasData) => {
				setDados(etapasData);
				onProgressoChange(etapasData.progresso);
			})
			.catch(() => setError("Não foi possível atualizar as etapas."));
	}, [projetoId, onProgressoChange]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	useEffect(() => {
		fetch(`/api/projetos/${projetoId}/tipos-servico-disponiveis`, { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ tiposServicoDisponiveis: unknown[] }>) : null))
			.then((data) => setTemTiposDisponiveis(!!data && data.tiposServicoDisponiveis.length > 0))
			.catch(() => {});
	}, [projetoId, dados]);

	const tarefasPorEtapa = useMemo(() => {
		const mapa = new Map<number, Tarefa[]>();
		for (const tarefa of tarefas) {
			const lista = mapa.get(tarefa.etapa_id) ?? [];
			lista.push(tarefa);
			mapa.set(tarefa.etapa_id, lista);
		}
		return mapa;
	}, [tarefas]);

	const etapaAtual = useMemo(() => dados?.etapas.find((e) => e.status !== "concluida") ?? null, [dados]);

	async function alterarStatusEtapa(etapa: Etapa, status: string) {
		if (!dados) return;
		setError(null);
		const etapasAntes = dados.etapas;
		// Otimista: reflete o novo status já na tela, sem esperar a rede.
		setDados({ ...dados, etapas: etapasAntes.map((e) => (e.id === etapa.id ? { ...e, status: status as Etapa["status"] } : e)) });
		setSalvandoEtapaId(etapa.id);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/etapas/${etapa.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ status }),
			});
			if (!res.ok) throw new Error("não foi possível alterar o status da etapa");
			recarregarEtapas();
		} catch (err) {
			setDados((atual) => (atual ? { ...atual, etapas: etapasAntes } : atual));
			setError(err instanceof Error ? err.message : "não foi possível alterar o status da etapa");
		} finally {
			setSalvandoEtapaId(null);
		}
	}

	async function excluirEtapa(etapa: Etapa) {
		if (!window.confirm(`Excluir a etapa "${etapa.nome}" e todas as suas tarefas?`)) return;
		setError(null);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/etapas/${etapa.id}`, {
				method: "DELETE",
				credentials: "same-origin",
			});
			if (!res.ok) throw new Error("não foi possível excluir a etapa");
			carregar();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível excluir a etapa");
		}
	}

	async function moverEtapa(etapa: Etapa, direcao: "cima" | "baixo") {
		if (!dados) return;
		const lista = dados.etapas;
		const idx = lista.findIndex((e) => e.id === etapa.id);
		const alvoIdx = direcao === "cima" ? idx - 1 : idx + 1;
		if (alvoIdx < 0 || alvoIdx >= lista.length) return;
		const alvo = lista[alvoIdx];

		setError(null);
		try {
			await Promise.all([
				fetch(`/api/projetos/${projetoId}/etapas/${etapa.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ ordem: alvo.ordem }),
				}),
				fetch(`/api/projetos/${projetoId}/etapas/${alvo.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ ordem: etapa.ordem }),
				}),
			]);
			carregar();
		} catch {
			setError("Não foi possível reordenar as etapas.");
		}
	}

	async function alterarStatusTarefa(tarefa: Tarefa, status: string) {
		setError(null);
		const tarefasAntes = tarefas;
		const concluida = status === "concluida";
		// Otimista: marca/desmarca na hora — o checkbox e o select nunca ficam
		// "esperando" a rede para refletir o clique.
		setTarefas((atual) =>
			atual.map((t) =>
				t.id === tarefa.id
					? { ...t, status: status as Tarefa["status"], data_conclusao: concluida ? new Date().toISOString().slice(0, 10) : null }
					: t,
			),
		);
		setSalvandoTarefaId(tarefa.id);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/tarefas/${tarefa.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ status }),
			});
			if (!res.ok) throw new Error("não foi possível alterar o status da tarefa");
			const { tarefa: tarefaAtualizada, progresso } = (await res.json()) as { tarefa: Tarefa; progresso: number };
			// Confirma com o dado real do servidor (ex.: "atrasada" recalculada)
			// e só então busca as etapas de novo — a etapa pode ter mudado de
			// status sozinha por causa dessa tarefa.
			setTarefas((atual) => atual.map((t) => (t.id === tarefaAtualizada.id ? tarefaAtualizada : t)));
			setDados((atual) => (atual ? { ...atual, progresso } : atual));
			onProgressoChange(progresso);
			recarregarEtapas();
		} catch (err) {
			setTarefas(tarefasAntes);
			setError(err instanceof Error ? err.message : "não foi possível alterar o status da tarefa");
		} finally {
			setSalvandoTarefaId(null);
		}
	}

	async function excluirTarefa(tarefa: Tarefa) {
		if (!window.confirm(`Excluir a tarefa "${tarefa.nome}"?`)) return;
		setError(null);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/tarefas/${tarefa.id}`, {
				method: "DELETE",
				credentials: "same-origin",
			});
			if (!res.ok) throw new Error("não foi possível excluir a tarefa");
			carregar();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível excluir a tarefa");
		}
	}

	function handleEtapaSaved() {
		setCriandoEtapa(false);
		setEditandoEtapa(null);
		carregar();
	}

	function handleTarefaSaved() {
		setCriandoTarefaEm(null);
		setEditandoTarefa(null);
		carregar();
	}

	if (error && !dados) {
		return <p className="mt-6 text-sm text-voia-danger">{error}</p>;
	}

	if (!dados) {
		return <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>;
	}

	const textoResumo =
		dados.baseadoEm === "tarefas"
			? `${dados.tarefasConcluidas} de ${dados.totalTarefas} ${dados.totalTarefas === 1 ? "tarefa concluída" : "tarefas concluídas"}`
			: `${dados.etapasConcluidas} de ${dados.totalEtapas} ${dados.totalEtapas === 1 ? "etapa concluída" : "etapas concluídas"}`;

	return (
		<div className="mt-6 space-y-6">
			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
				<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Progresso geral</span>
						<span className="font-display text-2xl font-light text-voia-green-900">{dados.progresso}%</span>
					</div>
					<div className="mt-2">
						<ProgressoBar valor={dados.progresso} />
					</div>
					<p className="mt-2 text-sm text-voia-neutral-700">{textoResumo}</p>
				</div>

				<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
					<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Etapa atual</span>
					{etapaAtual ? (
						<>
							<p className="mt-2 font-display text-lg text-voia-green-900">{etapaAtual.nome}</p>
							<div className="mt-2 flex flex-wrap items-center gap-2">
								<span className={`rounded-control px-2 py-0.5 text-xs font-medium ${situacaoEtapa(etapaAtual).classe}`}>
									{situacaoEtapa(etapaAtual).label}
								</span>
								{etapaAtual.data_fim_prevista && (
									<span className="text-xs text-voia-neutral-500">Prazo: {formatarData(etapaAtual.data_fim_prevista)}</span>
								)}
							</div>
						</>
					) : (
						<p className="mt-2 text-sm text-voia-neutral-500">Todas as etapas concluídas.</p>
					)}
				</div>
			</div>

			<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-1 rounded-control bg-voia-beige-100 p-1">
						<button
							type="button"
							onClick={() => setSubvisao("lista")}
							className={`rounded-control px-3 py-1 text-sm font-medium transition-colors ${
								subvisao === "lista" ? "bg-(--color-surface) text-voia-green-900 shadow-card" : "text-voia-neutral-700"
							}`}
						>
							Lista
						</button>
						<button
							type="button"
							onClick={() => setSubvisao("cronograma")}
							className={`rounded-control px-3 py-1 text-sm font-medium transition-colors ${
								subvisao === "cronograma" ? "bg-(--color-surface) text-voia-green-900 shadow-card" : "text-voia-neutral-700"
							}`}
						>
							Cronograma
						</button>
					</div>
					{podeEditar && (
						<div className="flex flex-wrap items-center gap-2">
							{temTiposDisponiveis && (
								<button
									type="button"
									onClick={() => setAdicionandoEstrutura(true)}
									className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
								>
									+ Adicionar estrutura de um Tipo de Serviço
								</button>
							)}
							<button
								type="button"
								onClick={() => setCriandoEtapa(true)}
								className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
							>
								+ Nova etapa
							</button>
						</div>
					)}
				</div>

				{error && <p className="mt-3 text-sm text-voia-danger">{error}</p>}

				{subvisao === "cronograma" ? (
					<CronogramaView etapas={dados.etapas} tarefasPorEtapa={tarefasPorEtapa} />
				) : dados.etapas.length === 0 ? (
					<p className="mt-4 text-sm text-voia-neutral-500">Nenhuma etapa cadastrada ainda.</p>
				) : (
					<ul className="mt-4 space-y-4">
						{dados.etapas.map((etapa, idx) => {
							const situacao = situacaoEtapa(etapa);
							const tarefasEtapa = tarefasPorEtapa.get(etapa.id) ?? [];
							const progressoEtapa = etapa.tarefas_total > 0 ? Math.round((etapa.tarefas_concluidas / etapa.tarefas_total) * 100) : null;

							return (
								<li key={etapa.id} className="rounded-control border border-voia-neutral-100 p-3">
									<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div className="flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-xs font-medium text-voia-neutral-500">#{idx + 1}</span>
												<span className="font-medium text-voia-neutral-900">{etapa.nome}</span>
												<span className={`rounded-control px-2 py-0.5 text-xs font-medium ${situacao.classe}`}>
													{situacao.label}
												</span>
												{etapa.visivel_cliente === 0 && (
													<span className="rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
														Oculta ao cliente
													</span>
												)}
												{progressoEtapa !== null && (
													<span className="text-xs text-voia-neutral-500">
														{etapa.tarefas_concluidas}/{etapa.tarefas_total} tarefas · {progressoEtapa}%
													</span>
												)}
											</div>
											{etapa.descricao && <p className="mt-1 text-sm text-voia-neutral-700">{etapa.descricao}</p>}
											<div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-voia-neutral-500">
												{etapa.data_inicio_prevista && (
													<span>Início previsto: {formatarData(etapa.data_inicio_prevista)}</span>
												)}
												{etapa.data_fim_prevista && <span>Prazo previsto: {formatarData(etapa.data_fim_prevista)}</span>}
												{etapa.data_inicio_real && <span>Início real: {formatarData(etapa.data_inicio_real)}</span>}
												{etapa.data_conclusao && <span>Concluída em: {formatarData(etapa.data_conclusao)}</span>}
											</div>
											{etapa.observacao_interna && (
												<p className="mt-2 rounded-control bg-voia-beige-100 px-2 py-1 text-xs text-voia-neutral-700">
													<span className="font-medium">Observação interna: </span>
													{etapa.observacao_interna}
												</p>
											)}
										</div>

										{podeEditar && (
											<div className={`flex shrink-0 flex-wrap items-center gap-2 ${salvandoEtapaId === etapa.id ? "opacity-60" : ""}`}>
												<select
													value={etapa.status}
													onChange={(e) => alterarStatusEtapa(etapa, e.target.value)}
													disabled={salvandoEtapaId === etapa.id}
													className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs text-voia-neutral-900 outline-none focus:border-voia-gold-500 disabled:opacity-(--opacity-disabled)"
												>
													{STATUS_ETAPA.map((s) => (
														<option key={s} value={s}>
															{STATUS_ETAPA_LABEL[s]}
														</option>
													))}
												</select>
												<div className="flex gap-1">
													<button
														type="button"
														onClick={() => moverEtapa(etapa, "cima")}
														disabled={idx === 0}
														className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs text-voia-neutral-700 hover:bg-voia-beige-100 disabled:opacity-(--opacity-disabled)"
														aria-label="Mover para cima"
													>
														↑
													</button>
													<button
														type="button"
														onClick={() => moverEtapa(etapa, "baixo")}
														disabled={idx === dados.etapas.length - 1}
														className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs text-voia-neutral-700 hover:bg-voia-beige-100 disabled:opacity-(--opacity-disabled)"
														aria-label="Mover para baixo"
													>
														↓
													</button>
												</div>
												<button
													type="button"
													onClick={() => setEditandoEtapa(etapa)}
													className="text-xs font-medium text-voia-green-800 hover:underline"
												>
													Editar
												</button>
												{podeExcluir && (
													<button
														type="button"
														onClick={() => excluirEtapa(etapa)}
														className="text-xs font-medium text-voia-danger hover:underline"
													>
														Excluir
													</button>
												)}
											</div>
										)}
									</div>

									<div className="mt-3 border-t border-voia-neutral-100 pt-3 pl-4">
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Tarefas</span>
											{podeEditar && (
												<button
													type="button"
													onClick={() => setCriandoTarefaEm(etapa)}
													className="text-xs font-medium text-voia-green-800 hover:underline"
												>
													+ Nova tarefa
												</button>
											)}
										</div>

										{tarefasEtapa.length === 0 ? (
											<p className="mt-2 text-xs text-voia-neutral-500">Nenhuma tarefa nesta etapa.</p>
										) : (
											<ul className="mt-2 space-y-2">
												{tarefasEtapa.map((tarefa) => {
													const situacaoT = situacaoTarefa(tarefa);
													return (
														<li
															key={tarefa.id}
															className="flex flex-col gap-2 rounded-control border border-voia-neutral-100 p-2 sm:flex-row sm:items-center sm:justify-between"
														>
															<div className={`flex flex-1 items-start gap-2 ${salvandoTarefaId === tarefa.id ? "opacity-60" : ""}`}>
																<input
																	type="checkbox"
																	checked={tarefa.status === "concluida"}
																	disabled={!podeEditar || salvandoTarefaId === tarefa.id}
																	onChange={(e) => alterarStatusTarefa(tarefa, e.target.checked ? "concluida" : "pendente")}
																	className="mt-0.5 h-4 w-4 rounded border-voia-neutral-100 text-voia-gold-500 focus:ring-voia-gold-500 disabled:opacity-(--opacity-disabled)"
																	aria-label={`Marcar "${tarefa.nome}" como concluída`}
																/>
																<div className="flex-1">
																	<div className="flex flex-wrap items-center gap-2">
																		<span
																			className={`text-sm font-medium ${tarefa.status === "concluida" ? "text-voia-neutral-500 line-through" : "text-voia-neutral-900"}`}
																		>
																			{tarefa.nome}
																		</span>
																		<span className={`rounded-control px-2 py-0.5 text-xs font-medium ${situacaoT.classe}`}>
																			{situacaoT.label}
																		</span>
																		<span
																			className={`rounded-control px-2 py-0.5 text-xs font-medium ${PRIORIDADE_BADGE[tarefa.prioridade]}`}
																		>
																			{PRIORIDADE_LABEL[tarefa.prioridade]}
																		</span>
																		{tarefa.visivel_cliente === 0 && (
																			<span className="rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
																				Oculta ao cliente
																			</span>
																		)}
																	</div>
																	<div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-voia-neutral-500">
																		{tarefa.responsavel_nome && <span>{tarefa.responsavel_nome}</span>}
																		{tarefa.prazo && <span>Prazo: {formatarData(tarefa.prazo)}</span>}
																	</div>
																</div>
															</div>

															{podeEditar && (
																<div className="flex shrink-0 items-center gap-2">
																	<select
																		value={tarefa.status}
																		onChange={(e) => alterarStatusTarefa(tarefa, e.target.value)}
																		disabled={salvandoTarefaId === tarefa.id}
																		className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs text-voia-neutral-900 outline-none focus:border-voia-gold-500 disabled:opacity-(--opacity-disabled)"
																	>
																		{STATUS_TAREFA.map((s) => (
																			<option key={s} value={s}>
																				{STATUS_TAREFA_LABEL[s]}
																			</option>
																		))}
																	</select>
																	<button
																		type="button"
																		onClick={() => setEditandoTarefa(tarefa)}
																		className="text-xs font-medium text-voia-green-800 hover:underline"
																	>
																		Editar
																	</button>
																	{podeExcluir && (
																		<button
																			type="button"
																			onClick={() => excluirTarefa(tarefa)}
																			className="text-xs font-medium text-voia-danger hover:underline"
																		>
																			Excluir
																		</button>
																	)}
																</div>
															)}
														</li>
													);
												})}
											</ul>
										)}
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			{criandoEtapa && <EtapaModal projetoId={projetoId} etapa={null} onClose={() => setCriandoEtapa(false)} onSaved={handleEtapaSaved} />}
			{editandoEtapa && (
				<EtapaModal projetoId={projetoId} etapa={editandoEtapa} onClose={() => setEditandoEtapa(null)} onSaved={handleEtapaSaved} />
			)}
			{criandoTarefaEm && (
				<TarefaModal
					projetoId={projetoId}
					etapaId={criandoTarefaEm.id}
					tarefa={null}
					onClose={() => setCriandoTarefaEm(null)}
					onSaved={handleTarefaSaved}
				/>
			)}
			{editandoTarefa && (
				<TarefaModal
					projetoId={projetoId}
					etapaId={editandoTarefa.etapa_id}
					tarefa={editandoTarefa}
					onClose={() => setEditandoTarefa(null)}
					onSaved={handleTarefaSaved}
				/>
			)}
			{adicionandoEstrutura && (
				<AdicionarEstruturaModal
					projetoId={projetoId}
					onClose={() => setAdicionandoEstrutura(false)}
					onSaved={() => {
						setAdicionandoEstrutura(false);
						carregar();
					}}
				/>
			)}
		</div>
	);
}

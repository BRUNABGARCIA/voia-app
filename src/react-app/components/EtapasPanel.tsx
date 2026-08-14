import { useCallback, useEffect, useMemo, useState } from "react";
import ProgressoBar from "./ProgressoBar";
import EtapaModal from "./EtapaModal";
import {
	STATUS_ETAPA,
	STATUS_ETAPA_BADGE,
	STATUS_ETAPA_LABEL,
	formatarData,
	type Etapa,
} from "../lib/projeto-tipos";

interface EtapasResposta {
	etapas: Etapa[];
	progresso: number;
	totalEtapas: number;
	etapasConcluidas: number;
}

function situacaoEtapa(etapa: Etapa): { label: string; classe: string } {
	if (etapa.status === "concluida") return { label: "Concluída", classe: STATUS_ETAPA_BADGE.concluida };
	if (etapa.atrasada) return { label: "Atrasada", classe: "bg-voia-danger/15 text-voia-danger" };
	return { label: STATUS_ETAPA_LABEL[etapa.status], classe: STATUS_ETAPA_BADGE[etapa.status] };
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
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);
	const [editando, setEditando] = useState<Etapa | null>(null);

	const carregar = useCallback(() => {
		fetch(`/api/projetos/${projetoId}/etapas`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar as etapas");
				return res.json() as Promise<EtapasResposta>;
			})
			.then((data) => {
				setDados(data);
				onProgressoChange(data.progresso);
			})
			.catch(() => setError("Não foi possível carregar as etapas."));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projetoId]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	const etapaAtual = useMemo(() => dados?.etapas.find((e) => e.status !== "concluida") ?? null, [dados]);

	async function alterarStatus(etapa: Etapa, status: string) {
		setError(null);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/etapas/${etapa.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ status }),
			});
			if (!res.ok) throw new Error("não foi possível alterar o status");
			carregar();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível alterar o status");
		}
	}

	async function excluir(etapa: Etapa) {
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

	async function mover(etapa: Etapa, direcao: "cima" | "baixo") {
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

	function handleSaved() {
		setCriando(false);
		setEditando(null);
		carregar();
	}

	if (error && !dados) {
		return <p className="mt-6 text-sm text-voia-danger">{error}</p>;
	}

	if (!dados) {
		return <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>;
	}

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
					<p className="mt-2 text-sm text-voia-neutral-700">
						{dados.etapasConcluidas} de {dados.totalEtapas}{" "}
						{dados.totalEtapas === 1 ? "etapa concluída" : "etapas concluídas"}
					</p>
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
				<div className="flex items-center justify-between">
					<h2 className="font-display text-lg text-voia-green-900">Etapas</h2>
					{podeEditar && (
						<button
							type="button"
							onClick={() => setCriando(true)}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
						>
							+ Nova etapa
						</button>
					)}
				</div>

				{error && <p className="mt-3 text-sm text-voia-danger">{error}</p>}

				{dados.etapas.length === 0 ? (
					<p className="mt-4 text-sm text-voia-neutral-500">Nenhuma etapa cadastrada ainda.</p>
				) : (
					<ul className="mt-4 space-y-3">
						{dados.etapas.map((etapa, idx) => {
							const situacao = situacaoEtapa(etapa);
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
											<div className="flex shrink-0 flex-wrap items-center gap-2">
												<select
													value={etapa.status}
													onChange={(e) => alterarStatus(etapa, e.target.value)}
													className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs text-voia-neutral-900 outline-none focus:border-voia-gold-500"
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
														onClick={() => mover(etapa, "cima")}
														disabled={idx === 0}
														className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs text-voia-neutral-700 hover:bg-voia-beige-100 disabled:opacity-(--opacity-disabled)"
														aria-label="Mover para cima"
													>
														↑
													</button>
													<button
														type="button"
														onClick={() => mover(etapa, "baixo")}
														disabled={idx === dados.etapas.length - 1}
														className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs text-voia-neutral-700 hover:bg-voia-beige-100 disabled:opacity-(--opacity-disabled)"
														aria-label="Mover para baixo"
													>
														↓
													</button>
												</div>
												<button
													type="button"
													onClick={() => setEditando(etapa)}
													className="text-xs font-medium text-voia-green-800 hover:underline"
												>
													Editar
												</button>
												{podeExcluir && (
													<button
														type="button"
														onClick={() => excluir(etapa)}
														className="text-xs font-medium text-voia-danger hover:underline"
													>
														Excluir
													</button>
												)}
											</div>
										)}
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			{criando && <EtapaModal projetoId={projetoId} etapa={null} onClose={() => setCriando(false)} onSaved={handleSaved} />}
			{editando && (
				<EtapaModal projetoId={projetoId} etapa={editando} onClose={() => setEditando(null)} onSaved={handleSaved} />
			)}
		</div>
	);
}

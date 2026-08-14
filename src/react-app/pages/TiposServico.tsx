import { useCallback, useEffect, useState } from "react";
import EtapaModeloModal from "../components/EtapaModeloModal";
import type { EtapaModelo, TipoServicoAdmin } from "../lib/tipos-servico-tipos";

export default function TiposServico() {
	const [tipos, setTipos] = useState<TipoServicoAdmin[]>([]);
	const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
	const [modelo, setModelo] = useState<EtapaModelo[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);
	const [editando, setEditando] = useState<EtapaModelo | null>(null);

	const carregarTipos = useCallback(() => {
		fetch("/api/tipos-servico", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ tiposServico: TipoServicoAdmin[] }>) : null))
			.then((data) => {
				if (!data) return;
				setTipos(data.tiposServico);
				setSelecionadoId((atual) => atual ?? data.tiposServico[0]?.id ?? null);
			})
			.catch(() => setError("Não foi possível carregar os tipos de serviço."));
	}, []);

	const carregarModelo = useCallback(() => {
		if (selecionadoId === null) return;
		fetch(`/api/tipos-servico/${selecionadoId}/modelo`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar o modelo");
				return res.json() as Promise<{ etapasModelo: EtapaModelo[] }>;
			})
			.then((data) => setModelo(data.etapasModelo))
			.catch(() => setError("Não foi possível carregar o modelo deste tipo de serviço."));
	}, [selecionadoId]);

	useEffect(() => {
		carregarTipos();
	}, [carregarTipos]);

	useEffect(() => {
		setModelo(null);
		carregarModelo();
	}, [carregarModelo]);

	async function excluir(etapa: EtapaModelo) {
		if (selecionadoId === null) return;
		setError(null);
		try {
			const res = await fetch(`/api/tipos-servico/${selecionadoId}/modelo/${etapa.id}`, {
				method: "DELETE",
				credentials: "same-origin",
			});
			if (!res.ok) throw new Error("não foi possível excluir a etapa");
			carregarModelo();
			carregarTipos();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível excluir a etapa");
		}
	}

	async function mover(etapa: EtapaModelo, direcao: "cima" | "baixo") {
		if (!modelo || selecionadoId === null) return;
		const idx = modelo.findIndex((e) => e.id === etapa.id);
		const alvoIdx = direcao === "cima" ? idx - 1 : idx + 1;
		if (alvoIdx < 0 || alvoIdx >= modelo.length) return;
		const alvo = modelo[alvoIdx];

		setError(null);
		try {
			await Promise.all([
				fetch(`/api/tipos-servico/${selecionadoId}/modelo/${etapa.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ ordem: alvo.ordem }),
				}),
				fetch(`/api/tipos-servico/${selecionadoId}/modelo/${alvo.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ ordem: etapa.ordem }),
				}),
			]);
			carregarModelo();
		} catch {
			setError("Não foi possível reordenar as etapas.");
		}
	}

	function handleSaved() {
		setCriando(false);
		setEditando(null);
		carregarModelo();
		carregarTipos();
	}

	const tipoSelecionado = tipos.find((t) => t.id === selecionadoId) ?? null;

	return (
		<div>
			<h1 className="font-display text-2xl font-light text-voia-neutral-900">Tipos de Serviço</h1>
			<p className="mt-1 text-sm text-voia-neutral-700">
				Configure o modelo padrão de processo de cada tipo de serviço. Ao criar um projeto, as etapas são copiadas
				automaticamente do modelo — alterações aqui não afetam projetos já criados.
			</p>

			{error && <p className="mt-4 text-sm text-voia-danger">{error}</p>}

			<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
				<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-2 shadow-card lg:h-fit">
					<ul className="flex flex-col gap-1">
						{tipos.map((tipo) => (
							<li key={tipo.id}>
								<button
									type="button"
									onClick={() => setSelecionadoId(tipo.id)}
									className={`flex w-full items-center justify-between rounded-control px-3 py-2 text-left text-sm font-medium transition-colors ${
										tipo.id === selecionadoId
											? "bg-voia-gold-500 text-voia-green-950"
											: "text-voia-neutral-700 hover:bg-voia-beige-100"
									}`}
								>
									<span>{tipo.nome}</span>
									<span className="text-xs opacity-70">{tipo.total_etapas_modelo}</span>
								</button>
							</li>
						))}
					</ul>
				</div>

				<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
					{!tipoSelecionado ? (
						<p className="text-sm text-voia-neutral-500">Selecione um tipo de serviço.</p>
					) : (
						<>
							<div className="flex items-center justify-between">
								<h2 className="font-display text-lg text-voia-green-900">Modelo de processo — {tipoSelecionado.nome}</h2>
								<button
									type="button"
									onClick={() => setCriando(true)}
									className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
								>
									+ Nova etapa padrão
								</button>
							</div>

							{modelo === null ? (
								<p className="mt-4 text-sm text-voia-neutral-500">Carregando…</p>
							) : modelo.length === 0 ? (
								<p className="mt-4 text-sm text-voia-neutral-500">
									Nenhuma etapa padrão configurada ainda para este tipo de serviço.
								</p>
							) : (
								<ul className="mt-4 space-y-3">
									{modelo.map((etapa, idx) => (
										<li key={etapa.id} className="rounded-control border border-voia-neutral-100 p-3">
											<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
												<div className="flex-1">
													<div className="flex flex-wrap items-center gap-2">
														<span className="text-xs font-medium text-voia-neutral-500">#{idx + 1}</span>
														<span className="font-medium text-voia-neutral-900">{etapa.nome}</span>
														{etapa.prazo_dias != null && (
															<span className="rounded-control bg-voia-beige-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-700">
																{etapa.prazo_dias} {etapa.prazo_dias === 1 ? "dia" : "dias"}
															</span>
														)}
														{etapa.visivel_cliente === 0 && (
															<span className="rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
																Oculta ao cliente
															</span>
														)}
														{etapa.notificar_cliente === 1 && (
															<span className="rounded-control bg-voia-info/15 px-2 py-0.5 text-xs font-medium text-voia-info">
																Notifica cliente
															</span>
														)}
													</div>
													{etapa.descricao && <p className="mt-1 text-sm text-voia-neutral-700">{etapa.descricao}</p>}
												</div>

												<div className="flex shrink-0 flex-wrap items-center gap-2">
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
															disabled={idx === modelo.length - 1}
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
													<button
														type="button"
														onClick={() => excluir(etapa)}
														className="text-xs font-medium text-voia-danger hover:underline"
													>
														Excluir
													</button>
												</div>
											</div>
										</li>
									))}
								</ul>
							)}
						</>
					)}
				</div>
			</div>

			{criando && selecionadoId !== null && (
				<EtapaModeloModal tipoServicoId={selecionadoId} modelo={null} onClose={() => setCriando(false)} onSaved={handleSaved} />
			)}
			{editando && selecionadoId !== null && (
				<EtapaModeloModal
					tipoServicoId={selecionadoId}
					modelo={editando}
					onClose={() => setEditando(null)}
					onSaved={handleSaved}
				/>
			)}
		</div>
	);
}

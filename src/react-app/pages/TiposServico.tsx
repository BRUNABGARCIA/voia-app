import { useCallback, useEffect, useState } from "react";
import EtapaModeloModal from "../components/EtapaModeloModal";
import TarefaModeloModal from "../components/TarefaModeloModal";
import ConfirmModal from "../components/ConfirmModal";
import { PRIORIDADE_LABEL } from "../lib/projeto-tipos";
import type { EtapaModelo, TarefaModelo, TipoServicoAdmin } from "../lib/tipos-servico-tipos";

export default function TiposServico() {
	const [tipos, setTipos] = useState<TipoServicoAdmin[]>([]);
	const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
	const [modelo, setModelo] = useState<EtapaModelo[] | null>(null);
	// Id do tipo de serviço cujo modelo está em "modelo" no momento — quando
	// diverge de selecionadoId, o tipo mudou e o modelo antigo é limpo
	// durante a própria renderização (padrão recomendado pelo React para
	// resetar estado quando uma seleção muda, em vez de dentro de um
	// efeito: evita setState síncrono dentro de useEffect).
	const [modeloDeId, setModeloDeId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [criandoEtapa, setCriandoEtapa] = useState(false);
	const [editandoEtapa, setEditandoEtapa] = useState<EtapaModelo | null>(null);
	const [criandoTarefaEm, setCriandoTarefaEm] = useState<EtapaModelo | null>(null);
	const [editandoTarefa, setEditandoTarefa] = useState<{ etapa: EtapaModelo; tarefa: TarefaModelo } | null>(null);
	const [excluindoEtapa, setExcluindoEtapa] = useState<EtapaModelo | null>(null);
	const [excluindoTarefa, setExcluindoTarefa] = useState<{ etapa: EtapaModelo; tarefa: TarefaModelo } | null>(null);

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

	if (selecionadoId !== modeloDeId) {
		setModeloDeId(selecionadoId);
		setModelo(null);
	}

	useEffect(() => {
		carregarTipos();
	}, [carregarTipos]);

	useEffect(() => {
		carregarModelo();
	}, [carregarModelo]);

	async function excluirEtapa(etapa: EtapaModelo) {
		if (selecionadoId === null) return;
		const res = await fetch(`/api/tipos-servico/${selecionadoId}/modelo/${etapa.id}`, {
			method: "DELETE",
			credentials: "same-origin",
		});
		if (!res.ok) throw new Error("não foi possível excluir a etapa");
		carregarModelo();
		carregarTipos();
	}

	async function moverEtapa(etapa: EtapaModelo, direcao: "cima" | "baixo") {
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

	async function excluirTarefa(etapa: EtapaModelo, tarefa: TarefaModelo) {
		if (selecionadoId === null) return;
		const res = await fetch(`/api/tipos-servico/${selecionadoId}/modelo/${etapa.id}/tarefas/${tarefa.id}`, {
			method: "DELETE",
			credentials: "same-origin",
		});
		if (!res.ok) throw new Error("não foi possível excluir a tarefa");
		carregarModelo();
	}

	async function moverTarefa(etapa: EtapaModelo, tarefa: TarefaModelo, direcao: "cima" | "baixo") {
		if (selecionadoId === null) return;
		const idx = etapa.tarefas.findIndex((t) => t.id === tarefa.id);
		const alvoIdx = direcao === "cima" ? idx - 1 : idx + 1;
		if (alvoIdx < 0 || alvoIdx >= etapa.tarefas.length) return;
		const alvo = etapa.tarefas[alvoIdx];

		setError(null);
		try {
			await Promise.all([
				fetch(`/api/tipos-servico/${selecionadoId}/modelo/${etapa.id}/tarefas/${tarefa.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ ordem: alvo.ordem }),
				}),
				fetch(`/api/tipos-servico/${selecionadoId}/modelo/${etapa.id}/tarefas/${alvo.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ ordem: tarefa.ordem }),
				}),
			]);
			carregarModelo();
		} catch {
			setError("Não foi possível reordenar as tarefas.");
		}
	}

	function handleEtapaSaved() {
		setCriandoEtapa(false);
		setEditandoEtapa(null);
		carregarModelo();
		carregarTipos();
	}

	function handleTarefaSaved() {
		setCriandoTarefaEm(null);
		setEditandoTarefa(null);
		carregarModelo();
	}

	const tipoSelecionado = tipos.find((t) => t.id === selecionadoId) ?? null;

	return (
		<div>
			<h1 className="font-display text-2xl font-light text-voia-neutral-900">Tipos de Serviço</h1>
			<p className="mt-1 text-sm text-voia-neutral-700">
				Configure o modelo padrão de processo de cada tipo de serviço — etapas e as tarefas de cada etapa. Ao criar um
				projeto, essa estrutura é copiada automaticamente; alterações aqui não afetam projetos já criados.
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
									onClick={() => setCriandoEtapa(true)}
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
								<ul className="mt-4 space-y-4">
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
														{etapa.ativa === 0 && (
															<span className="rounded-control bg-voia-danger/15 px-2 py-0.5 text-xs font-medium text-voia-danger">
																Inativa
															</span>
														)}
													</div>
													{etapa.descricao && <p className="mt-1 text-sm text-voia-neutral-700">{etapa.descricao}</p>}
												</div>

												<div className="flex shrink-0 flex-wrap items-center gap-2">
													<div className="flex gap-1">
														<button
															type="button"
															onClick={() => moverEtapa(etapa, "cima")}
															disabled={idx === 0}
															className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs text-voia-neutral-700 hover:bg-voia-beige-100 disabled:opacity-(--opacity-disabled)"
															aria-label="Mover etapa para cima"
														>
															↑
														</button>
														<button
															type="button"
															onClick={() => moverEtapa(etapa, "baixo")}
															disabled={idx === modelo.length - 1}
															className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs text-voia-neutral-700 hover:bg-voia-beige-100 disabled:opacity-(--opacity-disabled)"
															aria-label="Mover etapa para baixo"
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
													<button
														type="button"
														onClick={() => setExcluindoEtapa(etapa)}
														className="text-xs font-medium text-voia-danger hover:underline"
													>
														Excluir
													</button>
												</div>
											</div>

											<div className="mt-3 border-t border-voia-neutral-100 pt-3 pl-4">
												<div className="flex items-center justify-between">
													<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
														Tarefas ({etapa.tarefas.length})
													</span>
													<button
														type="button"
														onClick={() => setCriandoTarefaEm(etapa)}
														className="text-xs font-medium text-voia-green-800 hover:underline"
													>
														+ Nova tarefa
													</button>
												</div>

												{etapa.tarefas.length === 0 ? (
													<p className="mt-2 text-xs text-voia-neutral-500">Nenhuma tarefa padrão nesta etapa.</p>
												) : (
													<ul className="mt-2 space-y-2">
														{etapa.tarefas.map((tarefa, tarefaIdx) => (
															<li
																key={tarefa.id}
																className="flex flex-col gap-2 rounded-control border border-voia-neutral-100 p-2 sm:flex-row sm:items-center sm:justify-between"
															>
																<div className="flex flex-wrap items-center gap-2 text-sm">
																	<span className="font-medium text-voia-neutral-900">{tarefa.nome}</span>
																	<span className="rounded-control bg-voia-beige-100 px-2 py-0.5 text-xs text-voia-neutral-700">
																		{PRIORIDADE_LABEL[tarefa.prioridade_padrao]}
																	</span>
																	{tarefa.prazo_dias != null && (
																		<span className="text-xs text-voia-neutral-500">{tarefa.prazo_dias}d</span>
																	)}
																	{tarefa.responsavel_padrao_nome && (
																		<span className="text-xs text-voia-neutral-500">{tarefa.responsavel_padrao_nome}</span>
																	)}
																	{tarefa.visivel_cliente === 0 && (
																		<span className="rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
																			Oculta
																		</span>
																	)}
																	{tarefa.ativa === 0 && (
																		<span className="rounded-control bg-voia-danger/15 px-2 py-0.5 text-xs font-medium text-voia-danger">
																			Inativa
																		</span>
																	)}
																</div>
																<div className="flex shrink-0 items-center gap-2">
																	<div className="flex gap-1">
																		<button
																			type="button"
																			onClick={() => moverTarefa(etapa, tarefa, "cima")}
																			disabled={tarefaIdx === 0}
																			className="rounded-control border border-voia-neutral-100 px-1.5 py-0.5 text-xs text-voia-neutral-700 hover:bg-voia-beige-100 disabled:opacity-(--opacity-disabled)"
																			aria-label="Mover tarefa para cima"
																		>
																			↑
																		</button>
																		<button
																			type="button"
																			onClick={() => moverTarefa(etapa, tarefa, "baixo")}
																			disabled={tarefaIdx === etapa.tarefas.length - 1}
																			className="rounded-control border border-voia-neutral-100 px-1.5 py-0.5 text-xs text-voia-neutral-700 hover:bg-voia-beige-100 disabled:opacity-(--opacity-disabled)"
																			aria-label="Mover tarefa para baixo"
																		>
																			↓
																		</button>
																	</div>
																	<button
																		type="button"
																		onClick={() => setEditandoTarefa({ etapa, tarefa })}
																		className="text-xs font-medium text-voia-green-800 hover:underline"
																	>
																		Editar
																	</button>
																	<button
																		type="button"
																		onClick={() => setExcluindoTarefa({ etapa, tarefa })}
																		className="text-xs font-medium text-voia-danger hover:underline"
																	>
																		Excluir
																	</button>
																</div>
															</li>
														))}
													</ul>
												)}
											</div>
										</li>
									))}
								</ul>
							)}
						</>
					)}
				</div>
			</div>

			{criandoEtapa && selecionadoId !== null && (
				<EtapaModeloModal tipoServicoId={selecionadoId} modelo={null} onClose={() => setCriandoEtapa(false)} onSaved={handleEtapaSaved} />
			)}
			{editandoEtapa && selecionadoId !== null && (
				<EtapaModeloModal
					tipoServicoId={selecionadoId}
					modelo={editandoEtapa}
					onClose={() => setEditandoEtapa(null)}
					onSaved={handleEtapaSaved}
				/>
			)}
			{criandoTarefaEm && selecionadoId !== null && (
				<TarefaModeloModal
					tipoServicoId={selecionadoId}
					etapaModeloId={criandoTarefaEm.id}
					tarefa={null}
					onClose={() => setCriandoTarefaEm(null)}
					onSaved={handleTarefaSaved}
				/>
			)}
			{editandoTarefa && selecionadoId !== null && (
				<TarefaModeloModal
					tipoServicoId={selecionadoId}
					etapaModeloId={editandoTarefa.etapa.id}
					tarefa={editandoTarefa.tarefa}
					onClose={() => setEditandoTarefa(null)}
					onSaved={handleTarefaSaved}
				/>
			)}

			{excluindoEtapa && (
				<ConfirmModal
					title="Excluir etapa padrão"
					message={`Excluir a etapa padrão "${excluindoEtapa.nome}"${
						excluindoEtapa.tarefas.length > 0
							? ` e suas ${excluindoEtapa.tarefas.length} ${excluindoEtapa.tarefas.length === 1 ? "tarefa padrão" : "tarefas padrão"}`
							: ""
					}? Isso não afeta projetos já criados — só o modelo usado em novos projetos.`}
					confirmLabel="Excluir"
					onClose={() => setExcluindoEtapa(null)}
					onConfirm={() => excluirEtapa(excluindoEtapa)}
				/>
			)}
			{excluindoTarefa && (
				<ConfirmModal
					title="Excluir tarefa padrão"
					message={`Excluir a tarefa padrão "${excluindoTarefa.tarefa.nome}" da etapa "${excluindoTarefa.etapa.nome}"? Isso não afeta projetos já criados — só o modelo usado em novos projetos.`}
					confirmLabel="Excluir"
					onClose={() => setExcluindoTarefa(null)}
					onConfirm={() => excluirTarefa(excluindoTarefa.etapa, excluindoTarefa.tarefa)}
				/>
			)}
		</div>
	);
}

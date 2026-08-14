import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router";
import ProgressoBar from "../components/ProgressoBar";
import { STATUS_PROCESSO_LABEL, formatarDataPortal, type ProcessoResumoPortal } from "../lib/portal-tipos";

export default function MeusProcessos() {
	const [processos, setProcessos] = useState<ProcessoResumoPortal[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/portal/processos", { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar seus processos");
				return res.json() as Promise<{ processos: ProcessoResumoPortal[] }>;
			})
			.then((data) => setProcessos(data.processos))
			.catch(() => setError("Não foi possível carregar seus processos."));
	}, []);

	if (error) {
		return <p className="text-sm text-voia-danger">{error}</p>;
	}

	if (!processos) {
		return <p className="text-sm text-voia-neutral-500">Carregando…</p>;
	}

	// Com exatamente um processo autorizado, o acesso direto é mais
	// conveniente do que forçar uma tela de seleção com um único card.
	if (processos.length === 1) {
		return <Navigate to={`/portal/processos/${processos[0].id}`} replace />;
	}

	return (
		<div>
			<h1 className="font-display text-2xl font-light text-voia-neutral-900">Meus Processos</h1>
			<p className="mt-1 text-sm text-voia-neutral-700">Selecione um processo para acompanhar o andamento.</p>

			{processos.length === 0 ? (
				<p className="mt-6 text-sm text-voia-neutral-500">
					Nenhum processo autorizado para o seu acesso ainda. Fale com a VOIA para mais informações.
				</p>
			) : (
				<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
					{processos.map((processo) => (
						<Link
							key={processo.id}
							to={`/portal/processos/${processo.id}`}
							className="flex flex-col gap-3 rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card transition-colors hover:border-voia-gold-500"
						>
							<div>
								<div className="flex items-center justify-between gap-2">
									<span className="font-display text-lg text-voia-green-900">{processo.nome}</span>
									{processo.codigo && <span className="text-xs text-voia-neutral-500">{processo.codigo}</span>}
								</div>
								<p className="mt-1 text-xs uppercase tracking-wide text-voia-neutral-500">
									{STATUS_PROCESSO_LABEL[processo.status] ?? processo.status}
								</p>
							</div>

							{processo.tiposServico.length > 0 && (
								<div className="flex flex-wrap gap-1.5">
									{processo.tiposServico.map((tipo) => (
										<span
											key={tipo.id}
											className="rounded-control bg-voia-beige-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-700"
										>
											{tipo.nome}
										</span>
									))}
								</div>
							)}

							<div>
								<div className="flex items-center justify-between text-xs text-voia-neutral-500">
									<span>Progresso</span>
									<span className="font-medium text-voia-neutral-900">{processo.progresso}%</span>
								</div>
								<div className="mt-1">
									<ProgressoBar valor={processo.progresso} compacta />
								</div>
							</div>

							{processo.etapaAtual && (
								<p className="text-sm text-voia-neutral-700">
									Etapa atual: <span className="font-medium">{processo.etapaAtual.nome}</span>
									{processo.etapaAtual.atrasada && (
										<span className="ml-2 rounded-control bg-voia-danger/15 px-2 py-0.5 text-xs font-medium text-voia-danger">
											Atrasada
										</span>
									)}
								</p>
							)}
							{processo.proximoPrazo && (
								<p className="text-xs text-voia-neutral-500">Próximo prazo: {formatarDataPortal(processo.proximoPrazo)}</p>
							)}

							<span className="mt-1 text-sm font-medium text-voia-green-800">Acompanhar processo →</span>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}

import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import ProgressoBar from "../components/ProgressoBar";
import { STATUS_PROCESSO_LABEL, formatarDataPortal, type ProcessoDetalhePortal } from "../lib/portal-tipos";

function formatarDataHora(valor: string): string {
	const data = new Date(valor.replace(" ", "T") + "Z");
	if (Number.isNaN(data.getTime())) return valor;
	return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PortalProcesso() {
	const { id } = useParams<{ id: string }>();
	// key={id} garante que trocar de processo remonte o componente (estado
	// volta ao inicial sozinho) em vez de precisar resetar manualmente
	// dentro de um efeito.
	return <PortalProcessoConteudo key={id} id={id} />;
}

function PortalProcessoConteudo({ id }: { id: string | undefined }) {
	const [dados, setDados] = useState<ProcessoDetalhePortal | null>(null);
	const [naoAutorizado, setNaoAutorizado] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch(`/api/portal/processos/${id}`, { credentials: "same-origin" })
			.then((res) => {
				if (res.status === 404) {
					setNaoAutorizado(true);
					return null;
				}
				if (!res.ok) throw new Error("não foi possível carregar o processo");
				return res.json() as Promise<ProcessoDetalhePortal>;
			})
			.then((data) => data && setDados(data))
			.catch(() => setError("Não foi possível carregar este processo."));
	}, [id]);

	if (naoAutorizado) {
		return <Navigate to="/portal" replace />;
	}

	if (error) {
		return <p className="text-sm text-voia-danger">{error}</p>;
	}

	if (!dados) {
		return <p className="text-sm text-voia-neutral-500">Carregando…</p>;
	}

	const { processo, etapaAtual, proximaEtapa, etapas, atualizacoes } = dados;

	return (
		<div>
			<Link to="/portal" className="text-sm font-medium text-voia-neutral-500 hover:text-voia-neutral-900">
				← Meus Processos
			</Link>

			<div className="mt-2">
				<h1 className="font-display text-2xl font-light text-voia-neutral-900">
					{processo.codigo && <span className="text-voia-neutral-500">{processo.codigo} · </span>}
					{processo.nome}
				</h1>
				<div className="mt-2 flex flex-wrap items-center gap-2">
					<span className="rounded-control bg-voia-info/15 px-2 py-1 text-xs font-medium text-voia-info">
						{STATUS_PROCESSO_LABEL[processo.status] ?? processo.status}
					</span>
					{processo.tiposServico.map((tipo) => (
						<span key={tipo.id} className="rounded-control bg-voia-beige-100 px-2 py-1 text-xs font-medium text-voia-neutral-700">
							{tipo.nome}
						</span>
					))}
				</div>
			</div>

			<div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
				<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card sm:col-span-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Progresso</span>
						<span className="font-display text-2xl font-light text-voia-green-900">{processo.progresso}%</span>
					</div>
					<div className="mt-2">
						<ProgressoBar valor={processo.progresso} />
					</div>
					<p className="mt-2 text-sm text-voia-neutral-700">
						{processo.etapasConcluidas} de {processo.totalEtapas}{" "}
						{processo.totalEtapas === 1 ? "etapa concluída" : "etapas concluídas"}
					</p>
				</div>

				<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
					<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Etapa atual</span>
					{etapaAtual ? (
						<>
							<p className="mt-2 font-display text-lg text-voia-green-900">{etapaAtual.nome}</p>
							<div className="mt-2 flex flex-wrap items-center gap-2">
								{etapaAtual.atrasada ? (
									<span className="rounded-control bg-voia-danger/15 px-2 py-0.5 text-xs font-medium text-voia-danger">
										Atrasada
									</span>
								) : (
									<span className="rounded-control bg-voia-info/15 px-2 py-0.5 text-xs font-medium text-voia-info">Em andamento</span>
								)}
								{etapaAtual.dataFimPrevista && (
									<span className="text-xs text-voia-neutral-500">Prazo: {formatarDataPortal(etapaAtual.dataFimPrevista)}</span>
								)}
							</div>
						</>
					) : (
						<p className="mt-2 text-sm text-voia-neutral-500">Todas as etapas concluídas.</p>
					)}
				</div>

				<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
					<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Próxima etapa</span>
					{proximaEtapa ? (
						<>
							<p className="mt-2 font-display text-lg text-voia-green-900">{proximaEtapa.nome}</p>
							{proximaEtapa.dataInicioPrevista && (
								<p className="mt-2 text-xs text-voia-neutral-500">Previsão: {formatarDataPortal(proximaEtapa.dataInicioPrevista)}</p>
							)}
						</>
					) : (
						<p className="mt-2 text-sm text-voia-neutral-500">Nenhuma etapa seguinte no momento.</p>
					)}
				</div>
			</div>

			<div className="mt-6 rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
				<h2 className="font-display text-lg text-voia-green-900">Etapas</h2>
				{etapas.length === 0 ? (
					<p className="mt-3 text-sm text-voia-neutral-500">Nenhuma etapa publicada ainda.</p>
				) : (
					<ul className="mt-4 space-y-3">
						{etapas.map((etapa, idx) => (
							<li key={etapa.id} className="rounded-control border border-voia-neutral-100 p-3">
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-xs font-medium text-voia-neutral-500">#{idx + 1}</span>
									<span className="font-medium text-voia-neutral-900">{etapa.nome}</span>
									{etapa.status === "concluida" ? (
										<span className="rounded-control bg-voia-success/15 px-2 py-0.5 text-xs font-medium text-voia-success">
											Concluída
										</span>
									) : etapa.atrasada ? (
										<span className="rounded-control bg-voia-danger/15 px-2 py-0.5 text-xs font-medium text-voia-danger">Atrasada</span>
									) : (
										<span className="rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
											{etapa.status === "em_andamento" ? "Em andamento" : "Pendente"}
										</span>
									)}
								</div>
								{etapa.descricao && <p className="mt-1 text-sm text-voia-neutral-700">{etapa.descricao}</p>}
								<div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-voia-neutral-500">
									{etapa.dataFimPrevista && <span>Prazo previsto: {formatarDataPortal(etapa.dataFimPrevista)}</span>}
									{etapa.dataConclusao && <span>Concluída em: {formatarDataPortal(etapa.dataConclusao)}</span>}
								</div>
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="mt-6 rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
				<h2 className="font-display text-lg text-voia-green-900">Andamento</h2>
				{atualizacoes.length === 0 ? (
					<p className="mt-3 text-sm text-voia-neutral-500">Nenhuma atualização publicada ainda.</p>
				) : (
					<ol className="mt-4 space-y-4 border-l-2 border-voia-neutral-100 pl-4">
						{atualizacoes.map((atualizacao) => (
							<li key={atualizacao.id} className="relative">
								<span className="absolute -left-[1.375rem] top-1 h-2.5 w-2.5 rounded-full bg-voia-gold-500" />
								<p className="font-medium text-voia-neutral-900">{atualizacao.titulo}</p>
								{atualizacao.descricao && <p className="mt-1 text-sm text-voia-neutral-700">{atualizacao.descricao}</p>}
								<p className="mt-1 text-xs text-voia-neutral-500">{formatarDataHora(atualizacao.criadoEm)}</p>
							</li>
						))}
					</ol>
				)}
			</div>
		</div>
	);
}

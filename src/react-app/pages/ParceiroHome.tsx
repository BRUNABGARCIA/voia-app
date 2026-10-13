import { useEffect, useState } from "react";
import { Link } from "react-router";
import MeuFocoHoje from "../components/MeuFocoHoje";
import {
	STATUS_PROJETO_BADGE,
	STATUS_PROJETO_LABEL,
	STATUS_TAREFA_BADGE,
	STATUS_TAREFA_LABEL,
	formatarData,
	type StatusProjeto,
	type StatusTarefa,
} from "../lib/projeto-tipos";

interface MeuProjeto {
	id: number;
	codigo: string | null;
	nome: string;
	status: StatusProjeto;
	prazo_previsto: string | null;
	cliente_nome: string;
	atrasado: number;
}

interface MinhaTarefa {
	id: number;
	nome: string;
	status: StatusTarefa;
	prazo: string | null;
	projeto_id: number;
	projeto_nome: string;
	atrasada: number;
}

interface EntregaOuEtapa {
	id: number;
	nome: string;
	prazo?: string | null;
	data_fim_prevista?: string | null;
	projeto_id: number;
	projeto_nome: string;
}

interface ResumoParceiro {
	tipo: "parceiro";
	nome: string;
	fraseDoDia: string;
	meusProjetos: MeuProjeto[];
	minhasProximasTarefas: MinhaTarefa[];
	proximasEntregas: EntregaOuEtapa[];
	minhasPendencias: number;
	etapasAtrasadasRelacionadas: EntregaOuEtapa[];
}

/**
 * Dashboard pessoal do Parceiro — área de trabalho própria, não uma versão
 * capada do painel administrativo. Nenhum dado aqui vem de um indicador
 * global da VOIA: tudo já chega pré-escopado do backend
 * (dashboard/routes.ts → resumoParceiro), então este componente só exibe.
 */
export default function ParceiroHome({ nome }: { nome: string }) {
	const [resumo, setResumo] = useState<ResumoParceiro | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		fetch("/api/dashboard", { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar o resumo");
				return res.json() as Promise<ResumoParceiro>;
			})
			.then((data) => {
				if (!cancelled) setResumo(data);
			})
			.catch(() => {
				if (!cancelled) setError("Não foi possível carregar o seu resumo.");
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div>
			<h1 className="font-display text-2xl font-light text-voia-neutral-900">Olá, {nome.split(" ")[0]}.</h1>
			{resumo && <p className="mt-1 text-sm italic text-voia-neutral-500">{resumo.fraseDoDia}</p>}

			<MeuFocoHoje />

			{error && <p className="mt-6 text-sm text-voia-danger">{error}</p>}
			{!error && !resumo && <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>}

			{resumo && (
				<>
					<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Meus projetos</span>
							<span className="mt-1 block font-display text-3xl font-light text-voia-green-900">
								{resumo.meusProjetos.length}
							</span>
						</div>
						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Minhas pendências</span>
							<span className="mt-1 block font-display text-3xl font-light text-voia-green-900">
								{resumo.minhasPendencias}
							</span>
						</div>
						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
								Etapas atrasadas
							</span>
							<span
								className={`mt-1 block font-display text-3xl font-light ${
									resumo.etapasAtrasadasRelacionadas.length > 0 ? "text-voia-danger" : "text-voia-green-900"
								}`}
							>
								{resumo.etapasAtrasadasRelacionadas.length}
							</span>
						</div>
					</div>

					<div className="mt-6 rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
						<h2 className="font-display text-lg text-voia-green-900">Minhas tarefas</h2>
						{resumo.minhasProximasTarefas.length === 0 ? (
							<p className="mt-3 text-sm text-voia-neutral-500">Nenhuma tarefa pendente atribuída a você.</p>
						) : (
							<ul className="mt-3 space-y-2">
								{resumo.minhasProximasTarefas.map((tarefa) => (
									<li key={tarefa.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
										<div>
											<Link to={`/projetos/${tarefa.projeto_id}`} className="font-medium text-voia-green-800 hover:underline">
												{tarefa.nome}
											</Link>
											<span className="ml-2 text-xs text-voia-neutral-500">{tarefa.projeto_nome}</span>
										</div>
										<div className="flex items-center gap-2">
											{tarefa.atrasada ? (
												<span className="rounded-control bg-voia-danger/15 px-2 py-0.5 text-xs font-medium text-voia-danger">
													Atrasada
												</span>
											) : (
												<span className={`rounded-control px-2 py-0.5 text-xs font-medium ${STATUS_TAREFA_BADGE[tarefa.status]}`}>
													{STATUS_TAREFA_LABEL[tarefa.status]}
												</span>
											)}
											<span className="text-xs text-voia-neutral-500">{formatarData(tarefa.prazo)}</span>
										</div>
									</li>
								))}
							</ul>
						)}
					</div>

					<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<h2 className="font-display text-lg text-voia-green-900">Próximas entregas</h2>
							{resumo.proximasEntregas.length === 0 ? (
								<p className="mt-3 text-sm text-voia-neutral-500">Nenhuma entrega prevista nos próximos 7 dias.</p>
							) : (
								<ul className="mt-3 space-y-3">
									{resumo.proximasEntregas.map((item) => (
										<li key={item.id}>
											<Link to={`/projetos/${item.projeto_id}`} className="text-sm font-medium text-voia-green-800 hover:underline">
												{item.nome}
											</Link>
											<div className="text-xs text-voia-neutral-500">
												{item.projeto_nome} · {formatarData(item.prazo ?? null)}
											</div>
										</li>
									))}
								</ul>
							)}
						</div>

						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<h2 className="font-display text-lg text-voia-green-900">Etapas atrasadas</h2>
							{resumo.etapasAtrasadasRelacionadas.length === 0 ? (
								<p className="mt-3 text-sm text-voia-neutral-500">Nenhuma etapa atrasada nos seus projetos.</p>
							) : (
								<ul className="mt-3 space-y-3">
									{resumo.etapasAtrasadasRelacionadas.map((item) => (
										<li key={item.id}>
											<Link to={`/projetos/${item.projeto_id}`} className="text-sm font-medium text-voia-green-800 hover:underline">
												{item.nome}
											</Link>
											<div className="text-xs text-voia-neutral-500">
												{item.projeto_nome} · {formatarData(item.data_fim_prevista ?? null)}
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>

					<div className="mt-6">
						<h2 className="font-display text-lg text-voia-green-900">Meus projetos</h2>
						{resumo.meusProjetos.length === 0 ? (
							<p className="mt-3 text-sm text-voia-neutral-500">
								Você ainda não possui projetos vinculados. Quando for adicionado a um projeto, ele aparecerá aqui.
							</p>
						) : (
							<div className="mt-3 overflow-x-auto rounded-card border border-voia-neutral-100 bg-(--color-surface) shadow-card">
								<table className="w-full min-w-[560px] text-left text-sm">
									<thead>
										<tr className="border-b border-voia-neutral-100 text-xs uppercase tracking-wide text-voia-neutral-500">
											<th className="px-4 py-3 font-medium">Projeto</th>
											<th className="px-4 py-3 font-medium">Cliente</th>
											<th className="px-4 py-3 font-medium">Status</th>
											<th className="px-4 py-3 font-medium">Prazo</th>
										</tr>
									</thead>
									<tbody>
										{resumo.meusProjetos.map((projeto) => (
											<tr key={projeto.id} className="border-b border-voia-neutral-100 last:border-b-0">
												<td className="px-4 py-3">
													<Link to={`/projetos/${projeto.id}`} className="font-medium text-voia-green-800 hover:underline">
														{projeto.nome}
													</Link>
												</td>
												<td className="px-4 py-3 text-voia-neutral-700">{projeto.cliente_nome}</td>
												<td className="px-4 py-3">
													<span className={`rounded-control px-2 py-1 text-xs font-medium ${STATUS_PROJETO_BADGE[projeto.status]}`}>
														{STATUS_PROJETO_LABEL[projeto.status] ?? projeto.status}
													</span>
												</td>
												<td className="px-4 py-3 text-voia-neutral-700">{formatarData(projeto.prazo_previsto)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}

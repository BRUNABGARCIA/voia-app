import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../contexts/useAuth";
import {
	STATUS_PROJETO_BADGE,
	STATUS_PROJETO_LABEL,
	formatarData,
	type StatusProjeto,
} from "../lib/projeto-tipos";

interface ProjetoResumo {
	id: number;
	codigo: string | null;
	nome: string;
	status: StatusProjeto;
	prazo_previsto?: string | null;
	criado_em?: string;
	cliente_nome: string;
	gerente_nome: string | null;
}

interface DashboardResumo {
	clientesAtivos: number;
	projetosEmAndamento: number;
	projetosAtrasados: number;
	projetosConcluidos: number;
	projetosPorStatus: { status: StatusProjeto; total: number }[];
	proximosPrazos: ProjetoResumo[];
	projetosRecentes: ProjetoResumo[];
}

function KpiTile({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
	return (
		<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
			<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">{label}</span>
			<span className={`mt-1 block font-display text-3xl font-light ${destaque ? "text-voia-danger" : "text-voia-green-900"}`}>
				{valor}
			</span>
		</div>
	);
}

export default function Home() {
	const { user } = useAuth();
	const [resumo, setResumo] = useState<DashboardResumo | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		fetch("/api/dashboard", { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar o resumo");
				return res.json() as Promise<DashboardResumo>;
			})
			.then((data) => {
				if (!cancelled) setResumo(data);
			})
			.catch(() => {
				if (!cancelled) setError("Não foi possível carregar o resumo operacional.");
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div>
			<h1 className="font-display text-2xl font-light text-voia-neutral-900">
				Olá{user ? `, ${user.nome.split(" ")[0]}` : ""}.
			</h1>
			<p className="mt-1 text-sm text-voia-neutral-700">Resumo operacional do VOIA.</p>

			{error && <p className="mt-6 text-sm text-voia-danger">{error}</p>}
			{!error && !resumo && <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>}

			{resumo && (
				<>
					<div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
						<KpiTile label="Clientes ativos" valor={resumo.clientesAtivos} />
						<KpiTile label="Projetos em andamento" valor={resumo.projetosEmAndamento} />
						<KpiTile label="Projetos atrasados" valor={resumo.projetosAtrasados} destaque={resumo.projetosAtrasados > 0} />
						<KpiTile label="Projetos concluídos" valor={resumo.projetosConcluidos} />
					</div>

					<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<h2 className="font-display text-lg text-voia-green-900">Projetos por status</h2>
							{resumo.projetosPorStatus.length === 0 ? (
								<p className="mt-3 text-sm text-voia-neutral-500">Nenhum projeto cadastrado ainda.</p>
							) : (
								<ul className="mt-3 space-y-2">
									{resumo.projetosPorStatus.map((item) => (
										<li key={item.status} className="flex items-center justify-between text-sm">
											<span className={`rounded-control px-2 py-1 text-xs font-medium ${STATUS_PROJETO_BADGE[item.status]}`}>
												{STATUS_PROJETO_LABEL[item.status] ?? item.status}
											</span>
											<span className="font-medium text-voia-neutral-900">{item.total}</span>
										</li>
									))}
								</ul>
							)}
						</div>

						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<h2 className="font-display text-lg text-voia-green-900">Próximos prazos</h2>
							{resumo.proximosPrazos.length === 0 ? (
								<p className="mt-3 text-sm text-voia-neutral-500">Nenhum prazo pendente.</p>
							) : (
								<ul className="mt-3 space-y-3">
									{resumo.proximosPrazos.map((projeto) => (
										<li key={projeto.id}>
											<Link to={`/projetos/${projeto.id}`} className="text-sm font-medium text-voia-green-800 hover:underline">
												{projeto.nome}
											</Link>
											<div className="text-xs text-voia-neutral-500">
												{projeto.cliente_nome} · {formatarData(projeto.prazo_previsto ?? null)}
												{projeto.gerente_nome ? ` · ${projeto.gerente_nome}` : ""}
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>

					<div className="mt-6">
						<h2 className="font-display text-lg text-voia-green-900">Projetos recentes</h2>
						{resumo.projetosRecentes.length === 0 ? (
							<p className="mt-3 text-sm text-voia-neutral-500">Nenhum projeto cadastrado ainda.</p>
						) : (
							<div className="mt-3 overflow-x-auto rounded-card border border-voia-neutral-100 bg-(--color-surface) shadow-card">
								<table className="w-full min-w-[640px] text-left text-sm">
									<thead>
										<tr className="border-b border-voia-neutral-100 text-xs uppercase tracking-wide text-voia-neutral-500">
											<th className="px-4 py-3 font-medium">Projeto</th>
											<th className="px-4 py-3 font-medium">Cliente</th>
											<th className="px-4 py-3 font-medium">Status</th>
											<th className="px-4 py-3 font-medium">Responsável</th>
										</tr>
									</thead>
									<tbody>
										{resumo.projetosRecentes.map((projeto) => (
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
												<td className="px-4 py-3 text-voia-neutral-700">{projeto.gerente_nome ?? "—"}</td>
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

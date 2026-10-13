import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../contexts/useAuth";
import NovaObraModal from "../components/NovaObraModal";
import ProgressoBar from "../components/ProgressoBar";
import { formatarData } from "../lib/projeto-tipos";
import { STATUS_OBRA, STATUS_OBRA_BADGE, STATUS_OBRA_LABEL, type Obra } from "../lib/obra-tipos";

const PERFIS_QUE_CRIAM = ["administrador", "gestor"];

export default function Obras() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const podeCriar = user ? PERFIS_QUE_CRIAM.includes(user.perfil) : false;

	const [obras, setObras] = useState<Obra[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);
	const [status, setStatus] = useState("");
	const [busca, setBusca] = useState("");

	const carregar = useCallback(() => {
		const params = new URLSearchParams();
		if (status) params.set("status", status);
		if (busca.trim()) params.set("q", busca.trim());
		fetch(`/api/obras?${params.toString()}`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<{ obras: Obra[] }>;
			})
			.then((data) => setObras(data.obras))
			.catch(() => setError("Não foi possível carregar as obras."));
	}, [status, busca]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	return (
		<div>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="font-display text-2xl font-light text-voia-neutral-900">Obras</h1>
					<p className="mt-1 text-sm text-voia-neutral-700">Acompanhamento da execução das obras vinculadas aos projetos.</p>
				</div>
				{podeCriar && (
					<button
						type="button"
						onClick={() => setCriando(true)}
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400"
					>
						+ Nova obra
					</button>
				)}
			</div>

			<div className="mt-6 flex flex-wrap gap-3">
				<input
					type="text"
					placeholder="Buscar por obra, projeto ou cliente…"
					value={busca}
					onChange={(e) => setBusca(e.target.value)}
					className="min-w-[220px] flex-1 rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				/>
				<select
					value={status}
					onChange={(e) => setStatus(e.target.value)}
					className="rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				>
					<option value="">Todos os status</option>
					{STATUS_OBRA.map((s) => (
						<option key={s} value={s}>
							{STATUS_OBRA_LABEL[s]}
						</option>
					))}
				</select>
			</div>

			{error && <p className="mt-6 text-sm text-voia-danger">{error}</p>}
			{!error && !obras && <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>}
			{obras && obras.length === 0 && (
				<p className="mt-6 text-sm text-voia-neutral-500">Nenhuma obra encontrada.</p>
			)}

			{obras && obras.length > 0 && (
				<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{obras.map((obra) => (
						<Link
							key={obra.id}
							to={`/obras/${obra.id}`}
							className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card transition-shadow hover:shadow-elevated"
						>
							<div className="flex items-start justify-between gap-2">
								<span className="font-medium text-voia-neutral-900">{obra.nome}</span>
								<span className={`shrink-0 rounded-control px-2 py-1 text-xs font-medium ${STATUS_OBRA_BADGE[obra.status]}`}>
									{STATUS_OBRA_LABEL[obra.status]}
								</span>
							</div>
							<p className="mt-1 text-xs text-voia-neutral-500">
								{obra.projeto_nome} · {obra.cliente_nome}
							</p>
							<div className="mt-3">
								<div className="flex items-center justify-between text-xs text-voia-neutral-500">
									<span>Progresso</span>
									<span>{obra.progresso}%</span>
								</div>
								<div className="mt-1">
									<ProgressoBar valor={obra.progresso} />
								</div>
							</div>
							<div className="mt-3 flex items-center justify-between text-xs">
								<span className="text-voia-neutral-500">{formatarData(obra.data_fim_prevista)}</span>
								{obra.atrasada ? <span className="font-medium text-voia-danger">Atrasada</span> : null}
							</div>
						</Link>
					))}
				</div>
			)}

			{criando && (
				<NovaObraModal
					onClose={() => setCriando(false)}
					onCreated={(obraId) => {
						setCriando(false);
						navigate(`/obras/${obraId}`);
					}}
				/>
			)}
		</div>
	);
}

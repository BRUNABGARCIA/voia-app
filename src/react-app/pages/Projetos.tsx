import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/useAuth";
import ProjetoModal from "../components/ProjetoModal";
import ProgressoBar from "../components/ProgressoBar";
import {
	PRIORIDADE_BADGE,
	PRIORIDADE_LABEL,
	PRIORIDADES,
	STATUS_PROJETO,
	STATUS_PROJETO_BADGE,
	STATUS_PROJETO_LABEL,
	formatarData,
	projetoAtrasado,
	type Projeto,
} from "../lib/projeto-tipos";

const PERFIS_QUE_CRIAM = ["administrador", "gestor"];

interface OpcaoSimples {
	id: number;
	nome: string;
}

export default function Projetos() {
	const { user } = useAuth();
	const navigate = useNavigate();

	const [projetos, setProjetos] = useState<Projeto[] | null>(null);
	const [clientes, setClientes] = useState<OpcaoSimples[]>([]);
	const [usuarios, setUsuarios] = useState<OpcaoSimples[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);
	const [sucesso, setSucesso] = useState<string | null>(null);

	const [status, setStatus] = useState("");
	const [clienteId, setClienteId] = useState("");
	const [responsavelId, setResponsavelId] = useState("");
	const [prioridade, setPrioridade] = useState("");
	const [busca, setBusca] = useState("");

	const podeCriar = user ? PERFIS_QUE_CRIAM.includes(user.perfil) : false;

	useEffect(() => {
		fetch("/api/clientes", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ clientes: OpcaoSimples[] }>) : null))
			.then((data) => data && setClientes(data.clientes))
			.catch(() => {});

		fetch("/api/usuarios/opcoes", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ usuarios: OpcaoSimples[] }>) : null))
			.then((data) => data && setUsuarios(data.usuarios))
			.catch(() => {});
	}, []);

	const carregar = useCallback(() => {
		const params = new URLSearchParams();
		if (status) params.set("status", status);
		if (clienteId) params.set("cliente_id", clienteId);
		if (responsavelId) params.set("responsavel_id", responsavelId);
		if (prioridade) params.set("prioridade", prioridade);
		if (busca.trim()) params.set("q", busca.trim());

		fetch(`/api/projetos?${params.toString()}`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar os projetos");
				return res.json() as Promise<{ projetos: Projeto[] }>;
			})
			.then((data) => setProjetos(data.projetos))
			.catch(() => setError("Não foi possível carregar os projetos."));
	}, [status, clienteId, responsavelId, prioridade, busca]);

	useEffect(() => {
		const timer = setTimeout(carregar, busca ? 300 : 0);
		return () => clearTimeout(timer);
	}, [carregar, busca]);

	useEffect(() => {
		if (!sucesso) return;
		const timer = setTimeout(() => setSucesso(null), 4000);
		return () => clearTimeout(timer);
	}, [sucesso]);

	function handleCreated(criado: Projeto) {
		setCriando(false);
		setSucesso(`Projeto "${criado.nome}" (${criado.codigo}) criado com sucesso.`);
		carregar();
	}

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-display text-2xl font-light text-voia-neutral-900">Projetos</h1>
					<p className="mt-1 text-sm text-voia-neutral-700">Projetos de engenharia em andamento e planejados.</p>
				</div>
				{podeCriar && (
					<button
						type="button"
						onClick={() => setCriando(true)}
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400"
					>
						+ Novo projeto
					</button>
				)}
			</div>

			<div className="mt-6 flex flex-wrap gap-3">
				<input
					type="text"
					value={busca}
					onChange={(e) => setBusca(e.target.value)}
					placeholder="Buscar por nome ou código…"
					className="min-w-[220px] flex-1 rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				/>
				<select
					value={status}
					onChange={(e) => setStatus(e.target.value)}
					className="rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				>
					<option value="">Todos os status</option>
					{STATUS_PROJETO.map((s) => (
						<option key={s} value={s}>
							{STATUS_PROJETO_LABEL[s]}
						</option>
					))}
				</select>
				<select
					value={prioridade}
					onChange={(e) => setPrioridade(e.target.value)}
					className="rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				>
					<option value="">Todas as prioridades</option>
					{PRIORIDADES.map((p) => (
						<option key={p} value={p}>
							{PRIORIDADE_LABEL[p]}
						</option>
					))}
				</select>
				<select
					value={clienteId}
					onChange={(e) => setClienteId(e.target.value)}
					className="rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				>
					<option value="">Todos os clientes</option>
					{clientes.map((c) => (
						<option key={c.id} value={c.id}>
							{c.nome}
						</option>
					))}
				</select>
				<select
					value={responsavelId}
					onChange={(e) => setResponsavelId(e.target.value)}
					className="rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				>
					<option value="">Todos os responsáveis</option>
					{usuarios.map((u) => (
						<option key={u.id} value={u.id}>
							{u.nome}
						</option>
					))}
				</select>
			</div>

			{sucesso && (
				<p className="mt-4 rounded-control bg-voia-success/15 px-3 py-2 text-sm text-voia-success">{sucesso}</p>
			)}
			{error && <p className="mt-6 text-sm text-voia-danger">{error}</p>}

			{!error && !projetos && <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>}

			{projetos && projetos.length === 0 && (
				<p className="mt-6 text-sm text-voia-neutral-500">Nenhum projeto encontrado.</p>
			)}

			{projetos && projetos.length > 0 && (
				<div className="mt-6 overflow-x-auto rounded-card border border-voia-neutral-100 bg-(--color-surface) shadow-card">
					<table className="w-full min-w-[980px] text-left text-sm">
						<thead>
							<tr className="border-b border-voia-neutral-100 text-xs uppercase tracking-wide text-voia-neutral-500">
								<th className="px-4 py-3 font-medium">Código</th>
								<th className="px-4 py-3 font-medium">Projeto</th>
								<th className="px-4 py-3 font-medium">Cliente</th>
								<th className="px-4 py-3 font-medium">Status</th>
								<th className="px-4 py-3 font-medium">Prioridade</th>
								<th className="px-4 py-3 font-medium">Progresso</th>
								<th className="px-4 py-3 font-medium">Responsável</th>
								<th className="px-4 py-3 font-medium">Prazo</th>
							</tr>
						</thead>
						<tbody>
							{projetos.map((projeto) => (
								<tr
									key={projeto.id}
									onClick={() => navigate(`/projetos/${projeto.id}`)}
									className="cursor-pointer border-b border-voia-neutral-100 last:border-b-0 hover:bg-voia-beige-50"
								>
									<td className="px-4 py-3 text-voia-neutral-700">{projeto.codigo ?? "—"}</td>
									<td className="px-4 py-3 font-medium text-voia-neutral-900">{projeto.nome}</td>
									<td className="px-4 py-3 text-voia-neutral-700">{projeto.cliente_nome}</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-control px-2 py-1 text-xs font-medium ${STATUS_PROJETO_BADGE[projeto.status]}`}
										>
											{STATUS_PROJETO_LABEL[projeto.status]}
										</span>
									</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-control px-2 py-1 text-xs font-medium ${PRIORIDADE_BADGE[projeto.prioridade]}`}
										>
											{PRIORIDADE_LABEL[projeto.prioridade]}
										</span>
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-2">
											<div className="w-16">
												<ProgressoBar valor={projeto.progresso} compacta />
											</div>
											<span className="text-xs text-voia-neutral-700">{projeto.progresso}%</span>
										</div>
									</td>
									<td className="px-4 py-3 text-voia-neutral-700">{projeto.gerente_nome ?? "—"}</td>
									<td className="px-4 py-3 text-voia-neutral-700">
										{formatarData(projeto.prazo_previsto)}
										{projetoAtrasado(projeto) && (
											<span className="ml-2 rounded-control bg-voia-danger/15 px-2 py-0.5 text-xs font-medium text-voia-danger">
												Atrasado
											</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{criando && (
				<ProjetoModal projeto={null} tiposServicoAtuais={[]} onClose={() => setCriando(false)} onSaved={handleCreated} />
			)}
		</div>
	);
}

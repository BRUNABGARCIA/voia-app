import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/useAuth";
import ClienteModal from "../components/ClienteModal";
import { STATUS_BADGE, STATUS_LABEL, TIPO_LABEL, type Cliente } from "../lib/cliente-tipos";

const PERFIS_QUE_CRIAM = ["administrador", "gestor", "colaborador"];

function formatarData(valor: string): string {
	const data = new Date(valor.includes("T") ? valor : `${valor.replace(" ", "T")}Z`);
	if (Number.isNaN(data.getTime())) return "—";
	return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Clientes() {
	const { user } = useAuth();
	const navigate = useNavigate();

	const [clientes, setClientes] = useState<Cliente[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);
	const [sucesso, setSucesso] = useState<string | null>(null);

	const [status, setStatus] = useState("");
	const [tipo, setTipo] = useState("");
	const [busca, setBusca] = useState("");

	const podeCriar = user ? PERFIS_QUE_CRIAM.includes(user.perfil) : false;

	const carregar = useCallback(() => {
		const params = new URLSearchParams();
		if (status) params.set("status", status);
		if (tipo) params.set("tipo", tipo);
		if (busca.trim()) params.set("q", busca.trim());

		fetch(`/api/clientes?${params.toString()}`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar os clientes");
				return res.json() as Promise<{ clientes: Cliente[] }>;
			})
			.then((data) => setClientes(data.clientes))
			.catch(() => setError("Não foi possível carregar os clientes."));
	}, [status, tipo, busca]);

	useEffect(() => {
		const timer = setTimeout(carregar, busca ? 300 : 0);
		return () => clearTimeout(timer);
	}, [carregar, busca]);

	useEffect(() => {
		if (!sucesso) return;
		const timer = setTimeout(() => setSucesso(null), 4000);
		return () => clearTimeout(timer);
	}, [sucesso]);

	function handleCreated(criado: Cliente) {
		setCriando(false);
		setSucesso(`Cliente "${criado.nome}" criado com sucesso.`);
		carregar();
	}

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-display text-2xl font-light text-voia-neutral-900">Clientes</h1>
					<p className="mt-1 text-sm text-voia-neutral-700">Leads e clientes ativos do VOIA.</p>
				</div>
				{podeCriar && (
					<button
						type="button"
						onClick={() => setCriando(true)}
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400"
					>
						+ Novo cliente
					</button>
				)}
			</div>

			<div className="mt-6 flex flex-wrap gap-3">
				<input
					type="text"
					value={busca}
					onChange={(e) => setBusca(e.target.value)}
					placeholder="Buscar por nome ou documento…"
					className="min-w-[220px] flex-1 rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				/>
				<select
					value={status}
					onChange={(e) => setStatus(e.target.value)}
					className="rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				>
					<option value="">Todos os status</option>
					<option value="lead">Lead</option>
					<option value="ativo">Ativo</option>
					<option value="inativo">Inativo</option>
				</select>
				<select
					value={tipo}
					onChange={(e) => setTipo(e.target.value)}
					className="rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				>
					<option value="">PF e PJ</option>
					<option value="PF">Pessoa Física</option>
					<option value="PJ">Pessoa Jurídica</option>
				</select>
			</div>

			{sucesso && (
				<p className="mt-4 rounded-control bg-voia-success/15 px-3 py-2 text-sm text-voia-success">{sucesso}</p>
			)}
			{error && <p className="mt-6 text-sm text-voia-danger">{error}</p>}

			{!error && !clientes && <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>}

			{clientes && clientes.length === 0 && (
				<p className="mt-6 text-sm text-voia-neutral-500">Nenhum cliente encontrado.</p>
			)}

			{clientes && clientes.length > 0 && (
				<div className="mt-6 overflow-x-auto rounded-card border border-voia-neutral-100 bg-white shadow-card">
					<table className="w-full min-w-[820px] text-left text-sm">
						<thead>
							<tr className="border-b border-voia-neutral-100 text-xs uppercase tracking-wide text-voia-neutral-500">
								<th className="px-4 py-3 font-medium">Nome</th>
								<th className="px-4 py-3 font-medium">Tipo</th>
								<th className="px-4 py-3 font-medium">Contato</th>
								<th className="px-4 py-3 font-medium">Cidade/UF</th>
								<th className="px-4 py-3 font-medium">Status</th>
								<th className="px-4 py-3 font-medium">Responsável</th>
								<th className="px-4 py-3 font-medium">Criado em</th>
							</tr>
						</thead>
						<tbody>
							{clientes.map((cliente) => (
								<tr
									key={cliente.id}
									onClick={() => navigate(`/clientes/${cliente.id}`)}
									className="cursor-pointer border-b border-voia-neutral-100 last:border-b-0 hover:bg-voia-beige-50"
								>
									<td className="px-4 py-3 font-medium text-voia-neutral-900">
										{cliente.nome}
										{cliente.nome_fantasia && (
											<span className="block text-xs font-normal text-voia-neutral-500">{cliente.nome_fantasia}</span>
										)}
									</td>
									<td className="px-4 py-3 text-voia-neutral-700">{TIPO_LABEL[cliente.tipo]}</td>
									<td className="px-4 py-3 text-voia-neutral-700">{cliente.telefone ?? cliente.email ?? "—"}</td>
									<td className="px-4 py-3 text-voia-neutral-700">
										{cliente.cidade ? `${cliente.cidade}${cliente.estado ? `/${cliente.estado}` : ""}` : "—"}
									</td>
									<td className="px-4 py-3">
										<span className={`rounded-control px-2 py-1 text-xs font-medium ${STATUS_BADGE[cliente.status]}`}>
											{STATUS_LABEL[cliente.status]}
										</span>
									</td>
									<td className="px-4 py-3 text-voia-neutral-700">{cliente.responsavel_interno_nome ?? "—"}</td>
									<td className="px-4 py-3 text-voia-neutral-700">{formatarData(cliente.criado_em)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{criando && <ClienteModal cliente={null} onClose={() => setCriando(false)} onSaved={handleCreated} />}
		</div>
	);
}

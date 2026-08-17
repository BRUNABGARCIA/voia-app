import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../contexts/useAuth";
import ClienteModal from "../components/ClienteModal";
import Tabs from "../components/Tabs";
import ProgressoBar from "../components/ProgressoBar";
import ClientePortalPanel from "../components/ClientePortalPanel";
import { STATUS_BADGE, STATUS_LABEL, TIPO_LABEL, type Cliente, type ProjetoDoCliente } from "../lib/cliente-tipos";
import { formatarData } from "../lib/projeto-tipos";

const PERFIS_QUE_EDITAM = ["administrador", "gestor", "colaborador"];
const PERFIS_QUE_GERENCIAM_PORTAL = ["administrador", "gestor"];

const ABAS = [
	{ key: "visao-geral", label: "Visão Geral" },
	{ key: "projetos", label: "Projetos" },
	{ key: "portal", label: "Portal do Cliente" },
];

const PROJETO_STATUS_LABEL: Record<string, string> = {
	prospeccao: "Prospecção",
	planejamento: "Planejamento",
	em_andamento: "Em andamento",
	aguardando_cliente: "Aguardando cliente",
	aguardando_terceiro: "Aguardando terceiro",
	pausado: "Pausado",
	concluido: "Concluído",
	cancelado: "Cancelado",
};

function linha(label: string, valor: string | null | undefined) {
	return (
		<div>
			<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">{label}</span>
			<span className="text-sm text-voia-neutral-900">{valor || "—"}</span>
		</div>
	);
}

export default function ClienteWorkspace() {
	const { id } = useParams<{ id: string }>();
	const { user } = useAuth();
	const navigate = useNavigate();

	const [cliente, setCliente] = useState<Cliente | null>(null);
	const [projetos, setProjetos] = useState<ProjetoDoCliente[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [aba, setAba] = useState("visao-geral");
	const [editando, setEditando] = useState(false);

	const podeEditar = user ? PERFIS_QUE_EDITAM.includes(user.perfil) : false;
	const podeGerenciarPortal = user ? PERFIS_QUE_GERENCIAM_PORTAL.includes(user.perfil) : false;
	const abas = podeGerenciarPortal ? ABAS : ABAS.filter((aba) => aba.key !== "portal");

	const carregar = useCallback(() => {
		fetch(`/api/clientes/${id}`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("cliente não encontrado");
				return res.json() as Promise<{ cliente: Cliente; projetos: ProjetoDoCliente[] }>;
			})
			.then((data) => {
				setCliente(data.cliente);
				setProjetos(data.projetos);
			})
			.catch(() => setError("Não foi possível carregar este cliente."));
	}, [id]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	function handleSaved(atualizado: Cliente) {
		setCliente(atualizado);
		setEditando(false);
	}

	if (error) {
		return <p className="text-sm text-voia-danger">{error}</p>;
	}

	if (!cliente) {
		return <p className="text-sm text-voia-neutral-500">Carregando…</p>;
	}

	const endereco = [cliente.logradouro, cliente.numero, cliente.bairro, cliente.cidade, cliente.estado]
		.filter(Boolean)
		.join(", ");

	return (
		<div>
			<button
				type="button"
				onClick={() => navigate("/clientes")}
				className="text-sm font-medium text-voia-neutral-500 hover:text-voia-neutral-900"
			>
				← Clientes
			</button>

			<div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="font-display text-2xl font-light text-voia-neutral-900 break-words">{cliente.nome}</h1>
						<span className={`rounded-control px-2 py-1 text-xs font-medium ${STATUS_BADGE[cliente.status]}`}>
							{STATUS_LABEL[cliente.status]}
						</span>
					</div>
					<p className="mt-1 text-sm text-voia-neutral-700">
						{TIPO_LABEL[cliente.tipo]}
						{cliente.nome_fantasia ? ` · ${cliente.nome_fantasia}` : ""}
					</p>
				</div>
				{podeEditar && (
					<button
						type="button"
						onClick={() => setEditando(true)}
						className="rounded-control border border-voia-neutral-100 px-4 py-2 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						Editar
					</button>
				)}
			</div>

			<div className="mt-6">
				<Tabs abas={abas} ativa={aba} onChange={setAba} />
			</div>

			{aba === "visao-geral" && (
				<div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
					<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
						<h2 className="font-display text-lg text-voia-green-900">Identificação</h2>
						<div className="mt-4 grid grid-cols-2 gap-4">
							{linha("CPF/CNPJ", cliente.documento)}
							{linha("Telefone", cliente.telefone)}
							{linha("WhatsApp", cliente.whatsapp)}
							{linha("E-mail", cliente.email)}
						</div>
					</div>

					<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
						<h2 className="font-display text-lg text-voia-green-900">Endereço</h2>
						<div className="mt-4 grid grid-cols-2 gap-4">
							{linha("Endereço", endereco)}
							{linha("Complemento", cliente.complemento)}
							{linha("CEP", cliente.cep)}
						</div>
					</div>

					<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card sm:col-span-2">
						<h2 className="font-display text-lg text-voia-green-900">Gestão</h2>
						<div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
							{linha("Origem", cliente.origem)}
							{linha("Responsável interno", cliente.responsavel_interno_nome)}
						</div>
						{cliente.observacoes && (
							<div className="mt-4">
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
									Observações
								</span>
								<p className="mt-1 whitespace-pre-wrap text-sm text-voia-neutral-900">{cliente.observacoes}</p>
							</div>
						)}
					</div>
				</div>
			)}

			{aba === "projetos" && (
				<div className="mt-6">
					{projetos.length === 0 ? (
						<p className="text-sm text-voia-neutral-500">Nenhum projeto vinculado a este cliente ainda.</p>
					) : (
						<div className="overflow-x-auto rounded-card border border-voia-neutral-100 bg-(--color-surface) shadow-card">
							<table className="w-full min-w-[640px] text-left text-sm">
								<thead>
									<tr className="border-b border-voia-neutral-100 text-xs uppercase tracking-wide text-voia-neutral-500">
										<th className="px-4 py-3 font-medium">Código</th>
										<th className="px-4 py-3 font-medium">Projeto</th>
										<th className="px-4 py-3 font-medium">Status</th>
										<th className="px-4 py-3 font-medium">Progresso</th>
										<th className="px-4 py-3 font-medium">Prazo</th>
										<th className="px-4 py-3 font-medium">Responsável</th>
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
											<td className="px-4 py-3 text-voia-neutral-700">
												{PROJETO_STATUS_LABEL[projeto.status] ?? projeto.status}
											</td>
											<td className="px-4 py-3">
											<div className="flex items-center gap-2">
												<div className="w-16">
													<ProgressoBar valor={projeto.progresso} compacta />
												</div>
												<span className="text-xs text-voia-neutral-700">{projeto.progresso}%</span>
											</div>
										</td>
											<td className="px-4 py-3 text-voia-neutral-700">{formatarData(projeto.prazo_previsto)}</td>
											<td className="px-4 py-3 text-voia-neutral-700">{projeto.gerente_nome ?? "—"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			{aba === "portal" && podeGerenciarPortal && <ClientePortalPanel clienteId={cliente.id} />}

			{editando && <ClienteModal cliente={cliente} onClose={() => setEditando(false)} onSaved={handleSaved} />}
		</div>
	);
}

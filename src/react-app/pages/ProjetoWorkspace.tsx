import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../contexts/useAuth";
import ProjetoModal from "../components/ProjetoModal";
import ProjetoEquipePanel from "../components/ProjetoEquipePanel";
import Tabs from "../components/Tabs";
import {
	PRIORIDADE_BADGE,
	PRIORIDADE_LABEL,
	STATUS_PROJETO_BADGE,
	STATUS_PROJETO_LABEL,
	formatarData,
	formatarMoeda,
	projetoAtrasado,
	type Projeto,
	type TipoServico,
} from "../lib/projeto-tipos";

const PERFIS_QUE_EDITAM = ["administrador", "gestor", "colaborador"];
const PERFIS_QUE_GERENCIAM_EQUIPE = ["administrador", "gestor"];

const ABAS = [
	{ key: "visao-geral", label: "Visão Geral" },
	{ key: "equipe", label: "Equipe" },
];

function linha(label: string, valor: string | null | undefined) {
	return (
		<div>
			<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">{label}</span>
			<span className="text-sm text-voia-neutral-900">{valor || "—"}</span>
		</div>
	);
}

export default function ProjetoWorkspace() {
	const { id } = useParams<{ id: string }>();
	const { user } = useAuth();
	const navigate = useNavigate();

	const [projeto, setProjeto] = useState<Projeto | null>(null);
	const [tiposServico, setTiposServico] = useState<TipoServico[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [aba, setAba] = useState("visao-geral");
	const [editando, setEditando] = useState(false);

	const podeEditar = user ? PERFIS_QUE_EDITAM.includes(user.perfil) : false;
	const podeGerenciarEquipe = user ? PERFIS_QUE_GERENCIAM_EQUIPE.includes(user.perfil) : false;

	const carregar = useCallback(() => {
		fetch(`/api/projetos/${id}`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("projeto não encontrado");
				return res.json() as Promise<{ projeto: Projeto; tiposServico: TipoServico[] }>;
			})
			.then((data) => {
				setProjeto(data.projeto);
				setTiposServico(data.tiposServico);
			})
			.catch(() => setError("Não foi possível carregar este projeto."));
	}, [id]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	function handleSaved(atualizado: Projeto) {
		setProjeto(atualizado);
		carregar(); // recarrega tiposServico (nomes) refletindo a edição
		setEditando(false);
	}

	if (error) {
		return <p className="text-sm text-voia-danger">{error}</p>;
	}

	if (!projeto) {
		return <p className="text-sm text-voia-neutral-500">Carregando…</p>;
	}

	const endereco = [projeto.logradouro, projeto.numero, projeto.bairro, projeto.cidade, projeto.estado]
		.filter(Boolean)
		.join(", ");
	const atrasado = projetoAtrasado(projeto);

	return (
		<div>
			<button
				type="button"
				onClick={() => navigate("/projetos")}
				className="text-sm font-medium text-voia-neutral-500 hover:text-voia-neutral-900"
			>
				← Projetos
			</button>

			<div className="mt-2 flex items-start justify-between">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="font-display text-2xl font-light text-voia-neutral-900">
							{projeto.codigo && <span className="text-voia-neutral-500">{projeto.codigo} · </span>}
							{projeto.nome}
						</h1>
						<span className={`rounded-control px-2 py-1 text-xs font-medium ${STATUS_PROJETO_BADGE[projeto.status]}`}>
							{STATUS_PROJETO_LABEL[projeto.status]}
						</span>
						<span
							className={`rounded-control px-2 py-1 text-xs font-medium ${PRIORIDADE_BADGE[projeto.prioridade]}`}
						>
							{PRIORIDADE_LABEL[projeto.prioridade]}
						</span>
					</div>
					<p className="mt-1 text-sm text-voia-neutral-700">
						Cliente:{" "}
						<Link to={`/clientes/${projeto.cliente_id}`} className="font-medium text-voia-green-800 hover:underline">
							{projeto.cliente_nome}
						</Link>
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
				<Tabs abas={ABAS} ativa={aba} onChange={setAba} />
			</div>

			{aba === "visao-geral" && (
				<div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
					<div className="rounded-card border border-voia-neutral-100 bg-white p-(--space-card) shadow-card sm:col-span-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Progresso</span>
							<span className="text-sm font-medium text-voia-neutral-900">{projeto.progresso}%</span>
						</div>
						<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-voia-neutral-100">
							<div
								className="h-full rounded-full bg-voia-gold-500 transition-all"
								style={{ width: `${projeto.progresso}%` }}
							/>
						</div>
					</div>

					<div className="rounded-card border border-voia-neutral-100 bg-white p-(--space-card) shadow-card">
						<h2 className="font-display text-lg text-voia-green-900">Gestão</h2>
						<div className="mt-4 grid grid-cols-2 gap-4">
							{linha("Responsável", projeto.gerente_nome)}
							{linha("Valor contratado", formatarMoeda(projeto.valor_contratado))}
							{linha("Data de início", formatarData(projeto.data_inicio))}
							<div>
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Prazo</span>
								<span className="text-sm text-voia-neutral-900">
									{formatarData(projeto.prazo_previsto)}
									{atrasado && (
										<span className="ml-2 rounded-control bg-voia-danger/15 px-2 py-0.5 text-xs font-medium text-voia-danger">
											Atrasado
										</span>
									)}
								</span>
							</div>
						</div>
						{tiposServico.length > 0 && (
							<div className="mt-4">
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
									Tipos de serviço
								</span>
								<div className="mt-1 flex flex-wrap gap-1.5">
									{tiposServico.map((tipo) => (
										<span
											key={tipo.id}
											className="rounded-control bg-voia-beige-100 px-2 py-1 text-xs font-medium text-voia-neutral-700"
										>
											{tipo.nome}
										</span>
									))}
								</div>
							</div>
						)}
					</div>

					<div className="rounded-card border border-voia-neutral-100 bg-white p-(--space-card) shadow-card">
						<h2 className="font-display text-lg text-voia-green-900">Endereço da obra</h2>
						<div className="mt-4 grid grid-cols-2 gap-4">
							{linha("Endereço", endereco)}
							{linha("Complemento", projeto.complemento)}
							{linha("CEP", projeto.cep)}
						</div>
					</div>

					{(projeto.descricao || projeto.observacoes) && (
						<div className="rounded-card border border-voia-neutral-100 bg-white p-(--space-card) shadow-card sm:col-span-2">
							{projeto.descricao && (
								<div>
									<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
										Descrição
									</span>
									<p className="mt-1 whitespace-pre-wrap text-sm text-voia-neutral-900">{projeto.descricao}</p>
								</div>
							)}
							{projeto.observacoes && (
								<div className={projeto.descricao ? "mt-4" : ""}>
									<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
										Observações
									</span>
									<p className="mt-1 whitespace-pre-wrap text-sm text-voia-neutral-900">{projeto.observacoes}</p>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{aba === "equipe" && (
				<ProjetoEquipePanel
					projetoId={projeto.id}
					gerenteNome={projeto.gerente_nome}
					podeGerenciar={podeGerenciarEquipe}
				/>
			)}

			{editando && (
				<ProjetoModal
					projeto={projeto}
					tiposServicoAtuais={tiposServico}
					onClose={() => setEditando(false)}
					onSaved={handleSaved}
				/>
			)}
		</div>
	);
}

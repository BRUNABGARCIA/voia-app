import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../contexts/useAuth";
import Tabs from "../components/Tabs";
import ProgressoBar from "../components/ProgressoBar";
import CronogramaPanel from "../components/CronogramaPanel";
import DocumentosPanel from "../components/DocumentosPanel";
import ObraRdoPanel from "../components/ObraRdoPanel";
import ObraFotosPanel from "../components/ObraFotosPanel";
import ObraOcorrenciasPanel from "../components/ObraOcorrenciasPanel";
import { formatarData } from "../lib/projeto-tipos";
import { STATUS_OBRA, STATUS_OBRA_BADGE, STATUS_OBRA_LABEL, type Obra } from "../lib/obra-tipos";

const PERFIS_QUE_GERENCIAM = ["administrador", "gestor"];
const PERFIS_QUE_EDITAM = ["administrador", "gestor", "colaborador"];

const ABAS = [
	{ key: "resumo", label: "Resumo" },
	{ key: "rdo", label: "Diário de Obra" },
	{ key: "cronograma", label: "Cronograma" },
	{ key: "fotos", label: "Fotos" },
	{ key: "documentos", label: "Documentos" },
	{ key: "ocorrencias", label: "Ocorrências" },
];

export default function ObraWorkspace() {
	const { id } = useParams<{ id: string }>();
	const { user } = useAuth();
	const navigate = useNavigate();

	const [obra, setObra] = useState<Obra | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [aba, setAba] = useState("resumo");
	const [editando, setEditando] = useState(false);

	const podeGerenciar = user ? PERFIS_QUE_GERENCIAM.includes(user.perfil) : false;
	const podeEditar = user ? PERFIS_QUE_EDITAM.includes(user.perfil) : false;

	const carregar = useCallback(() => {
		fetch(`/api/obras/${id}`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("obra não encontrada");
				return res.json() as Promise<{ obra: Obra }>;
			})
			.then((data) => setObra(data.obra))
			.catch(() => setError("Não foi possível carregar esta obra."));
	}, [id]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	async function salvarCampo(campo: string, valor: unknown) {
		const res = await fetch(`/api/obras/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({ [campo]: valor }),
		});
		if (res.ok) {
			const { obra: atualizado } = (await res.json()) as { obra: Obra };
			setObra(atualizado);
		}
	}

	if (error) return <p className="text-sm text-voia-danger">{error}</p>;
	if (!obra) return <p className="text-sm text-voia-neutral-500">Carregando…</p>;

	return (
		<div>
			<button
				type="button"
				onClick={() => navigate("/obras")}
				className="text-sm font-medium text-voia-neutral-500 hover:text-voia-neutral-900"
			>
				← Obras
			</button>

			<div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="font-display text-2xl font-light text-voia-neutral-900 break-words">{obra.nome}</h1>
						<span className={`rounded-control px-2 py-1 text-xs font-medium ${STATUS_OBRA_BADGE[obra.status]}`}>
							{STATUS_OBRA_LABEL[obra.status]}
						</span>
					</div>
					<p className="mt-1 text-sm text-voia-neutral-700">
						Projeto:{" "}
						<Link to={`/projetos/${obra.projeto_id}`} className="font-medium text-voia-green-800 hover:underline">
							{obra.projeto_nome}
						</Link>{" "}
						· {obra.cliente_nome}
					</p>
				</div>
				{podeGerenciar && (
					<button
						type="button"
						onClick={() => setEditando((v) => !v)}
						className="rounded-control border border-voia-neutral-100 px-4 py-2 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						{editando ? "Concluir edição" : "Editar"}
					</button>
				)}
			</div>

			<div className="mt-6">
				<Tabs abas={ABAS} ativa={aba} onChange={setAba} />
			</div>

			{aba === "resumo" && (
				<div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
					<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card sm:col-span-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Progresso (manual)</span>
							{editando ? (
								<input
									type="number"
									min={0}
									max={100}
									defaultValue={obra.progresso}
									onBlur={(e) => salvarCampo("progresso", Number(e.target.value))}
									className="w-20 rounded-control border border-voia-neutral-100 px-2 py-1 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
								/>
							) : (
								<span className="text-sm font-medium text-voia-neutral-900">{obra.progresso}%</span>
							)}
						</div>
						<div className="mt-2">
							<ProgressoBar valor={obra.progresso} />
						</div>
					</div>

					<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
						<h2 className="font-display text-lg text-voia-green-900">Dados da obra</h2>
						<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Endereço</span>
								<span className="text-sm text-voia-neutral-900">{obra.endereco || "—"}</span>
							</div>
							<div>
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Status</span>
								{editando ? (
									<select
										defaultValue={obra.status}
										onChange={(e) => salvarCampo("status", e.target.value)}
										className="mt-1 w-full rounded-control border border-voia-neutral-100 px-2 py-1 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
									>
										{STATUS_OBRA.map((s) => (
											<option key={s} value={s}>
												{STATUS_OBRA_LABEL[s]}
											</option>
										))}
									</select>
								) : (
									<span className="text-sm text-voia-neutral-900">{STATUS_OBRA_LABEL[obra.status]}</span>
								)}
							</div>
							<div>
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Responsável técnico</span>
								<span className="text-sm text-voia-neutral-900">{obra.responsavel_tecnico_nome || "—"}</span>
							</div>
							<div>
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Responsável operacional</span>
								<span className="text-sm text-voia-neutral-900">{obra.responsavel_operacional_nome || "—"}</span>
							</div>
						</div>
					</div>

					<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
						<h2 className="font-display text-lg text-voia-green-900">Prazos</h2>
						<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Início previsto</span>
								<span className="text-sm text-voia-neutral-900">{formatarData(obra.data_inicio_prevista)}</span>
							</div>
							<div>
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
									Término previsto
									{obra.atrasada ? <span className="ml-1 font-medium text-voia-danger">(atrasada)</span> : null}
								</span>
								<span className="text-sm text-voia-neutral-900">{formatarData(obra.data_fim_prevista)}</span>
							</div>
							<div>
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Início real</span>
								<span className="text-sm text-voia-neutral-900">{formatarData(obra.data_inicio_real)}</span>
							</div>
							<div>
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Término real</span>
								<span className="text-sm text-voia-neutral-900">{formatarData(obra.data_fim_real)}</span>
							</div>
						</div>
					</div>

					{obra.observacoes && (
						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card sm:col-span-2">
							<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Observações operacionais</span>
							<p className="mt-1 whitespace-pre-wrap text-sm text-voia-neutral-900">{obra.observacoes}</p>
						</div>
					)}
				</div>
			)}

			{aba === "rdo" && <ObraRdoPanel obraId={obra.id} podeEditar={podeEditar} podeExcluir={podeGerenciar} />}
			{aba === "cronograma" && <CronogramaPanel projetoId={obra.projeto_id} obraId={obra.id} podeEditar={podeEditar} podeExcluir={podeGerenciar} onSaved={carregar} />}
			{aba === "fotos" && <ObraFotosPanel obraId={obra.id} podeEditar={podeEditar} podeExcluir={podeGerenciar} />}
			{aba === "documentos" && <DocumentosPanel projetoId={obra.projeto_id} podeEditar={podeEditar} podeExcluir={podeGerenciar} />}
			{aba === "ocorrencias" && <ObraOcorrenciasPanel obraId={obra.id} podeEditar={podeEditar} />}
		</div>
	);
}

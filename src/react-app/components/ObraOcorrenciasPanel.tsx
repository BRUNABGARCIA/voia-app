import AcaoIcone from './AcaoIcone';
import OcorrenciaEditor from './OcorrenciaEditor';
import { useCallback, useEffect, useState } from "react";
import { PRIORIDADE_BADGE, PRIORIDADE_LABEL, formatarData } from "../lib/projeto-tipos";
import {
	CATEGORIAS_OCORRENCIA,
	CATEGORIA_OCORRENCIA_LABEL,
	STATUS_OCORRENCIA_BADGE,
	STATUS_OCORRENCIA_LABEL,
	type Ocorrencia,
} from "../lib/obra-tipos";

interface UsuarioOpcao {
	id: number;
	nome: string;
}

export default function ObraOcorrenciasPanel({ obraId, podeEditar }: { obraId: number; podeEditar: boolean }) {
	const [ocorrencias, setOcorrencias] = useState<Ocorrencia[] | null>(null);
	const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);
    const [editando,setEditando]=useState<number|null>(null);
	const [titulo, setTitulo] = useState("");
	const [categoria, setCategoria] = useState("execucao");
	const [prioridade, setPrioridade] = useState("normal");
	const [descricao, setDescricao] = useState("");

	const carregar = useCallback(() => {
		fetch(`/api/obras/${obraId}/ocorrencias`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<{ ocorrencias: Ocorrencia[] }>;
			})
			.then((data) => setOcorrencias(data.ocorrencias))
			.catch(() => setError("Não foi possível carregar as ocorrências."));
	}, [obraId]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	useEffect(() => {
		if (!podeEditar) return;
		fetch(`/api/obras/${obraId}`, { credentials: "same-origin" })
            .then(async r=>{if(!r.ok)throw Error();const d=await r.json();const m=await fetch(`/api/projetos/${d.obra.projeto_id}/membros`,{credentials:'same-origin'});if(!m.ok)throw Error();return m.json();})
            .then((d:{membros:{usuario_id:number;nome:string}[]})=>setUsuarios(d.membros.map(m=>({id:m.usuario_id,nome:m.nome}))))
			.catch(() => {});
	}, [podeEditar,obraId]);

	async function criar() {
		if (titulo.trim().length === 0) {
			setError("Informe um título para a ocorrência.");
			return;
		}
		setError(null);
		try {
			const res = await fetch(`/api/obras/${obraId}/ocorrencias`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ titulo, categoria, prioridade, descricao: descricao || null }),
			});
			if (!res.ok) throw new Error();
			setTitulo("");
			setDescricao("");
			setCriando(false);
			carregar();
		} catch {
			setError("Não foi possível abrir a ocorrência.");
		}
	}

	async function atualizar(id: number, dados: Record<string, unknown>) {
		try {
			const res = await fetch(`/api/obras/${obraId}/ocorrencias/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(dados),
			});
			if (!res.ok) throw new Error();
			carregar();
		} catch {
			setError("Não foi possível atualizar a ocorrência.");
		}
	}

	return (
		<div className="mt-6 space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="font-display text-lg text-voia-green-900">Ocorrências e pendências</h2>
				{podeEditar && !criando && (
					<button
						type="button"
						onClick={() => setCriando(true)}
						className="rounded-control bg-voia-gold-500 px-3 py-1.5 text-sm font-medium text-voia-green-950 hover:bg-voia-gold-400"
					>
						+ Abrir ocorrência
					</button>
				)}
			</div>

			{criando && (
				<div className="space-y-3 rounded-card border border-voia-neutral-100 bg-voia-beige-50 p-(--space-card)">
					<input
						type="text"
						placeholder="Título da ocorrência"
						value={titulo}
						onChange={(e) => setTitulo(e.target.value)}
						className="w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<select
							value={categoria}
							onChange={(e) => setCategoria(e.target.value)}
							className="rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							{CATEGORIAS_OCORRENCIA.map((cat) => (
								<option key={cat} value={cat}>
									{CATEGORIA_OCORRENCIA_LABEL[cat]}
								</option>
							))}
						</select>
						<select
							value={prioridade}
							onChange={(e) => setPrioridade(e.target.value)}
							className="rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							<option value="baixa">Baixa</option>
							<option value="normal">Normal</option>
							<option value="alta">Alta</option>
							<option value="urgente">Urgente</option>
						</select>
					</div>
					<textarea
						placeholder="Descrição (opcional)"
						value={descricao}
						onChange={(e) => setDescricao(e.target.value)}
						rows={2}
						className="w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
					{error && <p className="text-sm text-voia-danger">{error}</p>}
					<div className="flex gap-2">
						<button
							type="button"
							onClick={criar}
							className="rounded-control bg-voia-gold-500 px-3 py-1.5 text-sm font-medium text-voia-green-950 hover:bg-voia-gold-400"
						>
							Abrir
						</button>
						<button
							type="button"
							onClick={() => {
								setCriando(false);
								setError(null);
							}}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700"
						>
							Cancelar
						</button>
					</div>
				</div>
			)}

			{!criando && error && <p className="text-sm text-voia-danger">{error}</p>}
			{!ocorrencias && <p className="text-sm text-voia-neutral-500">Carregando…</p>}
			{ocorrencias && ocorrencias.length === 0 && <p className="text-sm text-voia-neutral-500">Nenhuma ocorrência registrada.</p>}

			{ocorrencias && ocorrencias.length > 0 && (
				<ul className="space-y-2">
					{ocorrencias.map((oc) => (
						<li key={oc.id} className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<div className="flex flex-wrap items-start justify-between gap-2">
								<div>
									<span className="font-medium text-voia-neutral-900">{oc.titulo}</span>
									<span className="ml-2 rounded-control bg-voia-beige-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-700">
										{CATEGORIA_OCORRENCIA_LABEL[oc.categoria]}
									</span>
									<span className={`ml-2 rounded-control px-2 py-0.5 text-xs font-medium ${PRIORIDADE_BADGE[oc.prioridade]}`}>
										{PRIORIDADE_LABEL[oc.prioridade]}
									</span>
								</div>
								{podeEditar&&<AcaoIcone tipo="editar" title="Editar ocorrência" label={`Editar ocorrência ${oc.titulo}`} onClick={()=>setEditando(oc.id)}/>}<span className={`rounded-control px-2 py-0.5 text-xs font-medium ${STATUS_OCORRENCIA_BADGE[oc.status]}`}>
									{STATUS_OCORRENCIA_LABEL[oc.status]}
								</span>
							</div>
							{oc.descricao && <p className="mt-1 text-sm text-voia-neutral-700">{oc.descricao}</p>}
							<div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-voia-neutral-500">
								<span>
									{oc.responsavel_nome ? `Responsável: ${oc.responsavel_nome}` : "Sem responsável"} · Aberta por{" "}
									{oc.criado_por_nome ?? "—"} em {formatarData(oc.criado_em)}
								</span>
								{oc.resolvido_em && <span>Resolvida em {formatarData(oc.resolvido_em)}</span>}
							</div>
							{podeEditar && oc.status !== "resolvida" && oc.status !== "cancelada" && (
								<div className="mt-2 flex flex-wrap gap-2">
									{usuarios.length > 0 && (
										<select
											value={oc.responsavel_id ?? ""}
											onChange={(e) => atualizar(oc.id, { responsavel_id: e.target.value ? Number(e.target.value) : null })}
											className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs text-voia-neutral-900 outline-none focus:border-voia-gold-500"
										>
											<option value="">Atribuir a…</option>
											{usuarios.map((u) => (
												<option key={u.id} value={u.id}>
													{u.nome}
												</option>
											))}
										</select>
									)}
									{oc.status === "aberta" && (
										<button
											type="button"
											onClick={() => atualizar(oc.id, { status: "em_tratamento" })}
											className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
										>
											Iniciar tratamento
										</button>
									)}
									<button
										type="button"
										onClick={() => atualizar(oc.id, { status: "resolvida" })}
										className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs font-medium text-voia-success hover:bg-voia-beige-100"
									>
										Marcar resolvida
									</button>
									<button
										type="button"
										onClick={() => atualizar(oc.id, { status: "cancelada" })}
										className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs font-medium text-voia-danger hover:bg-voia-beige-100"
									>
										Cancelar
									</button>
								</div>
							)}
                            {editando===oc.id&&<OcorrenciaEditor obraId={obraId} ocorrencia={oc} usuarios={usuarios} onCancel={()=>setEditando(null)} onSaved={()=>{setEditando(null);carregar();}}/>}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

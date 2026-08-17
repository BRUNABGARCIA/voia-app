import { useCallback, useEffect, useState } from "react";
import DocumentoModal from "./DocumentoModal";
import { CATEGORIAS_DOCUMENTO, CATEGORIA_DOCUMENTO_LABEL, type Documento, type Etapa } from "../lib/projeto-tipos";

function formatarDataHora(valor: string): string {
	const data = new Date(valor.includes("T") ? valor : `${valor.replace(" ", "T")}Z`);
	if (Number.isNaN(data.getTime())) return valor;
	return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function DocumentosPanel({
	projetoId,
	podeEditar,
	podeExcluir,
}: {
	projetoId: number;
	podeEditar: boolean;
	podeExcluir: boolean;
}) {
	const [documentos, setDocumentos] = useState<Documento[] | null>(null);
	const [etapas, setEtapas] = useState<Etapa[]>([]);
	const [categoriaFiltro, setCategoriaFiltro] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);
	const [editando, setEditando] = useState<Documento | null>(null);
	const [removendoId, setRemovendoId] = useState<number | null>(null);

	const carregar = useCallback(() => {
		const params = categoriaFiltro ? `?categoria=${categoriaFiltro}` : "";
		fetch(`/api/projetos/${projetoId}/documentos${params}`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar os documentos");
				return res.json() as Promise<{ documentos: Documento[] }>;
			})
			.then((data) => setDocumentos(data.documentos))
			.catch(() => setError("Não foi possível carregar os documentos."));
	}, [projetoId, categoriaFiltro]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	// Só para alimentar o seletor "Etapa relacionada" do modal — lista
	// independente da aba Etapas e Tarefas, mesma régua de cada painel
	// buscar o que precisa (ex.: TarefaModal já faz o mesmo com membros).
	useEffect(() => {
		fetch(`/api/projetos/${projetoId}/etapas`, { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ etapas: Etapa[] }>) : null))
			.then((data) => data && setEtapas(data.etapas))
			.catch(() => {});
	}, [projetoId]);

	function handleSaved() {
		setCriando(false);
		setEditando(null);
		carregar();
	}

	async function remover(documento: Documento) {
		if (!window.confirm(`Remover o registro do documento "${documento.nome}"?`)) return;
		setError(null);
		setRemovendoId(documento.id);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/documentos/${documento.id}`, {
				method: "DELETE",
				credentials: "same-origin",
			});
			if (!res.ok) throw new Error("não foi possível remover o documento");
			carregar();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível remover o documento");
		} finally {
			setRemovendoId(null);
		}
	}

	return (
		<div className="mt-6 space-y-4">
			<p className="rounded-control border border-voia-neutral-100 bg-voia-beige-50 px-3 py-2 text-xs text-voia-neutral-700">
				O armazenamento de arquivos (Cloudflare R2) ainda não está configurado nesta instância — os documentos abaixo
				guardam só metadados (nome, categoria, visibilidade). Anexar e baixar arquivos será habilitado quando o
				armazenamento for conectado.
			</p>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<select
					value={categoriaFiltro}
					onChange={(e) => setCategoriaFiltro(e.target.value)}
					className="rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
				>
					<option value="">Todas as categorias</option>
					{CATEGORIAS_DOCUMENTO.map((cat) => (
						<option key={cat} value={cat}>
							{CATEGORIA_DOCUMENTO_LABEL[cat]}
						</option>
					))}
				</select>
				{podeEditar && (
					<button
						type="button"
						onClick={() => setCriando(true)}
						className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						+ Registrar documento
					</button>
				)}
			</div>

			{error && <p className="text-sm text-voia-danger">{error}</p>}

			{!documentos && !error && <p className="text-sm text-voia-neutral-500">Carregando…</p>}

			{documentos && documentos.length === 0 && (
				<p className="text-sm text-voia-neutral-500">Nenhum documento registrado ainda.</p>
			)}

			{documentos && documentos.length > 0 && (
				<ul className="space-y-2">
					{documentos.map((doc) => (
						<li
							key={doc.id}
							className="flex flex-col gap-2 rounded-control border border-voia-neutral-100 bg-(--color-surface) p-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div className="flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-medium text-voia-neutral-900">{doc.nome}</span>
									<span className="rounded-control bg-voia-beige-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-700">
										{CATEGORIA_DOCUMENTO_LABEL[doc.categoria]}
									</span>
									{doc.visivel_cliente === 1 ? (
										<span className="rounded-control bg-voia-success/15 px-2 py-0.5 text-xs font-medium text-voia-success">
											Visível ao cliente
										</span>
									) : (
										<span className="rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
											Interna
										</span>
									)}
								</div>
								{doc.descricao && <p className="mt-1 text-sm text-voia-neutral-700">{doc.descricao}</p>}
								<p className="mt-1 text-xs text-voia-neutral-500">
									{formatarDataHora(doc.criado_em)}
									{doc.autor_nome && ` · ${doc.autor_nome}`}
									{doc.etapa_nome && ` · ${doc.etapa_nome}`}
								</p>
							</div>
							{podeEditar && (
								<div className="flex shrink-0 items-center gap-3">
									<button
										type="button"
										onClick={() => setEditando(doc)}
										className="text-xs font-medium text-voia-green-800 hover:underline"
									>
										Editar
									</button>
									{podeExcluir && (
										<button
											type="button"
											onClick={() => remover(doc)}
											disabled={removendoId === doc.id}
											className="text-xs font-medium text-voia-danger hover:underline disabled:opacity-(--opacity-disabled)"
										>
											Remover
										</button>
									)}
								</div>
							)}
						</li>
					))}
				</ul>
			)}

			{criando && (
				<DocumentoModal projetoId={projetoId} etapas={etapas} documento={null} onClose={() => setCriando(false)} onSaved={handleSaved} />
			)}
			{editando && (
				<DocumentoModal
					projetoId={projetoId}
					etapas={etapas}
					documento={editando}
					onClose={() => setEditando(null)}
					onSaved={handleSaved}
				/>
			)}
		</div>
	);
}

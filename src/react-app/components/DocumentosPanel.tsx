import DocumentosEsperadosChecklist from './DocumentosEsperadosChecklist';
import { ESTADO_DOCUMENTO_LABEL } from '../../shared/operacao-voia';
import { useCallback, useEffect, useState } from "react";
import DocumentoModal from "./DocumentoModal";
import {
	CATEGORIAS_DOCUMENTO,
	CATEGORIA_DOCUMENTO_LABEL,
	formatarTamanhoArquivo,
	type Documento,
	type Etapa,
} from "../lib/projeto-tipos";
import { baixarArquivo } from "../lib/download";

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
	const [criandoEsperado,setCriandoEsperado]=useState(false);
	const [criando, setCriando] = useState(false);
	const [editando, setEditando] = useState<Documento | null>(null);
	const [removendoId, setRemovendoId] = useState<number | null>(null);
	const [baixandoId, setBaixandoId] = useState<number | null>(null);

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
 setCriandoEsperado(false);
		setCriando(false);
		setEditando(null);
		carregar();
	}

	async function baixar(documento: Documento) {
		if (baixandoId !== null) return; // evita duplo clique disparar dois downloads
		setError(null);
		setBaixandoId(documento.id);
		try {
			await baixarArquivo(
				`/api/projetos/${projetoId}/documentos/${documento.id}/download`,
				documento.nome_arquivo_original ?? documento.nome,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível baixar o arquivo");
		} finally {
			setBaixandoId(null);
		}
	}

	async function remover(documento: Documento) {
		if (!window.confirm(`Remover o documento "${documento.nome}"? O registro e o arquivo armazenado serão excluídos. Referências a este documento serão desvinculadas; registros relacionados serão preservados. Esta ação não pode ser desfeita.`)) return;
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
		<div className="mt-6 space-y-4"><DocumentosEsperadosChecklist projetoId={projetoId} documentos={(documentos||[]).filter(d=>d.esperado===1)} podeGerenciar={podeExcluir} podeEditar={podeEditar} editar={setEditando} remover={remover} adicionar={()=>setCriandoEsperado(true)} atualizar={carregar}/><h3 className="font-semibold">Documentos registrados</h3>
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
					{documentos.filter(d=>d.esperado!==1).map((doc) => (
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
									{/* Interno/Parceiro/Cliente são independentes (visivel_cliente e
									visivel_parceiro são colunas separadas) — "Interno" só aparece
									quando NENHuma das duas está marcada, para nunca contradizer um
									selo de "Visível a..." ao lado (ambiguidade explicitamente
									proibida nesta rodada). */}
									{doc.visivel_cliente !== 1 && doc.visivel_parceiro !== 1 && (
										<span className="rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
											Interno
										</span>
									)}
									{doc.visivel_cliente === 1 && (
										<span className="rounded-control bg-voia-success/15 px-2 py-0.5 text-xs font-medium text-voia-success">
											Visível ao Cliente
										</span>
									)}
									{doc.visivel_parceiro === 1 && (
										<span className="rounded-control bg-voia-gold-500/15 px-2 py-0.5 text-xs font-medium text-voia-gold-500">
											Visível ao Parceiro
										</span>
									)}
								</div>
								{doc.esperado === 1 && <p className="mt-2 text-sm font-medium">Documento esperado · {doc.estado_documental ? ESTADO_DOCUMENTO_LABEL[doc.estado_documental] : 'Não informado'} · Prazo: {doc.prazo || 'Não informado'}</p>}
                {doc.descricao && <p className="mt-1 text-sm text-voia-neutral-700">{doc.descricao}</p>}
								<p className="mt-1 text-xs text-voia-neutral-500">
									{formatarDataHora(doc.criado_em)}
									{doc.autor_nome && ` · ${doc.autor_nome}`}
									{doc.etapa_nome && ` · ${doc.etapa_nome}`}
								</p>
								<p className="mt-1 text-xs text-voia-neutral-500">
									{doc.possui_arquivo === 1 ? (
										<>
											{doc.nome_arquivo_original}
											{doc.tamanho_bytes ? ` · ${formatarTamanhoArquivo(doc.tamanho_bytes)}` : ""}
										</>
									) : (
										"Arquivo não anexado"
									)}
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-3">
								{doc.possui_arquivo === 1 && (
									<button
										type="button"
										onClick={() => baixar(doc)}
										disabled={baixandoId === doc.id}
										className="text-xs font-medium text-voia-green-800 hover:underline disabled:opacity-(--opacity-disabled)"
									>
										{baixandoId === doc.id ? "Baixando…" : "Baixar"}
									</button>
								)}
								{podeEditar && (
									<>
										<button
											type="button"
											onClick={() => setEditando(doc)}
											className="text-xs font-medium text-voia-green-800 hover:underline"
										>
											{doc.esperado === 1 && doc.possui_arquivo !== 1 ? 'Revisar / Fazer upload' : 'Editar'}
										</button>
										{podeExcluir && (
											<details className="text-xs"><summary aria-label={`Ações de ${doc.nome}`} className="cursor-pointer">...</summary><button
												type="button"
												onClick={() => remover(doc)}
												disabled={removendoId === doc.id}
												className="text-xs font-medium text-voia-danger hover:underline disabled:opacity-(--opacity-disabled)"
											>
												Remover
											</button></details>
										)}
									</>
								)}
							</div>
						</li>
					))}
				</ul>
			)}

			{(criando || criandoEsperado) && (
				<DocumentoModal projetoId={projetoId} etapas={etapas} documento={null} esperadoInicial={criandoEsperado} onClose={() => {setCriando(false);setCriandoEsperado(false);}} onSaved={handleSaved} />
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

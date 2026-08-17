import { useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import {
	CATEGORIAS_DOCUMENTO,
	CATEGORIA_DOCUMENTO_LABEL,
	formatarTamanhoArquivo,
	type Documento,
	type Etapa,
} from "../lib/projeto-tipos";

// Mesma lista aceita pelo backend (src/worker/storage/documentos.ts) — só
// para dar feedback imediato ao usuário; a validação que vale de verdade
// (tamanho real, assinatura de bytes) acontece sempre no servidor.
const EXTENSOES_ACEITAS = ["pdf", "dwg", "dxf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png", "zip"];
const TAMANHO_MAXIMO_MB = 20;

interface FormState {
	nome: string;
	categoria: string;
	etapa_id: string;
	descricao: string;
	visivel_cliente: boolean;
}

function documentoParaForm(documento: Documento | null): FormState {
	return {
		nome: documento?.nome ?? "",
		categoria: documento?.categoria ?? "outros",
		etapa_id: documento?.etapa_id ? String(documento.etapa_id) : "",
		descricao: documento?.descricao ?? "",
		visivel_cliente: documento ? documento.visivel_cliente === 1 : false,
	};
}

function extensaoValida(nomeArquivo: string): boolean {
	const partes = nomeArquivo.toLowerCase().split(".");
	const extensao = partes.length > 1 ? partes[partes.length - 1] : "";
	return EXTENSOES_ACEITAS.includes(extensao);
}

export default function DocumentoModal({
	projetoId,
	etapas,
	documento,
	onClose,
	onSaved,
}: {
	projetoId: number;
	etapas: Etapa[];
	documento: Documento | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const editando = documento !== null;
	const [form, setForm] = useState<FormState>(() => documentoParaForm(documento));
	const [arquivo, setArquivo] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const [arquivoSubstituto, setArquivoSubstituto] = useState<File | null>(null);
	const [enviandoArquivo, setEnviandoArquivo] = useState(false);
	const [erroArquivo, setErroArquivo] = useState<string | null>(null);

	function set<K extends keyof FormState>(campo: K) {
		return (valor: FormState[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));
	}

	function selecionarArquivo(file: File | null) {
		setError(null);
		if (file && !extensaoValida(file.name)) {
			setError(`Formato não permitido. Aceitos: ${EXTENSOES_ACEITAS.join(", ").toUpperCase()}.`);
			return;
		}
		if (file && file.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
			setError(`O arquivo excede o limite de ${TAMANHO_MAXIMO_MB} MB.`);
			return;
		}
		setArquivo(file);
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (form.nome.trim().length === 0) {
			setError("O nome do documento é obrigatório.");
			return;
		}

		setSubmitting(true);
		try {
			if (editando) {
				const payload = {
					nome: form.nome,
					categoria: form.categoria,
					etapa_id: form.etapa_id ? Number(form.etapa_id) : null,
					descricao: form.descricao || null,
					visivel_cliente: form.visivel_cliente,
				};
				const res = await fetch(`/api/projetos/${projetoId}/documentos/${documento.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify(payload),
				});
				if (!res.ok) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null;
					throw new Error(body?.error ?? "não foi possível salvar o documento");
				}
			} else {
				const dados = new FormData();
				dados.set("nome", form.nome);
				dados.set("categoria", form.categoria);
				if (form.etapa_id) dados.set("etapa_id", form.etapa_id);
				if (form.descricao) dados.set("descricao", form.descricao);
				dados.set("visivel_cliente", form.visivel_cliente ? "true" : "false");
				if (arquivo) dados.set("arquivo", arquivo);

				const res = await fetch(`/api/projetos/${projetoId}/documentos`, {
					method: "POST",
					credentials: "same-origin",
					body: dados,
				});
				if (!res.ok) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null;
					throw new Error(body?.error ?? "não foi possível salvar o documento");
				}
			}

			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar o documento");
		} finally {
			setSubmitting(false);
		}
	}

	async function enviarArquivoSubstituto() {
		if (!documento || !arquivoSubstituto) return;
		setErroArquivo(null);
		setEnviandoArquivo(true);
		try {
			const dados = new FormData();
			dados.set("arquivo", arquivoSubstituto);
			const res = await fetch(`/api/projetos/${projetoId}/documentos/${documento.id}/arquivo`, {
				method: "POST",
				credentials: "same-origin",
				body: dados,
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível enviar o arquivo");
			}
			onSaved();
		} catch (err) {
			setErroArquivo(err instanceof Error ? err.message : "não foi possível enviar o arquivo");
		} finally {
			setEnviandoArquivo(false);
		}
	}

	return (
		<ModalShell
			title={editando ? "Editar documento" : "Registrar documento"}
			onClose={onClose}
			onSubmit={handleSubmit}
			maxWidthClassName="max-w-lg"
			footer={
				<>
					<button
						type="button"
						onClick={onClose}
						className="rounded-control border border-voia-neutral-100 px-4 py-2 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={submitting}
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
					>
						{submitting ? "Salvando…" : editando ? "Salvar alterações" : "Registrar"}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				{!editando && (
					<div>
						<label htmlFor="documento-arquivo" className="block text-sm font-medium text-voia-neutral-900">
							Arquivo (opcional)
						</label>
						<input
							id="documento-arquivo"
							type="file"
							accept={EXTENSOES_ACEITAS.map((ext) => `.${ext}`).join(",")}
							onChange={(e) => selecionarArquivo(e.target.files?.[0] ?? null)}
							className="mt-1 w-full text-sm text-voia-neutral-700 file:mr-3 file:rounded-control file:border file:border-voia-neutral-100 file:bg-voia-beige-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-voia-neutral-700 hover:file:bg-voia-beige-100"
						/>
						<p className="mt-1 text-xs text-voia-neutral-500">
							Formatos aceitos: {EXTENSOES_ACEITAS.join(", ").toUpperCase()}. Até {TAMANHO_MAXIMO_MB} MB. Pode ser
							anexado depois, se preferir registrar só os dados agora.
						</p>
					</div>
				)}

				{editando && documento && (
					<div className="rounded-control border border-voia-neutral-100 bg-voia-beige-50 p-3">
						<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Arquivo</span>
						{documento.possui_arquivo === 1 ? (
							<p className="mt-1 text-sm text-voia-neutral-900">
								{documento.nome_arquivo_original}
								{documento.tamanho_bytes ? ` · ${formatarTamanhoArquivo(documento.tamanho_bytes)}` : ""}
							</p>
						) : (
							<p className="mt-1 text-sm text-voia-neutral-500">Arquivo não anexado.</p>
						)}
						<div className="mt-2 flex flex-wrap items-center gap-2">
							<input
								id="documento-arquivo-substituto"
								type="file"
								accept={EXTENSOES_ACEITAS.map((ext) => `.${ext}`).join(",")}
								onChange={(e) => setArquivoSubstituto(e.target.files?.[0] ?? null)}
								className="text-xs text-voia-neutral-700 file:mr-2 file:rounded-control file:border file:border-voia-neutral-100 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium file:text-voia-neutral-700 hover:file:bg-voia-beige-100"
							/>
							<button
								type="button"
								disabled={!arquivoSubstituto || enviandoArquivo}
								onClick={enviarArquivoSubstituto}
								className="rounded-control border border-voia-neutral-100 px-3 py-1 text-xs font-medium text-voia-neutral-700 hover:bg-voia-beige-100 disabled:opacity-(--opacity-disabled)"
							>
								{enviandoArquivo ? "Enviando…" : documento.possui_arquivo === 1 ? "Substituir arquivo" : "Anexar arquivo"}
							</button>
						</div>
						{erroArquivo && <p className="mt-1 text-xs text-voia-danger">{erroArquivo}</p>}
					</div>
				)}

				<div>
					<label htmlFor="documento-nome" className="block text-sm font-medium text-voia-neutral-900">
						Nome
					</label>
					<input
						id="documento-nome"
						type="text"
						value={form.nome}
						maxLength={200}
						onChange={(e) => set("nome")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="documento-categoria" className="block text-sm font-medium text-voia-neutral-900">
							Categoria
						</label>
						<select
							id="documento-categoria"
							value={form.categoria}
							onChange={(e) => set("categoria")(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							{CATEGORIAS_DOCUMENTO.map((cat) => (
								<option key={cat} value={cat}>
									{CATEGORIA_DOCUMENTO_LABEL[cat]}
								</option>
							))}
						</select>
					</div>
					<div>
						<label htmlFor="documento-etapa" className="block text-sm font-medium text-voia-neutral-900">
							Etapa relacionada
						</label>
						<select
							id="documento-etapa"
							value={form.etapa_id}
							onChange={(e) => set("etapa_id")(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							<option value="">Nenhuma</option>
							{etapas.map((etapa) => (
								<option key={etapa.id} value={etapa.id}>
									{etapa.nome}
								</option>
							))}
						</select>
					</div>
				</div>
				<div>
					<label htmlFor="documento-descricao" className="block text-sm font-medium text-voia-neutral-900">
						Descrição
					</label>
					<textarea
						id="documento-descricao"
						value={form.descricao}
						onChange={(e) => set("descricao")(e.target.value)}
						rows={2}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<label className="flex items-center gap-2 text-sm font-medium text-voia-neutral-900">
					<input
						type="checkbox"
						checked={form.visivel_cliente}
						onChange={(e) => set("visivel_cliente")(e.target.checked)}
						className="h-4 w-4 rounded border-voia-neutral-100 text-voia-gold-500 focus:ring-voia-gold-500"
					/>
					Visível ao cliente no Portal
				</label>

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

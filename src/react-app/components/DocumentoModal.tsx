import { useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import { CATEGORIAS_DOCUMENTO, CATEGORIA_DOCUMENTO_LABEL, type Documento, type Etapa } from "../lib/projeto-tipos";

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
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	function set<K extends keyof FormState>(campo: K) {
		return (valor: FormState[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));
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
			const payload = {
				nome: form.nome,
				categoria: form.categoria,
				etapa_id: form.etapa_id ? Number(form.etapa_id) : null,
				descricao: form.descricao || null,
				visivel_cliente: form.visivel_cliente,
			};

			const url = editando
				? `/api/projetos/${projetoId}/documentos/${documento.id}`
				: `/api/projetos/${projetoId}/documentos`;

			const res = await fetch(url, {
				method: editando ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar o documento");
			}

			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar o documento");
		} finally {
			setSubmitting(false);
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
				<p className="rounded-control bg-voia-beige-100 px-3 py-2 text-xs text-voia-neutral-700">
					O armazenamento de arquivos ainda não está configurado nesta instância — este registro guarda só os dados do
					documento (nome, categoria, visibilidade). O anexo do arquivo será habilitado quando o armazenamento for
					conectado.
				</p>
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

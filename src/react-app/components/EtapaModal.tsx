import { useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import { STATUS_ETAPA, STATUS_ETAPA_LABEL, type Etapa } from "../lib/projeto-tipos";

interface FormState {
	nome: string;
	descricao: string;
	status: string;
	data_inicio: string;
	prazo: string;
}

function etapaParaForm(etapa: Etapa | null): FormState {
	return {
		nome: etapa?.nome ?? "",
		descricao: etapa?.descricao ?? "",
		status: etapa?.status ?? "pendente",
		data_inicio: etapa?.data_inicio ?? "",
		prazo: etapa?.prazo ?? "",
	};
}

export default function EtapaModal({
	projetoId,
	etapa,
	onClose,
	onSaved,
}: {
	projetoId: number;
	etapa: Etapa | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const editando = etapa !== null;
	const [form, setForm] = useState<FormState>(() => etapaParaForm(etapa));
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	function set<K extends keyof FormState>(campo: K) {
		return (valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }));
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (form.nome.trim().length === 0) {
			setError("O nome da etapa é obrigatório.");
			return;
		}

		setSubmitting(true);
		try {
			const payload = {
				nome: form.nome,
				descricao: form.descricao || null,
				status: form.status,
				data_inicio: form.data_inicio || null,
				prazo: form.prazo || null,
			};

			const url = editando ? `/api/projetos/${projetoId}/etapas/${etapa.id}` : `/api/projetos/${projetoId}/etapas`;

			const res = await fetch(url, {
				method: editando ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar a etapa");
			}

			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar a etapa");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title={editando ? "Editar etapa" : "Nova etapa"}
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
						{submitting ? "Salvando…" : editando ? "Salvar alterações" : "Criar etapa"}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				<div>
					<label htmlFor="etapa-nome" className="block text-sm font-medium text-voia-neutral-900">
						Nome
					</label>
					<input
						id="etapa-nome"
						type="text"
						value={form.nome}
						maxLength={200}
						onChange={(e) => set("nome")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="etapa-descricao" className="block text-sm font-medium text-voia-neutral-900">
						Descrição
					</label>
					<textarea
						id="etapa-descricao"
						value={form.descricao}
						onChange={(e) => set("descricao")(e.target.value)}
						rows={3}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="etapa-status" className="block text-sm font-medium text-voia-neutral-900">
						Status
					</label>
					<select
						id="etapa-status"
						value={form.status}
						onChange={(e) => set("status")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					>
						{STATUS_ETAPA.map((s) => (
							<option key={s} value={s}>
								{STATUS_ETAPA_LABEL[s]}
							</option>
						))}
					</select>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="etapa-inicio" className="block text-sm font-medium text-voia-neutral-900">
							Data de início
						</label>
						<input
							id="etapa-inicio"
							type="date"
							value={form.data_inicio}
							onChange={(e) => set("data_inicio")(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					<div>
						<label htmlFor="etapa-prazo" className="block text-sm font-medium text-voia-neutral-900">
							Prazo
						</label>
						<input
							id="etapa-prazo"
							type="date"
							value={form.prazo}
							onChange={(e) => set("prazo")(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
				</div>

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

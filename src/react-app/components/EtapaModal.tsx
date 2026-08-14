import { useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import { STATUS_ETAPA, STATUS_ETAPA_LABEL, type Etapa } from "../lib/projeto-tipos";

interface FormState {
	nome: string;
	descricao: string;
	status: string;
	data_inicio_prevista: string;
	data_fim_prevista: string;
	data_inicio_real: string;
	observacao_interna: string;
	visivel_cliente: boolean;
}

function etapaParaForm(etapa: Etapa | null): FormState {
	return {
		nome: etapa?.nome ?? "",
		descricao: etapa?.descricao ?? "",
		status: etapa?.status ?? "pendente",
		data_inicio_prevista: etapa?.data_inicio_prevista ?? "",
		data_fim_prevista: etapa?.data_fim_prevista ?? "",
		data_inicio_real: etapa?.data_inicio_real ?? "",
		observacao_interna: etapa?.observacao_interna ?? "",
		visivel_cliente: etapa ? etapa.visivel_cliente === 1 : true,
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
		return (valor: FormState[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));
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
				data_inicio_prevista: form.data_inicio_prevista || null,
				data_fim_prevista: form.data_fim_prevista || null,
				data_inicio_real: form.data_inicio_real || null,
				observacao_interna: form.observacao_interna || null,
				visivel_cliente: form.visivel_cliente,
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
						rows={2}
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
						<label htmlFor="etapa-inicio-previsto" className="block text-sm font-medium text-voia-neutral-900">
							Início previsto
						</label>
						<input
							id="etapa-inicio-previsto"
							type="date"
							value={form.data_inicio_prevista}
							onChange={(e) => set("data_inicio_prevista")(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					<div>
						<label htmlFor="etapa-prazo-previsto" className="block text-sm font-medium text-voia-neutral-900">
							Prazo previsto
						</label>
						<input
							id="etapa-prazo-previsto"
							type="date"
							value={form.data_fim_prevista}
							onChange={(e) => set("data_fim_prevista")(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
				</div>
				<div>
					<label htmlFor="etapa-inicio-real" className="block text-sm font-medium text-voia-neutral-900">
						Início real
					</label>
					<input
						id="etapa-inicio-real"
						type="date"
						value={form.data_inicio_real}
						onChange={(e) => set("data_inicio_real")(e.target.value)}
						className="mt-1 w-full max-w-[calc(50%-0.5rem)] rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
					<p className="mt-1 text-xs text-voia-neutral-500">
						A conclusão é registrada automaticamente quando o status muda para "Concluída".
					</p>
				</div>
				<div>
					<label htmlFor="etapa-observacao" className="block text-sm font-medium text-voia-neutral-900">
						Observação interna
					</label>
					<textarea
						id="etapa-observacao"
						value={form.observacao_interna}
						onChange={(e) => set("observacao_interna")(e.target.value)}
						rows={2}
						placeholder="Visível somente para a equipe, nunca para o cliente."
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

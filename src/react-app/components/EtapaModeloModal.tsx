import { useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import type { EtapaModelo } from "../lib/tipos-servico-tipos";

interface FormState {
	nome: string;
	descricao: string;
	prazo_dias: string;
	visivel_cliente: boolean;
	notificar_cliente: boolean;
}

function modeloParaForm(modelo: EtapaModelo | null): FormState {
	return {
		nome: modelo?.nome ?? "",
		descricao: modelo?.descricao ?? "",
		prazo_dias: modelo?.prazo_dias != null ? String(modelo.prazo_dias) : "",
		visivel_cliente: modelo ? modelo.visivel_cliente === 1 : true,
		notificar_cliente: modelo ? modelo.notificar_cliente === 1 : false,
	};
}

export default function EtapaModeloModal({
	tipoServicoId,
	modelo,
	onClose,
	onSaved,
}: {
	tipoServicoId: number;
	modelo: EtapaModelo | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const editando = modelo !== null;
	const [form, setForm] = useState<FormState>(() => modeloParaForm(modelo));
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

		let prazoDias: number | null = null;
		if (form.prazo_dias.trim()) {
			const valor = Number(form.prazo_dias);
			if (!Number.isInteger(valor) || valor < 0) {
				setError("Prazo em dias inválido.");
				return;
			}
			prazoDias = valor;
		}

		setSubmitting(true);
		try {
			const payload = {
				nome: form.nome,
				descricao: form.descricao || null,
				prazo_dias: prazoDias,
				visivel_cliente: form.visivel_cliente,
				notificar_cliente: form.notificar_cliente,
			};

			const url = editando
				? `/api/tipos-servico/${tipoServicoId}/modelo/${modelo.id}`
				: `/api/tipos-servico/${tipoServicoId}/modelo`;

			const res = await fetch(url, {
				method: editando ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar a etapa do modelo");
			}

			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar a etapa do modelo");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title={editando ? "Editar etapa padrão" : "Nova etapa padrão"}
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
					<label htmlFor="modelo-nome" className="block text-sm font-medium text-voia-neutral-900">
						Nome
					</label>
					<input
						id="modelo-nome"
						type="text"
						value={form.nome}
						maxLength={200}
						onChange={(e) => set("nome")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="modelo-descricao" className="block text-sm font-medium text-voia-neutral-900">
						Descrição
					</label>
					<textarea
						id="modelo-descricao"
						value={form.descricao}
						onChange={(e) => set("descricao")(e.target.value)}
						rows={2}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="modelo-prazo" className="block text-sm font-medium text-voia-neutral-900">
						Prazo padrão (dias corridos)
					</label>
					<input
						id="modelo-prazo"
						type="number"
						min={0}
						max={3650}
						value={form.prazo_dias}
						onChange={(e) => set("prazo_dias")(e.target.value)}
						placeholder="Sem prazo definido"
						className="mt-1 w-full max-w-[10rem] rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
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
				<label className="flex items-center gap-2 text-sm font-medium text-voia-neutral-900">
					<input
						type="checkbox"
						checked={form.notificar_cliente}
						onChange={(e) => set("notificar_cliente")(e.target.checked)}
						className="h-4 w-4 rounded border-voia-neutral-100 text-voia-gold-500 focus:ring-voia-gold-500"
					/>
					Notificar cliente quando esta etapa iniciar/concluir
				</label>
				<p className="text-xs text-voia-neutral-500">
					Nenhuma notificação é enviada nesta versão — a opção só prepara a estrutura para o envio futuro.
				</p>

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

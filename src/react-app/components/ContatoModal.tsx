import { useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import type { ContatoCliente } from "../lib/cliente-tipos";

interface FormState {
	nome: string;
	email: string;
	telefone: string;
	senha: string;
	ativo: boolean;
}

function contatoParaForm(contato: ContatoCliente | null): FormState {
	return {
		nome: contato?.nome ?? "",
		email: contato?.email ?? "",
		telefone: contato?.telefone ?? "",
		senha: "",
		ativo: contato ? contato.ativo === 1 : true,
	};
}

export default function ContatoModal({
	clienteId,
	contato,
	onClose,
	onSaved,
}: {
	clienteId: number;
	contato: ContatoCliente | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const editando = contato !== null;
	const [form, setForm] = useState<FormState>(() => contatoParaForm(contato));
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	function set<K extends keyof FormState>(campo: K) {
		return (valor: FormState[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (form.nome.trim().length === 0) {
			setError("O nome é obrigatório.");
			return;
		}
		if (form.senha && form.senha.length < 8) {
			setError("A senha precisa ter pelo menos 8 caracteres.");
			return;
		}

		setSubmitting(true);
		try {
			const payload: Record<string, unknown> = {
				nome: form.nome,
				email: form.email,
				telefone: form.telefone || null,
				ativo: form.ativo,
			};
			if (form.senha) payload.senha = form.senha;

			const url = editando ? `/api/clientes/${clienteId}/contatos/${contato.id}` : `/api/clientes/${clienteId}/contatos`;

			const res = await fetch(url, {
				method: editando ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar o contato");
			}

			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar o contato");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title={editando ? "Editar contato" : "Novo contato"}
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
						{submitting ? "Salvando…" : editando ? "Salvar alterações" : "Criar contato"}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				<div>
					<label htmlFor="contato-nome" className="block text-sm font-medium text-voia-neutral-900">
						Nome
					</label>
					<input
						id="contato-nome"
						type="text"
						value={form.nome}
						maxLength={200}
						onChange={(e) => set("nome")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="contato-email" className="block text-sm font-medium text-voia-neutral-900">
						E-mail (login do Portal)
					</label>
					<input
						id="contato-email"
						type="email"
						value={form.email}
						onChange={(e) => set("email")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="contato-telefone" className="block text-sm font-medium text-voia-neutral-900">
						Telefone
					</label>
					<input
						id="contato-telefone"
						type="text"
						value={form.telefone}
						maxLength={30}
						onChange={(e) => set("telefone")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="contato-senha" className="block text-sm font-medium text-voia-neutral-900">
						{editando ? "Nova senha (opcional)" : "Senha de acesso ao Portal"}
					</label>
					<input
						id="contato-senha"
						type="password"
						value={form.senha}
						onChange={(e) => set("senha")(e.target.value)}
						placeholder={editando ? "Deixe em branco para manter a atual" : "Mínimo 8 caracteres"}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
					{!editando && (
						<p className="mt-1 text-xs text-voia-neutral-500">
							Sem senha, o contato fica cadastrado mas não consegue entrar no Portal ainda.
						</p>
					)}
				</div>
				{editando && (
					<label className="flex items-center gap-2 text-sm font-medium text-voia-neutral-900">
						<input
							type="checkbox"
							checked={form.ativo}
							onChange={(e) => set("ativo")(e.target.checked)}
							className="h-4 w-4 rounded border-voia-neutral-100 text-voia-gold-500 focus:ring-voia-gold-500"
						/>
						Ativo
					</label>
				)}

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

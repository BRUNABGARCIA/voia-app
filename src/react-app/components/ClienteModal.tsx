import { useEffect, useState, type FormEvent } from "react";
import type { Cliente } from "../lib/cliente-tipos";

interface UsuarioOpcao {
	id: number;
	nome: string;
}

interface FormState {
	tipo: "PF" | "PJ";
	nome: string;
	nome_fantasia: string;
	documento: string;
	email: string;
	telefone: string;
	whatsapp: string;
	cep: string;
	logradouro: string;
	numero: string;
	complemento: string;
	bairro: string;
	cidade: string;
	estado: string;
	status: Cliente["status"];
	origem: string;
	responsavel_interno_id: string;
	observacoes: string;
}

function clienteParaForm(cliente: Cliente | null): FormState {
	return {
		tipo: cliente?.tipo ?? "PF",
		nome: cliente?.nome ?? "",
		nome_fantasia: cliente?.nome_fantasia ?? "",
		documento: cliente?.documento ?? "",
		email: cliente?.email ?? "",
		telefone: cliente?.telefone ?? "",
		whatsapp: cliente?.whatsapp ?? "",
		cep: cliente?.cep ?? "",
		logradouro: cliente?.logradouro ?? "",
		numero: cliente?.numero ?? "",
		complemento: cliente?.complemento ?? "",
		bairro: cliente?.bairro ?? "",
		cidade: cliente?.cidade ?? "",
		estado: cliente?.estado ?? "",
		status: cliente?.status ?? "lead",
		origem: cliente?.origem ?? "",
		responsavel_interno_id: cliente?.responsavel_interno_id ? String(cliente.responsavel_interno_id) : "",
		observacoes: cliente?.observacoes ?? "",
	};
}

function campo(
	label: string,
	id: keyof FormState,
	form: FormState,
	set: (v: string) => void,
	opts?: { max?: number; maiusculo?: boolean },
) {
	return (
		<div>
			<label htmlFor={id} className="block text-sm font-medium text-voia-neutral-900">
				{label}
			</label>
			<input
				id={id}
				type="text"
				value={form[id]}
				maxLength={opts?.max}
				onChange={(e) => set(opts?.maiusculo ? e.target.value.toUpperCase() : e.target.value)}
				className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
			/>
		</div>
	);
}

export default function ClienteModal({
	cliente,
	onClose,
	onSaved,
}: {
	cliente: Cliente | null;
	onClose: () => void;
	onSaved: (cliente: Cliente) => void;
}) {
	const editando = cliente !== null;
	const [form, setForm] = useState<FormState>(() => clienteParaForm(cliente));
	const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetch("/api/usuarios/opcoes", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ usuarios: UsuarioOpcao[] }>) : null))
			.then((data) => {
				if (data) setUsuarios(data.usuarios);
			})
			.catch(() => {
				/* seletor de responsável fica vazio; não é um campo obrigatório */
			});
	}, []);

	function set<K extends keyof FormState>(campo: K) {
		return (valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }));
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (form.nome.trim().length === 0) {
			setError("O nome é obrigatório.");
			return;
		}

		setSubmitting(true);
		try {
			const payload: Record<string, unknown> = {
				tipo: form.tipo,
				nome: form.nome,
				nome_fantasia: form.nome_fantasia || null,
				documento: form.documento || null,
				email: form.email || null,
				telefone: form.telefone || null,
				whatsapp: form.whatsapp || null,
				cep: form.cep || null,
				logradouro: form.logradouro || null,
				numero: form.numero || null,
				complemento: form.complemento || null,
				bairro: form.bairro || null,
				cidade: form.cidade || null,
				estado: form.estado ? form.estado.toUpperCase() : null,
				status: form.status,
				origem: form.origem || null,
				responsavel_interno_id: form.responsavel_interno_id ? Number(form.responsavel_interno_id) : null,
				observacoes: form.observacoes || null,
			};

			const res = await fetch(editando ? `/api/clientes/${cliente.id}` : "/api/clientes", {
				method: editando ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar o cliente");
			}

			const { cliente: salvo } = (await res.json()) as { cliente: Cliente };
			onSaved(salvo);
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar o cliente");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
			<div className="w-full max-w-2xl rounded-card bg-white p-(--space-card) shadow-elevated">
				<h2 className="font-display text-xl text-voia-green-900">{editando ? "Editar cliente" : "Novo cliente"}</h2>

				<form className="mt-6 space-y-6" onSubmit={handleSubmit} noValidate>
					<section>
						<h3 className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Identificação</h3>
						<div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<label htmlFor="tipo" className="block text-sm font-medium text-voia-neutral-900">
									Tipo
								</label>
								<select
									id="tipo"
									value={form.tipo}
									onChange={(e) => set("tipo")(e.target.value)}
									className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
								>
									<option value="PF">Pessoa Física</option>
									<option value="PJ">Pessoa Jurídica</option>
								</select>
							</div>
							{campo(form.tipo === "PJ" ? "CNPJ" : "CPF", "documento", form, set("documento"), { max: 20 })}
							{campo(form.tipo === "PJ" ? "Razão social" : "Nome completo", "nome", form, set("nome"), { max: 200 })}
							{form.tipo === "PJ" && campo("Nome fantasia", "nome_fantasia", form, set("nome_fantasia"), { max: 200 })}
							{campo("Telefone", "telefone", form, set("telefone"), { max: 30 })}
							{campo("WhatsApp", "whatsapp", form, set("whatsapp"), { max: 30 })}
							{campo("E-mail", "email", form, set("email"), { max: 254 })}
						</div>
					</section>

					<section>
						<h3 className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Endereço</h3>
						<div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
							{campo("CEP", "cep", form, set("cep"), { max: 10 })}
							{campo("Logradouro", "logradouro", form, set("logradouro"), { max: 200 })}
							{campo("Número", "numero", form, set("numero"), { max: 20 })}
							{campo("Complemento", "complemento", form, set("complemento"), { max: 100 })}
							{campo("Bairro", "bairro", form, set("bairro"), { max: 100 })}
							{campo("Cidade", "cidade", form, set("cidade"), { max: 100 })}
							{campo("Estado (UF)", "estado", form, set("estado"), { max: 2, maiusculo: true })}
						</div>
					</section>

					<section>
						<h3 className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Gestão</h3>
						<div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<label htmlFor="status" className="block text-sm font-medium text-voia-neutral-900">
									Status
								</label>
								<select
									id="status"
									value={form.status}
									onChange={(e) => set("status")(e.target.value)}
									className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
								>
									<option value="lead">Lead</option>
									<option value="ativo">Ativo</option>
									<option value="inativo">Inativo</option>
								</select>
							</div>
							{campo("Origem", "origem", form, set("origem"), { max: 100 })}
							<div>
								<label htmlFor="responsavel" className="block text-sm font-medium text-voia-neutral-900">
									Responsável interno
								</label>
								<select
									id="responsavel"
									value={form.responsavel_interno_id}
									onChange={(e) => set("responsavel_interno_id")(e.target.value)}
									className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
								>
									<option value="">Nenhum</option>
									{usuarios.map((u) => (
										<option key={u.id} value={u.id}>
											{u.nome}
										</option>
									))}
								</select>
							</div>
						</div>
						<div className="mt-4">
							<label htmlFor="observacoes" className="block text-sm font-medium text-voia-neutral-900">
								Observações
							</label>
							<textarea
								id="observacoes"
								value={form.observacoes}
								onChange={(e) => set("observacoes")(e.target.value)}
								rows={3}
								className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
							/>
						</div>
					</section>

					{error && <p className="text-sm text-voia-danger">{error}</p>}

					<div className="flex justify-end gap-3 pt-2">
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
							{submitting ? "Salvando…" : editando ? "Salvar alterações" : "Criar cliente"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

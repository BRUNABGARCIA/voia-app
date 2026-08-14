import { useState, type FormEvent } from "react";
import type { Usuario } from "../pages/EquipeAcessos";

const PERFIL_LABEL: Record<string, string> = {
	administrador: "Administrador",
	gestor: "Gestor",
	colaborador: "Colaborador",
	visualizador: "Visualizador",
};

const PERFIS = ["administrador", "gestor", "colaborador", "visualizador"] as const;

export default function NovoUsuarioModal({
	onClose,
	onCreated,
}: {
	onClose: () => void;
	onCreated: (usuario: Usuario) => void;
}) {
	const [nome, setNome] = useState("");
	const [email, setEmail] = useState("");
	const [perfil, setPerfil] = useState<(typeof PERFIS)[number]>("colaborador");
	const [senha, setSenha] = useState("");
	const [confirmacao, setConfirmacao] = useState("");
	const [ativo, setAtivo] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (senha.length < 8) {
			setError("A senha precisa ter pelo menos 8 caracteres.");
			return;
		}
		if (senha !== confirmacao) {
			setError("As senhas não conferem.");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch("/api/usuarios", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ nome, email, perfil, senha, ativo }),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível criar o usuário");
			}

			const { usuario: criado } = (await res.json()) as { usuario: Usuario };
			onCreated(criado);
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível criar o usuário");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
			<div className="w-full max-w-md rounded-card bg-(--color-surface) p-(--space-card) shadow-elevated">
				<h2 className="font-display text-xl text-voia-green-900">Novo usuário</h2>

				<form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
					<div>
						<label htmlFor="novo-nome" className="block text-sm font-medium text-voia-neutral-900">
							Nome
						</label>
						<input
							id="novo-nome"
							type="text"
							required
							value={nome}
							onChange={(e) => setNome(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>

					<div>
						<label htmlFor="novo-email" className="block text-sm font-medium text-voia-neutral-900">
							E-mail
						</label>
						<input
							id="novo-email"
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>

					<div>
						<label htmlFor="novo-perfil" className="block text-sm font-medium text-voia-neutral-900">
							Perfil
						</label>
						<select
							id="novo-perfil"
							value={perfil}
							onChange={(e) => setPerfil(e.target.value as (typeof PERFIS)[number])}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							{PERFIS.map((p) => (
								<option key={p} value={p}>
									{PERFIL_LABEL[p]}
								</option>
							))}
						</select>
					</div>

					<div>
						<label htmlFor="novo-senha" className="block text-sm font-medium text-voia-neutral-900">
							Senha inicial
						</label>
						<input
							id="novo-senha"
							type="password"
							required
							autoComplete="new-password"
							value={senha}
							onChange={(e) => setSenha(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>

					<div>
						<label htmlFor="novo-confirmacao" className="block text-sm font-medium text-voia-neutral-900">
							Confirmar senha
						</label>
						<input
							id="novo-confirmacao"
							type="password"
							required
							autoComplete="new-password"
							value={confirmacao}
							onChange={(e) => setConfirmacao(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>

					<div className="flex items-center justify-between">
						<label htmlFor="novo-ativo" className="text-sm font-medium text-voia-neutral-900">
							Conta ativa
						</label>
						<input
							id="novo-ativo"
							type="checkbox"
							checked={ativo}
							onChange={(e) => setAtivo(e.target.checked)}
							className="h-4 w-4"
						/>
					</div>

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
							{submitting ? "Criando…" : "Criar usuário"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

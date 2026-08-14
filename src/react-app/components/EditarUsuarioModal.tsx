import { useState, type FormEvent } from "react";
import { useAuth } from "../contexts/useAuth";
import type { Usuario } from "../pages/EquipeAcessos";

const PERFIL_LABEL: Record<string, string> = {
	administrador: "Administrador",
	gestor: "Gestor",
	colaborador: "Colaborador",
	visualizador: "Visualizador",
};

const PERFIS = ["administrador", "gestor", "colaborador", "visualizador"] as const;

export default function EditarUsuarioModal({
	usuario,
	onClose,
	onSaved,
}: {
	usuario: Usuario;
	onClose: () => void;
	onSaved: (usuario: Usuario) => void;
}) {
	const { user: usuarioLogado } = useAuth();
	const isSelf = usuarioLogado?.id === usuario.id;

	const [nome, setNome] = useState(usuario.nome);
	const [email, setEmail] = useState(usuario.email);
	const [perfil, setPerfil] = useState(usuario.perfil);
	const [ativo, setAtivo] = useState(Boolean(usuario.ativo));
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			const res = await fetch(`/api/usuarios/${usuario.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ nome, email, perfil, ativo }),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar");
			}

			const { usuario: atualizado } = (await res.json()) as { usuario: Usuario };
			onSaved(atualizado);
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
			<div className="w-full max-w-md rounded-card bg-(--color-surface) p-(--space-card) shadow-elevated">
				<h2 className="font-display text-xl text-voia-green-900">Editar usuário</h2>

				<form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
					<div>
						<label htmlFor="nome" className="block text-sm font-medium text-voia-neutral-900">
							Nome
						</label>
						<input
							id="nome"
							type="text"
							required
							value={nome}
							onChange={(e) => setNome(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>

					<div>
						<label htmlFor="email" className="block text-sm font-medium text-voia-neutral-900">
							E-mail
						</label>
						<input
							id="email"
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>

					<div>
						<label htmlFor="perfil" className="block text-sm font-medium text-voia-neutral-900">
							Perfil
						</label>
						<select
							id="perfil"
							value={perfil}
							disabled={isSelf}
							onChange={(e) => setPerfil(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500 disabled:opacity-(--opacity-disabled)"
						>
							{PERFIS.map((p) => (
								<option key={p} value={p}>
									{PERFIL_LABEL[p]}
								</option>
							))}
						</select>
						{isSelf && (
							<p className="mt-1 text-xs text-voia-neutral-500">
								Você não pode alterar o próprio perfil de administrador.
							</p>
						)}
					</div>

					<div className="flex items-center justify-between">
						<label htmlFor="ativo" className="text-sm font-medium text-voia-neutral-900">
							Conta ativa
						</label>
						<input
							id="ativo"
							type="checkbox"
							checked={ativo}
							disabled={isSelf}
							onChange={(e) => setAtivo(e.target.checked)}
							className="h-4 w-4 disabled:opacity-(--opacity-disabled)"
						/>
					</div>
					{isSelf && (
						<p className="-mt-2 text-xs text-voia-neutral-500">Você não pode desativar a própria conta.</p>
					)}

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
							{submitting ? "Salvando…" : "Salvar"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

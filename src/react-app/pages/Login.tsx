import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../contexts/useAuth";

export default function Login() {
	const { user, loading, login } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [email, setEmail] = useState("");
	const [senha, setSenha] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	if (!loading && user) {
		const from = (location.state as { from?: { pathname?: string } } | null)?.from;
		return <Navigate to={from?.pathname ?? "/"} replace />;
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			await login(email, senha);
			navigate("/", { replace: true });
		} catch {
			setError("E-mail ou senha inválidos.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<main className="flex min-h-screen items-center justify-center p-(--space-page)">
			<div className="w-full max-w-sm rounded-card bg-(--color-surface) p-(--space-card) shadow-card">
				<h1 className="font-display text-2xl text-voia-green-900">VOIA</h1>
				<p className="mt-1 text-sm text-voia-neutral-700">Entrar na sua conta</p>

				<form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
					<div>
						<label htmlFor="email" className="block text-sm font-medium text-voia-neutral-900">
							E-mail
						</label>
						<input
							id="email"
							type="email"
							required
							autoComplete="username"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>

					<div>
						<label htmlFor="senha" className="block text-sm font-medium text-voia-neutral-900">
							Senha
						</label>
						<input
							id="senha"
							type="password"
							required
							autoComplete="current-password"
							value={senha}
							onChange={(e) => setSenha(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>

					{error && <p className="text-sm text-voia-danger">{error}</p>}

					<button
						type="submit"
						disabled={submitting}
						className="w-full rounded-control bg-voia-green-800 px-4 py-2 font-medium text-white transition-colors hover:bg-voia-green-900 disabled:opacity-(--opacity-disabled)"
					>
						{submitting ? "Entrando…" : "Entrar"}
					</button>
				</form>
			</div>
		</main>
	);
}

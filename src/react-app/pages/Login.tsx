import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../contexts/useAuth";
import { usePortalAuth } from "../contexts/usePortalAuth";
import { useBranding } from "../contexts/useBranding";

type Visao = "escolha" | "colaborador" | "cliente";

function IconeCliente() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
			<path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
			<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
		</svg>
	);
}

function IconeColaborador() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
			<rect x="3.5" y="7" width="17" height="12" rx="1.5" />
			<path strokeLinecap="round" strokeLinejoin="round" d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" />
			<path strokeLinecap="round" d="M3.5 12.5h17" />
		</svg>
	);
}

function CartaoAcesso({
	icone,
	titulo,
	descricao,
	onClick,
}: {
	icone: ReactNode;
	titulo: string;
	descricao: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex flex-col items-start gap-3 rounded-card border border-white/10 bg-white/[0.03] p-5 text-left shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-colors hover:border-white/20 hover:bg-white/[0.06]"
		>
			<span className="flex h-10 w-10 items-center justify-center rounded-control bg-white/5 text-voia-gold-500">
				{icone}
			</span>
			<span className="font-display text-base text-white">{titulo}</span>
			<span className="text-sm text-white/50">{descricao}</span>
			<span className="mt-1 text-sm font-medium text-voia-gold-500">Acessar →</span>
		</button>
	);
}

function CampoLogin({
	id,
	label,
	type,
	value,
	onChange,
	autoComplete,
}: {
	id: string;
	label: string;
	type: string;
	value: string;
	onChange: (v: string) => void;
	autoComplete: string;
}) {
	return (
		<div>
			<label htmlFor={id} className="block text-sm font-medium text-white/70">
				{label}
			</label>
			<input
				id={id}
				type={type}
				required
				autoComplete={autoComplete}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="mt-1 w-full rounded-control border border-white/15 bg-white/[0.04] px-3 py-2 text-white outline-none placeholder:text-white/30 focus:border-voia-gold-500"
			/>
		</div>
	);
}

export default function Login() {
	const { user, loading: loadingInterno, login: loginColaborador } = useAuth();
	const { contato, loading: loadingPortal, login: loginCliente } = usePortalAuth();
	const branding = useBranding();
	const navigate = useNavigate();
	const location = useLocation();

	const [visao, setVisao] = useState<Visao>("escolha");
	const [email, setEmail] = useState("");
	const [senha, setSenha] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	if (!loadingInterno && user) {
		const from = (location.state as { from?: { pathname?: string } } | null)?.from;
		return <Navigate to={from?.pathname ?? "/"} replace />;
	}
	if (!loadingPortal && contato) {
		return <Navigate to="/portal" replace />;
	}

	async function handleSubmitColaborador(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			await loginColaborador(email, senha);
			navigate("/", { replace: true });
		} catch {
			setError("E-mail ou senha inválidos.");
		} finally {
			setSubmitting(false);
		}
	}

	async function handleSubmitCliente(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			await loginCliente(email, senha);
			navigate("/portal", { replace: true });
		} catch {
			setError("E-mail ou senha inválidos.");
		} finally {
			setSubmitting(false);
		}
	}

	function voltar() {
		setVisao("escolha");
		setEmail("");
		setSenha("");
		setError(null);
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-black p-(--space-page)">
			<div className="w-full max-w-md">
				<div className="flex flex-col items-center">
					<img src={branding.logoUrl} alt={branding.nomeSistema} className="h-12 w-auto object-contain" />
					{visao === "escolha" && <p className="mt-3 text-sm text-white/50">Escolha como deseja entrar</p>}
				</div>

				{visao === "escolha" && (
					<div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
						<CartaoAcesso
							icone={<IconeCliente />}
							titulo="Cliente"
							descricao="Acompanhe seus processos"
							onClick={() => setVisao("cliente")}
						/>
						<CartaoAcesso
							icone={<IconeColaborador />}
							titulo="Colaborador"
							descricao="Acesse o ambiente VOIA"
							onClick={() => setVisao("colaborador")}
						/>
					</div>
				)}

				{visao !== "escolha" && (
					<div className="mt-8 rounded-card border border-white/10 bg-white/[0.03] p-(--space-card) shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
						<button type="button" onClick={voltar} className="text-sm text-white/50 hover:text-white">
							← Voltar
						</button>

						<h1 className="mt-3 font-display text-xl text-white">
							{visao === "colaborador" ? "Acesso do colaborador" : "Acompanhar processo"}
						</h1>

						<form
							className="mt-6 space-y-4"
							onSubmit={visao === "colaborador" ? handleSubmitColaborador : handleSubmitCliente}
							noValidate
						>
							<CampoLogin id="email" label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="username" />
							<CampoLogin
								id="senha"
								label="Senha"
								type="password"
								value={senha}
								onChange={setSenha}
								autoComplete="current-password"
							/>

							{error && <p className="text-sm text-voia-danger">{error}</p>}

							<button
								type="submit"
								disabled={submitting}
								className="w-full rounded-control bg-voia-gold-500 px-4 py-2 font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
							>
								{submitting ? "Entrando…" : "Entrar"}
							</button>
						</form>
					</div>
				)}
			</div>
		</main>
	);
}

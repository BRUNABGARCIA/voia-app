import { useAuth } from "../contexts/useAuth";

/** Landing autenticada temporária — não é o dashboard definitivo. */
export default function Home() {
	const { user } = useAuth();

	return (
		<div className="rounded-card bg-white p-(--space-card) shadow-card">
			<h1 className="font-display text-xl text-voia-green-900">Bem-vindo ao VOIA{user ? `, ${user.nome}` : ""}.</h1>
			<p className="mt-2 text-sm text-voia-neutral-700">
				Você entrou corretamente no VOIA APP. Esta é uma página inicial temporária — os módulos operacionais
				serão adicionados nas próximas etapas.
			</p>
		</div>
	);
}

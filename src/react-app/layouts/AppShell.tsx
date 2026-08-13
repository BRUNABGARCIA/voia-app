import { NavLink, Outlet } from "react-router";
import { useAuth } from "../contexts/useAuth";

export default function AppShell() {
	const { user, logout } = useAuth();

	return (
		<div className="flex min-h-screen bg-(--color-bg)">
			<aside className="w-56 shrink-0 border-r border-voia-neutral-100 bg-white p-4">
				<div className="font-display text-lg text-voia-green-900">VOIA</div>
				<nav className="mt-6 flex flex-col gap-1">
					<NavLink
						to="/"
						end
						className={({ isActive }) =>
							`rounded-control px-3 py-2 text-sm font-medium ${
								isActive ? "bg-voia-green-800 text-white" : "text-voia-neutral-700 hover:bg-voia-beige-100"
							}`
						}
					>
						Início
					</NavLink>
				</nav>
			</aside>

			<div className="flex flex-1 flex-col">
				<header className="flex items-center justify-between border-b border-voia-neutral-100 bg-white px-6 py-4">
					<div />
					<div className="flex items-center gap-4">
						<div className="text-right">
							<div className="text-sm font-medium text-voia-neutral-900">{user?.nome}</div>
							<div className="text-xs uppercase tracking-wide text-voia-neutral-500">{user?.perfil}</div>
						</div>
						<button
							type="button"
							onClick={() => void logout()}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
						>
							Sair
						</button>
					</div>
				</header>

				<main className="flex-1 p-(--space-page)">
					<Outlet />
				</main>
			</div>
		</div>
	);
}

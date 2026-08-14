import { NavLink, Outlet } from "react-router";
import { useAuth } from "../contexts/useAuth";
import { useBranding } from "../contexts/useBranding";
import { logoDimensoes } from "../lib/logo-escala";

function SidebarLink({ to, children }: { to: string; children: React.ReactNode }) {
	return (
		<NavLink
			to={to}
			end
			className={({ isActive }) =>
				`block rounded-control px-3 py-2 text-sm font-medium transition-colors ${
					isActive
						? "bg-(--color-sidebar-active-bg) text-(--color-sidebar-active-text)"
						: "text-(--color-sidebar-text) hover:bg-white/10"
				}`
			}
		>
			{children}
		</NavLink>
	);
}

export default function AppShell() {
	const { user, logout } = useAuth();
	const branding = useBranding();
	const isAdmin = user?.perfil === "administrador";
	const logoDim = logoDimensoes(branding.logoEscala);

	return (
		<div className="flex min-h-screen bg-(--color-bg)">
			<aside className="flex w-60 shrink-0 flex-col bg-(--color-sidebar-bg) p-5">
				<img
					src={branding.logoUrl}
					alt="VOIA Engenharia"
					className="object-contain"
					style={{ width: `${logoDim.width}px`, height: `${logoDim.height}px` }}
				/>

				<nav className="mt-8 flex flex-col gap-1">
					<SidebarLink to="/">Início</SidebarLink>
					<SidebarLink to="/clientes">Clientes</SidebarLink>
					<SidebarLink to="/projetos">Projetos</SidebarLink>
				</nav>

				{isAdmin && (
					<div className="mt-8">
						<div className="px-3 text-xs font-medium uppercase tracking-wider text-(--color-sidebar-text-muted)">
							Configurações
						</div>
						<nav className="mt-2 flex flex-col gap-1">
							<SidebarLink to="/configuracoes/equipe">Equipe e Acessos</SidebarLink>
							<SidebarLink to="/configuracoes/aparencia">Aparência</SidebarLink>
						</nav>
					</div>
				)}
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

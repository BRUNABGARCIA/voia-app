import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "../contexts/useAuth";
import { useBranding } from "../contexts/useBranding";
import { logoDimensoes } from "../lib/logo-escala";

function SidebarLink({ to, children, onNavigate }: { to: string; children: React.ReactNode; onNavigate: () => void }) {
	return (
		<NavLink
			to={to}
			end
			onClick={onNavigate}
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
	// Sidebar fixa (240px) cabe bem em desktop/notebook, prioridade desta
	// aplicação — mas em telas de celular ela sozinha ocuparia a maior parte
	// da largura. Abaixo do breakpoint sm ela vira um menu retrátil (fora da
	// tela por padrão); a partir de sm continua sempre visível, sem nenhuma
	// mudança de comportamento no desktop.
	const [menuAberto, setMenuAberto] = useState(false);
	const fecharMenu = () => setMenuAberto(false);

	return (
		<div className="flex min-h-screen bg-(--color-bg)">
			{menuAberto && (
				<button
					type="button"
					aria-label="Fechar menu"
					onClick={fecharMenu}
					className="fixed inset-0 z-30 bg-black/40 sm:hidden"
				/>
			)}

			<aside
				className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col overflow-y-auto bg-(--color-sidebar-bg) p-5 transition-transform duration-200 sm:static sm:z-auto sm:translate-x-0 ${
					menuAberto ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<img
					src={branding.logoUrl}
					alt="VOIA Engenharia"
					className="object-contain"
					style={{ width: `${logoDim.width}px`, height: `${logoDim.height}px` }}
				/>

				<nav className="mt-8 flex flex-col gap-1">
					<SidebarLink to="/" onNavigate={fecharMenu}>
						Início
					</SidebarLink>
					<SidebarLink to="/clientes" onNavigate={fecharMenu}>
						Clientes
					</SidebarLink>
					<SidebarLink to="/projetos" onNavigate={fecharMenu}>
						Projetos
					</SidebarLink>
				</nav>

				{isAdmin && (
					<div className="mt-8">
						<div className="px-3 text-xs font-medium uppercase tracking-wider text-(--color-sidebar-text-muted)">
							Configurações
						</div>
						<nav className="mt-2 flex flex-col gap-1">
							<SidebarLink to="/configuracoes/equipe" onNavigate={fecharMenu}>
								Equipe e Acessos
							</SidebarLink>
							<SidebarLink to="/configuracoes/tipos-servico" onNavigate={fecharMenu}>
								Tipos de Serviço
							</SidebarLink>
							<SidebarLink to="/configuracoes/aparencia" onNavigate={fecharMenu}>
								Aparência
							</SidebarLink>
						</nav>
					</div>
				)}
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex items-center justify-between border-b border-voia-neutral-100 bg-(--color-surface) px-4 py-4 sm:px-6">
					<button
						type="button"
						aria-label="Abrir menu"
						onClick={() => setMenuAberto(true)}
						className="rounded-control border border-voia-neutral-100 p-2 text-voia-neutral-700 hover:bg-voia-beige-100 sm:hidden"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
						</svg>
					</button>
					<div className="hidden sm:block" />
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

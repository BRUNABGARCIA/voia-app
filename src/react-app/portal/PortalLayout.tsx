import { Link, Outlet } from "react-router";
import { usePortalAuth } from "../contexts/usePortalAuth";
import { useBranding } from "../contexts/useBranding";

export default function PortalLayout() {
	const { contato, logout } = usePortalAuth();
	const branding = useBranding();

	return (
		<div className="min-h-screen bg-(--color-bg)">
			<header className="border-b border-voia-neutral-100 bg-(--color-sidebar-bg)">
				<div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
					<Link to="/portal" className="flex items-center gap-2">
						<img src={branding.logoUrl} alt={branding.nomeSistema} className="h-8 w-auto object-contain" />
					</Link>
					<div className="flex items-center gap-3">
						<div className="hidden text-right sm:block">
							<div className="text-sm font-medium text-(--color-sidebar-text)">{contato?.nome}</div>
							<div className="text-xs text-(--color-sidebar-text-muted)">{contato?.clienteNome}</div>
						</div>
						<button
							type="button"
							onClick={() => void logout()}
							className="rounded-control border border-white/15 px-3 py-1.5 text-sm font-medium text-(--color-sidebar-text) hover:bg-white/10"
						>
							Sair
						</button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-4 py-(--space-page) sm:px-6">
				<Outlet />
			</main>
		</div>
	);
}

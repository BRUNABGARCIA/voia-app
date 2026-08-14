import { Navigate, Outlet, useLocation } from "react-router";
import { usePortalAuth } from "../contexts/usePortalAuth";

/**
 * Proteção de UX apenas — a autoridade real é o backend
 * (withPortalSession/requirePortalAuth em src/worker/portal). Isto só evita
 * mostrar a interface do Portal antes de confirmar a sessão do contato.
 */
export default function RequirePortalAuth() {
	const { contato, loading } = usePortalAuth();
	const location = useLocation();

	if (loading) {
		return null;
	}

	if (!contato) {
		return <Navigate to="/login" replace state={{ from: location, portal: true }} />;
	}

	return <Outlet />;
}

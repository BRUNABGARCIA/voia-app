import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../contexts/useAuth";

/**
 * Proteção de UX apenas — a autoridade real de acesso é o backend
 * (withSession/requireAuth no Worker). Isto só evita mostrar a interface
 * privada antes de confirmar a sessão.
 */
export default function RequireAuth() {
	const { user, loading } = useAuth();
	const location = useLocation();

	if (loading) {
		return null;
	}

	if (!user) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}

	return <Outlet />;
}

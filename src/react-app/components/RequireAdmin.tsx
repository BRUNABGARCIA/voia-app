import { Navigate, Outlet } from "react-router";
import { useAuth } from "../contexts/useAuth";

/**
 * Proteção de UX apenas (esconde a navegação/rota para quem não é
 * administrador) — a autoridade real é requireRole("administrador") no
 * Worker, aplicado em toda rota /api/usuarios.
 */
export default function RequireAdmin() {
	const { user } = useAuth();

	if (user?.perfil !== "administrador") {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
}

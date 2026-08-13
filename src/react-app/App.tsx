import { Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import AppShell from "./layouts/AppShell";
import Login from "./pages/Login";
import Home from "./pages/Home";
import InfraCheck from "./pages/InfraCheck";
import EquipeAcessos from "./pages/EquipeAcessos";
import Aparencia from "./pages/Aparencia";
import Clientes from "./pages/Clientes";
import ClienteWorkspace from "./pages/ClienteWorkspace";

function App() {
	return (
		<BrandingProvider>
			<AuthProvider>
				<Routes>
					<Route path="/status" element={<InfraCheck />} />
					<Route path="/login" element={<Login />} />

					<Route element={<RequireAuth />}>
						<Route element={<AppShell />}>
							<Route index element={<Home />} />

							<Route path="clientes" element={<Clientes />} />
							<Route path="clientes/:id" element={<ClienteWorkspace />} />

							<Route element={<RequireAdmin />}>
								<Route path="configuracoes/equipe" element={<EquipeAcessos />} />
								<Route path="configuracoes/aparencia" element={<Aparencia />} />
							</Route>
						</Route>
					</Route>

					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</AuthProvider>
		</BrandingProvider>
	);
}

export default App;

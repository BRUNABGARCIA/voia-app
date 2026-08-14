import { Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import { PortalAuthProvider } from "./contexts/PortalAuthContext";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import RequirePortalAuth from "./components/RequirePortalAuth";
import AppShell from "./layouts/AppShell";
import Login from "./pages/Login";
import Home from "./pages/Home";
import InfraCheck from "./pages/InfraCheck";
import EquipeAcessos from "./pages/EquipeAcessos";
import Aparencia from "./pages/Aparencia";
import TiposServico from "./pages/TiposServico";
import Clientes from "./pages/Clientes";
import ClienteWorkspace from "./pages/ClienteWorkspace";
import Projetos from "./pages/Projetos";
import ProjetoWorkspace from "./pages/ProjetoWorkspace";
import PortalLayout from "./portal/PortalLayout";
import MeusProcessos from "./portal/MeusProcessos";
import PortalProcesso from "./portal/PortalProcesso";

function App() {
	return (
		<BrandingProvider>
			<AuthProvider>
				<PortalAuthProvider>
					<Routes>
						<Route path="/status" element={<InfraCheck />} />
						<Route path="/login" element={<Login />} />

						<Route element={<RequireAuth />}>
							<Route element={<AppShell />}>
								<Route index element={<Home />} />

								<Route path="clientes" element={<Clientes />} />
								<Route path="clientes/:id" element={<ClienteWorkspace />} />
								<Route path="projetos" element={<Projetos />} />
								<Route path="projetos/:id" element={<ProjetoWorkspace />} />

								<Route element={<RequireAdmin />}>
									<Route path="configuracoes/equipe" element={<EquipeAcessos />} />
									<Route path="configuracoes/aparencia" element={<Aparencia />} />
									<Route path="configuracoes/tipos-servico" element={<TiposServico />} />
								</Route>
							</Route>
						</Route>

						<Route element={<RequirePortalAuth />}>
							<Route path="portal" element={<PortalLayout />}>
								<Route index element={<MeusProcessos />} />
								<Route path="processos/:id" element={<PortalProcesso />} />
							</Route>
						</Route>

						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</PortalAuthProvider>
			</AuthProvider>
		</BrandingProvider>
	);
}

export default App;

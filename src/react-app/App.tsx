import { Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import RequireAuth from "./components/RequireAuth";
import AppShell from "./layouts/AppShell";
import Login from "./pages/Login";
import Home from "./pages/Home";
import InfraCheck from "./pages/InfraCheck";

function App() {
	return (
		<AuthProvider>
			<Routes>
				<Route path="/status" element={<InfraCheck />} />
				<Route path="/login" element={<Login />} />

				<Route element={<RequireAuth />}>
					<Route element={<AppShell />}>
						<Route index element={<Home />} />
					</Route>
				</Route>

				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</AuthProvider>
	);
}

export default App;

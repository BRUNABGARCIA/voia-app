import { Route, Routes } from "react-router";
import InfraCheck from "./pages/InfraCheck";

function App() {
	return (
		<Routes>
			<Route path="/" element={<InfraCheck />} />
		</Routes>
	);
}

export default App;

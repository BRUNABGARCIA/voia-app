import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PortalAuthContext, type PortalUser } from "./portal-auth-context";

// Contexto de autenticação do Portal do Cliente — completamente separado
// de AuthContext (login interno). Consome /api/portal/*, nunca /api/auth/*
// ou /api/usuarios — não existe mistura de sessão/estado entre os dois.
export function PortalAuthProvider({ children }: { children: ReactNode }) {
	const [contato, setContato] = useState<PortalUser | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		fetch("/api/portal/me", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<PortalUser>) : null))
			.then((data) => {
				if (!cancelled) setContato(data);
			})
			.catch(() => {
				if (!cancelled) setContato(null);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const login = useCallback(async (email: string, senha: string) => {
		const res = await fetch("/api/portal/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({ email, senha }),
		});

		if (!res.ok) {
			throw new Error("Credenciais inválidas.");
		}

		setContato((await res.json()) as PortalUser);
	}, []);

	const logout = useCallback(async () => {
		await fetch("/api/portal/logout", { method: "POST", credentials: "same-origin" });
		setContato(null);
	}, []);

	return <PortalAuthContext.Provider value={{ contato, loading, login, logout }}>{children}</PortalAuthContext.Provider>;
}

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AuthContext, type AuthUser } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		fetch("/api/auth/me", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<AuthUser>) : null))
			.then((data) => {
				if (!cancelled) setUser(data);
			})
			.catch(() => {
				if (!cancelled) setUser(null);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const login = useCallback(async (email: string, senha: string) => {
		const res = await fetch("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({ email, senha }),
		});

		if (!res.ok) {
			throw new Error("Credenciais inválidas.");
		}

		setUser((await res.json()) as AuthUser);
	}, []);

	const logout = useCallback(async () => {
		await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
		setUser(null);
	}, []);

	return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

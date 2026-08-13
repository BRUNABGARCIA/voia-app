import { createContext } from "react";

export interface AuthUser {
	id: number;
	nome: string;
	email: string;
	perfil: string;
}

export interface AuthContextValue {
	user: AuthUser | null;
	loading: boolean;
	login: (email: string, senha: string) => Promise<void>;
	logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

import { createContext } from "react";

export interface PortalUser {
	id: number;
	nome: string;
	email: string;
	clienteId: number;
	clienteNome: string;
}

export interface PortalAuthContextValue {
	contato: PortalUser | null;
	loading: boolean;
	login: (email: string, senha: string) => Promise<void>;
	logout: () => Promise<void>;
}

export const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

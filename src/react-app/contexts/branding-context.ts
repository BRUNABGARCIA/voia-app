import { createContext } from "react";

export interface BrandingConfig {
	nomeSistema: string;
	logoUrl: string;
	faviconUrl: string;
	atualizadoEm: string | null;
}

export interface BrandingContextValue extends BrandingConfig {
	loading: boolean;
	refresh: () => Promise<void>;
}

export const BrandingContext = createContext<BrandingContextValue | null>(null);

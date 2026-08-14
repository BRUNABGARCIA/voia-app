import { createContext } from "react";
import type { CoresTema } from "../lib/tema";

export interface BrandingConfig extends CoresTema {
	nomeSistema: string;
	logoUrl: string;
	faviconUrl: string;
	logoEscala: number;
	atualizadoEm: string | null;
}

export interface BrandingContextValue extends BrandingConfig {
	loading: boolean;
	refresh: () => Promise<void>;
}

export const BrandingContext = createContext<BrandingContextValue | null>(null);

import { useContext } from "react";
import { BrandingContext, type BrandingContextValue } from "./branding-context";

export function useBranding(): BrandingContextValue {
	const ctx = useContext(BrandingContext);
	if (!ctx) {
		throw new Error("useBranding precisa ser usado dentro de <BrandingProvider>.");
	}
	return ctx;
}

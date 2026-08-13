import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BrandingContext, type BrandingConfig } from "./branding-context";

const DEFAULT_CONFIG: BrandingConfig = {
	nomeSistema: "VOIA Engenharia",
	logoUrl: "/branding/logo-voia.png",
	faviconUrl: "/branding/favicon-voia.png",
	atualizadoEm: null,
};

function aplicarFavicon(faviconUrl: string, versao: string | null) {
	const href = versao ? `${faviconUrl}?v=${encodeURIComponent(versao)}` : faviconUrl;
	const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
	if (link) link.href = href;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
	const [config, setConfig] = useState<BrandingConfig>(DEFAULT_CONFIG);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		const res = await fetch("/api/configuracoes", { credentials: "same-origin" });
		if (!res.ok) return;
		const data = (await res.json()) as BrandingConfig;
		setConfig(data);
	}, []);

	useEffect(() => {
		let cancelled = false;

		fetch("/api/configuracoes", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<BrandingConfig>) : null))
			.then((data) => {
				if (!cancelled && data) setConfig(data);
			})
			.catch(() => {
				/* mantém DEFAULT_CONFIG (fallback estático) em caso de erro */
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		document.title = config.nomeSistema;
	}, [config.nomeSistema]);

	useEffect(() => {
		aplicarFavicon(config.faviconUrl, config.atualizadoEm);
	}, [config.faviconUrl, config.atualizadoEm]);

	return (
		<BrandingContext.Provider value={{ ...config, loading, refresh }}>{children}</BrandingContext.Provider>
	);
}

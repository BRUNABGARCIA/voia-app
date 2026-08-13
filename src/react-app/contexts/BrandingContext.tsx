import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BrandingContext, type BrandingConfig } from "./branding-context";

const DEFAULT_CONFIG: BrandingConfig = {
	nomeSistema: "VOIA Engenharia",
	logoUrl: "/branding/logo-voia.png",
	faviconUrl: "/branding/favicon-voia.png",
	atualizadoEm: null,
};

/**
 * Acrescenta ?v=<atualizado_em> na URL — sem isso, a logo/favicon usam
 * sempre a mesma URL (/api/configuracoes/logo|favicon), então o
 * navegador pode continuar mostrando a imagem antiga em cache mesmo
 * depois de salvar uma nova na mesma sessão, já que nem a tag <img> nem
 * o <link rel="icon"> percebem "mudança" numa URL idêntica.
 */
function versionar(url: string, versao: string | null): string {
	return versao ? `${url}?v=${encodeURIComponent(versao)}` : url;
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

	const logoUrl = versionar(config.logoUrl, config.atualizadoEm);
	const faviconUrl = versionar(config.faviconUrl, config.atualizadoEm);

	useEffect(() => {
		document.title = config.nomeSistema;
	}, [config.nomeSistema]);

	useEffect(() => {
		const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
		if (link) link.href = faviconUrl;
	}, [faviconUrl]);

	return (
		<BrandingContext.Provider value={{ ...config, logoUrl, faviconUrl, loading, refresh }}>
			{children}
		</BrandingContext.Provider>
	);
}

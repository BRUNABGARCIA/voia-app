/**
 * Baixa um arquivo através de um endpoint autenticado da API (fetch, nunca
 * navegação de página) e entrega ao navegador via blob local.
 *
 * Importante: um <a href="/api/..."> comum aciona uma navegação real do
 * navegador (Accept: text/html), e o roteamento de assets da Cloudflare
 * intercepta esse tipo de request para caminhos sem arquivo estático
 * correspondente — inclusive "/api/*" — servindo o index.html da SPA antes
 * do Worker rodar (corrigido também em wrangler.json via
 * assets.run_worker_first, mas esta função evita depender só disso).
 * fetch() nunca é tratado como navegação, então nunca aciona esse
 * fallback — e como bônus dá acesso ao corpo do erro em JSON para mostrar
 * uma mensagem amigável em vez de deixar o navegador abrir/baixar o erro.
 */
export async function baixarArquivo(url: string, nomeSugerido: string): Promise<void> {
	const res = await fetch(url, { credentials: "same-origin" });
	if (!res.ok) {
		const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(corpo?.error ?? "não foi possível baixar o arquivo");
	}

	const blob = await res.blob();
	const blobUrl = URL.createObjectURL(blob);
	try {
		const link = document.createElement("a");
		link.href = blobUrl;
		link.download = nomeSugerido;
		document.body.appendChild(link);
		link.click();
		link.remove();
	} finally {
		URL.revokeObjectURL(blobUrl);
	}
}

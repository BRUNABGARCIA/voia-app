/** Extrai só o par nome=valor do primeiro Set-Cookie de uma resposta (ignora atributos). */
export function extrairCookie(res: Response, nome: string): string | null {
	// Hono expõe múltiplos Set-Cookie via getSetCookie(); Headers padrão às
	// vezes concatena em um único header — tentamos os dois formatos.
	const valores = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
	for (const valor of valores) {
		const match = valor.match(new RegExp(`${nome}=([^;]+)`));
		if (match) return `${nome}=${match[1]}`;
	}
	return null;
}

export function jsonRequest(method: string, body?: unknown, cookie?: string): RequestInit {
	return {
		method,
		headers: {
			"content-type": "application/json",
			...(cookie ? { cookie } : {}),
		},
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	};
}

/**
 * Cálculo de prazos previstos das etapas do projeto. Nesta primeira versão
 * usa DIAS CORRIDOS (calendário) — centralizado aqui de propósito, para que
 * uma futura mudança para dias úteis/calendário de feriados troque só esta
 * função, sem tocar em geração de etapas, rotas ou frontend.
 */
export function adicionarDias(dataIso: string, dias: number): string {
	const data = new Date(`${dataIso}T00:00:00Z`);
	data.setUTCDate(data.getUTCDate() + dias);
	return data.toISOString().slice(0, 10);
}

export function hojeIso(): string {
	return new Date().toISOString().slice(0, 10);
}

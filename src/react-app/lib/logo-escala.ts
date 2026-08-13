// Dimensões-base do slot da logo na sidebar (sem ajuste de escala).
// Compartilhado entre a sidebar (AppShell) e o preview da tela Aparência,
// para que o admin veja exatamente o resultado real antes de salvar.
export const LOGO_BASE_WIDTH = 150;
export const LOGO_BASE_HEIGHT = 48;

export const LOGO_ESCALA_MIN = 60;
export const LOGO_ESCALA_MAX = 130;

export function logoDimensoes(escala: number): { width: number; height: number } {
	const fator = escala / 100;
	return {
		width: LOGO_BASE_WIDTH * fator,
		height: LOGO_BASE_HEIGHT * fator,
	};
}

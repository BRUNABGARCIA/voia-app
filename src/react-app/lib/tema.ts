/**
 * Fonte única do tema de cores do VOIA. As 7 cores configuráveis pelo
 * administrador (Configurações > Aparência) são aplicadas como CSS custom
 * properties diretamente no :root — a maior parte dos componentes já
 * consome esses tokens (--color-voia-*, ou os semânticos --color-bg/
 * --color-surface/--color-sidebar-bg que apontam para eles via var()),
 * então sobrescrever aqui rethemiza o app inteiro sem precisar editar
 * cada componente.
 *
 * De propósito, NÃO remapeamos: cores semânticas de sucesso/alerta/erro/
 * informação, bordas, texto terciário/placeholder, nem o verde bem escuro
 * usado como texto sobre botões dourados (--color-voia-green-950) — tudo
 * isso preserva contraste e hierarquia mesmo com um tema customizado,
 * conforme pedido ("não fazer substituição cega de todas as cores").
 */

export interface CoresTema {
	corPrincipal: string;
	corDestaque: string;
	corFundo: string;
	corSuperficie: string;
	corSidebar: string;
	corTextoPrincipal: string;
	corTextoSecundario: string;
}

export const CORES_PADRAO: CoresTema = {
	corPrincipal: "#124435",
	corDestaque: "#F7C94A",
	corFundo: "#F7F7F5",
	corSuperficie: "#FFFFFF",
	corSidebar: "#000000",
	corTextoPrincipal: "#1B1F1C",
	corTextoSecundario: "#3D443F",
};

export const CAMPOS_COR: { chave: keyof CoresTema; label: string }[] = [
	{ chave: "corPrincipal", label: "Cor principal" },
	{ chave: "corDestaque", label: "Cor de destaque" },
	{ chave: "corFundo", label: "Fundo do sistema" },
	{ chave: "corSuperficie", label: "Fundo dos cards/superfícies" },
	{ chave: "corSidebar", label: "Cor da sidebar" },
	{ chave: "corTextoPrincipal", label: "Texto principal" },
	{ chave: "corTextoSecundario", label: "Texto secundário" },
];

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function hexValido(valor: string): boolean {
	return HEX_REGEX.test(valor);
}

/** Aplica as 7 cores no :root do documento. */
export function aplicarTema(cores: CoresTema): void {
	const root = document.documentElement.style;

	root.setProperty("--color-voia-green-900", cores.corPrincipal);
	root.setProperty("--color-voia-green-800", cores.corPrincipal);

	root.setProperty("--color-voia-gold-500", cores.corDestaque);
	root.setProperty("--color-voia-gold-400", cores.corDestaque);
	root.setProperty("--color-voia-yellow", cores.corDestaque);

	root.setProperty("--color-bg", cores.corFundo);
	root.setProperty("--color-surface", cores.corSuperficie);
	root.setProperty("--color-sidebar-bg", cores.corSidebar);

	root.setProperty("--color-voia-neutral-900", cores.corTextoPrincipal);
	root.setProperty("--color-text", cores.corTextoPrincipal);

	root.setProperty("--color-voia-neutral-700", cores.corTextoSecundario);
}

// Cores fixas (não configuráveis) usadas nos pares de contraste abaixo —
// mesmos valores hardcoded nos componentes reais (texto branco na
// sidebar, texto verde bem escuro sobre botão dourado).
const BRANCO = "#FFFFFF";
const TEXTO_SOBRE_DESTAQUE = "#071F17"; // --color-voia-green-950

function luminanciaRelativa(hex: string): number {
	const n = parseInt(hex.slice(1), 16);
	const canais = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

/** Razão de contraste WCAG entre duas cores hex (1 a 21). */
export function razaoContraste(hexA: string, hexB: string): number {
	const l1 = luminanciaRelativa(hexA);
	const l2 = luminanciaRelativa(hexB);
	const claro = Math.max(l1, l2);
	const escuro = Math.min(l1, l2);
	return (claro + 0.05) / (escuro + 0.05);
}

// Limiar simples de proteção — não é uma auditoria WCAG AA completa (que
// pediria 4.5:1 para texto normal), só uma rede de segurança básica
// contra combinações claramente ilegíveis.
export const CONTRASTE_MINIMO = 3;

export interface AvisoContraste {
	par: string;
	razao: number;
}

export function validarContraste(cores: CoresTema): AvisoContraste[] {
	const avisos: AvisoContraste[] = [];
	const checar = (par: string, a: string, b: string) => {
		if (!hexValido(a) || !hexValido(b)) return;
		const razao = razaoContraste(a, b);
		if (razao < CONTRASTE_MINIMO) avisos.push({ par, razao: Math.round(razao * 100) / 100 });
	};

	checar("Sidebar e texto da sidebar", cores.corSidebar, BRANCO);
	checar("Botão principal e texto do botão", cores.corDestaque, TEXTO_SOBRE_DESTAQUE);
	checar("Fundo do sistema e texto principal", cores.corFundo, cores.corTextoPrincipal);
	checar("Fundo dos cards e texto principal", cores.corSuperficie, cores.corTextoPrincipal);

	return avisos;
}

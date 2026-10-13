// Única fonte de verdade para o RÓTULO VISÍVEL de cada perfil técnico.
// O valor técnico/persistido de "colaborador" NUNCA muda (seria migration
// desnecessária) — só o texto mostrado ao usuário passa a ser "Parceiro"
// em toda a interface (badge, formulários, Equipe e Acessos, dashboard).
export const PERFIS_DISPONIVEIS = ["administrador", "gestor", "colaborador", "visualizador"] as const;

export type Perfil = (typeof PERFIS_DISPONIVEIS)[number];

export const PERFIL_LABEL: Record<string, string> = {
	administrador: "Administrador",
	gestor: "Gestor",
	colaborador: "Parceiro",
	visualizador: "Visualizador",
	// Valores legados aceitos pelo banco (sem caminho de criação na UI).
	engenheiro: "Engenheiro",
	financeiro: "Financeiro",
};

import { createMiddleware } from "hono/factory";
import type { AuthEnv } from "../auth/middleware";

/**
 * "colaborador" é o valor técnico/persistido (nunca migrado — evita
 * alteração de schema desnecessária); na experiência do usuário ele é
 * sempre apresentado como "Parceiro" (ver src/react-app/lib/perfis.ts).
 * Este módulo é a fonte única da regra de escopo do Parceiro: só acessa
 * projetos aos quais está vinculado via projeto_membros. administrador,
 * gestor e visualizador continuam com a visão completa já existente —
 * nenhuma mudança de comportamento para eles.
 */
export const PERFIL_PARCEIRO = "colaborador";

export function ehParceiro(perfil: string): boolean {
	return perfil === PERFIL_PARCEIRO;
}

export async function temAcessoAoProjeto(
	db: D1Database,
	usuarioId: number,
	perfil: string,
	projetoId: number,
): Promise<boolean> {
	if (!ehParceiro(perfil)) return true;
	const row = await db
		.prepare("SELECT 1 FROM projeto_membros WHERE projeto_id = ? AND usuario_id = ?")
		.bind(projetoId, usuarioId)
		.first();
	return row !== null;
}

/**
 * Exige que o projeto do path (:id) seja acessível ao usuário autenticado.
 * Para Parceiro, só se ele for membro — 404 (nunca 403), para nunca
 * confirmar a um Parceiro sem acesso que aquele projeto existe (mesmo
 * padrão anti-enumeração já usado no Portal do Cliente). Deve rodar depois
 * de withSession + requireAuth.
 */
export const requireProjectAccess = createMiddleware<AuthEnv>(async (c, next) => {
	const projetoId = Number(c.req.param("id"));
	if (!Number.isInteger(projetoId) || projetoId <= 0) {
		return c.json({ error: "id inválido" }, 400);
	}
	const user = c.get("user")!;
	if (!(await temAcessoAoProjeto(c.env.DB, user.id, user.perfil, projetoId))) {
		return c.json({ error: "projeto não encontrado" }, 404);
	}
	await next();
});

/**
 * Fragmento SQL: restringe a projetos em que o usuário é membro. Só deve
 * ser usado quando ehParceiro(perfil) já foi confirmado pelo chamador —
 * para os demais perfis a visão continua irrestrita. `usuarioId` nunca vem
 * de input de request (sempre de `c.get("user").id`, já resolvido pela
 * sessão), por isso é seguro interpolar como literal numérico, no mesmo
 * padrão dos fragmentos de atraso.ts (sqlProjetoAtrasado etc.).
 */
export function sqlProjetosDoParceiro(aliasProjeto: string, usuarioId: number): string {
	return `EXISTS (SELECT 1 FROM projeto_membros pm WHERE pm.projeto_id = ${aliasProjeto}.id AND pm.usuario_id = ${usuarioId})`;
}

/**
 * Remove campos comerciais/estratégicos da resposta de projeto quando o
 * perfil é Parceiro — nunca confia só no frontend para escondê-los
 * (exigência explícita da Rodada 03). valor_contratado é o valor do
 * contrato com o cliente; observacoes é texto livre interno (pode conter
 * negociação, margem, dado administrativo) — nenhum dos dois é necessário
 * para o Parceiro executar o trabalho dele.
 */
export function sanitizarProjetoParaPerfil<T extends Record<string, unknown> | null>(projeto: T, perfil: string): T {
	if (!ehParceiro(perfil) || !projeto) return projeto;
	const resto = { ...projeto };
	delete resto.valor_contratado;
	delete resto.observacoes;
	return resto as T;
}

/** Mesma lógica, para projeto_etapas.observacao_interna (nota interna, não operacional). */
export function sanitizarEtapaParaPerfil<T extends Record<string, unknown> | null>(etapa: T, perfil: string): T {
	if (!ehParceiro(perfil) || !etapa) return etapa;
	const resto = { ...etapa };
	delete resto.observacao_interna;
	return resto as T;
}

/**
 * Fragmento SQL: restringe a clientes que têm pelo menos um projeto em que
 * o usuário é membro. Parceiro não enumera a carteira completa de clientes
 * da VOIA — só os relacionados aos projetos em que participa.
 */
export function sqlClientesDoParceiro(aliasCliente: string, usuarioId: number): string {
	return `EXISTS (
		SELECT 1 FROM projetos p
		JOIN projeto_membros pm ON pm.projeto_id = p.id
		WHERE p.cliente_id = ${aliasCliente}.id AND pm.usuario_id = ${usuarioId}
	)`;
}

export async function temAcessoAoCliente(db: D1Database, usuarioId: number, perfil: string, clienteId: number): Promise<boolean> {
	if (!ehParceiro(perfil)) return true;
	const row = await db
		.prepare(
			`SELECT 1 FROM projetos p JOIN projeto_membros pm ON pm.projeto_id = p.id
			 WHERE p.cliente_id = ? AND pm.usuario_id = ?`,
		)
		.bind(clienteId, usuarioId)
		.first();
	return row !== null;
}

/**
 * Remove dados administrativos do cliente para o Parceiro (quem é o
 * responsável interno e observações internas) — ele só precisa do mínimo
 * necessário para executar o trabalho (nome, contato, endereço).
 */
export function sanitizarClienteParaPerfil<T extends Record<string, unknown> | null>(cliente: T, perfil: string): T {
	if (!ehParceiro(perfil) || !cliente) return cliente;
	const resto = { ...cliente };
	delete resto.observacoes;
	delete resto.responsavel_interno_id;
	delete resto.responsavel_interno_nome;
	return resto as T;
}

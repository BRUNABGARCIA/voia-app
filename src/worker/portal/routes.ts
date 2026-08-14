import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import { verifyPassword } from "../auth/hash";
import { obterProgressoAtual } from "../projetos/progresso";
import {
	createPortalSession,
	destroyPortalSession,
	PORTAL_SESSION_COOKIE_NAME,
	PORTAL_SESSION_DURATION_SECONDS,
} from "./session";
import { withPortalSession, requirePortalAuth, type PortalEnv } from "./middleware";
import {
	listarProcessosAutorizados,
	estaAutorizado,
	buscarTiposServico,
	buscarEtapasPublicas,
	buscarAtualizacoesPublicas,
	etapaAtualEProxima,
} from "./processos";

const loginSchema = z.object({
	email: z.string().trim().toLowerCase().min(1).max(254).email(),
	senha: z.string().min(1).max(200),
});

const portal = new Hono<PortalEnv>();

portal.post("/login", async (c) => {
	const body = await c.req.json().catch(() => null);
	const parsed = loginSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "credenciais inválidas" }, 401);
	}

	const { email, senha } = parsed.data;

	const contato = await c.env.DB.prepare(
		`SELECT cc.id, cc.nome, cc.email, cc.senha_hash, cc.cliente_id, cl.nome AS cliente_nome
		 FROM cliente_contatos cc
		 JOIN clientes cl ON cl.id = cc.cliente_id
		 WHERE cc.email = ? AND cc.ativo = 1`,
	)
		.bind(email)
		.first<{ id: number; nome: string; email: string; senha_hash: string | null; cliente_id: number; cliente_nome: string }>();

	if (!contato || !contato.senha_hash || !(await verifyPassword(senha, contato.senha_hash))) {
		return c.json({ error: "credenciais inválidas" }, 401);
	}

	const token = await createPortalSession(c.env.DB, contato.id);

	await c.env.DB.prepare("UPDATE cliente_contatos SET ultimo_login_em = CURRENT_TIMESTAMP WHERE id = ?")
		.bind(contato.id)
		.run();

	setCookie(c, PORTAL_SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: new URL(c.req.url).protocol === "https:",
		sameSite: "Lax",
		path: "/",
		maxAge: PORTAL_SESSION_DURATION_SECONDS,
	});

	return c.json({
		id: contato.id,
		nome: contato.nome,
		email: contato.email,
		clienteId: contato.cliente_id,
		clienteNome: contato.cliente_nome,
	});
});

portal.post("/logout", withPortalSession, async (c) => {
	const token = getCookie(c, PORTAL_SESSION_COOKIE_NAME);
	if (token) {
		await destroyPortalSession(c.env.DB, token);
	}
	deleteCookie(c, PORTAL_SESSION_COOKIE_NAME, { path: "/" });
	return c.json({ ok: true });
});

portal.get("/me", withPortalSession, requirePortalAuth, (c) => {
	return c.json(c.get("contato"));
});

portal.get("/processos", withPortalSession, requirePortalAuth, async (c) => {
	const contato = c.get("contato")!;
	const processos = await listarProcessosAutorizados(c.env.DB, contato.id);

	const enriquecidos = await Promise.all(
		processos.map(async (processo) => {
			const [tiposServico, etapasVisiveis] = await Promise.all([
				buscarTiposServico(c.env.DB, processo.id),
				buscarEtapasPublicas(c.env.DB, processo.id),
			]);
			const { atual, proxima } = etapaAtualEProxima(etapasVisiveis);

			return {
				...processo,
				tiposServico,
				etapaAtual: atual ? { nome: atual.nome, atrasada: atual.atrasada } : null,
				proximoPrazo: atual?.dataFimPrevista ?? proxima?.dataFimPrevista ?? null,
			};
		}),
	);

	return c.json({ processos: enriquecidos });
});

portal.get("/processos/:id", withPortalSession, requirePortalAuth, async (c) => {
	const projetoId = Number(c.req.param("id"));
	if (!Number.isInteger(projetoId) || projetoId <= 0) {
		return c.json({ error: "processo não encontrado" }, 404);
	}

	const contato = c.get("contato")!;

	// Autorização por processo específico, checada no backend a cada
	// chamada — trocar o :id na URL para outro processo nunca libera
	// acesso a algo que este contato não tenha explicitamente autorizado.
	// "não encontrado" cobre tanto "não existe" quanto "não autorizado",
	// de propósito, para não revelar a existência de processos de terceiros.
	const autorizado = await estaAutorizado(c.env.DB, contato.id, projetoId);
	if (!autorizado) {
		return c.json({ error: "processo não encontrado" }, 404);
	}

	const processo = await c.env.DB.prepare(
		"SELECT id, codigo, nome, status, progresso, prazo_previsto AS prazoPrevisto FROM projetos WHERE id = ?",
	)
		.bind(projetoId)
		.first<{ id: number; codigo: string | null; nome: string; status: string; progresso: number; prazoPrevisto: string | null }>();

	if (!processo) {
		return c.json({ error: "processo não encontrado" }, 404);
	}

	const [tiposServico, etapas, atualizacoes, progressoAtual] = await Promise.all([
		buscarTiposServico(c.env.DB, projetoId),
		buscarEtapasPublicas(c.env.DB, projetoId),
		buscarAtualizacoesPublicas(c.env.DB, projetoId),
		obterProgressoAtual(c.env.DB, projetoId),
	]);

	const { atual, proxima } = etapaAtualEProxima(etapas);

	return c.json({
		processo: {
			...processo,
			tiposServico,
			progresso: progressoAtual.progresso,
			baseadoEm: progressoAtual.baseadoEm,
			totalEtapas: progressoAtual.totalEtapas,
			etapasConcluidas: progressoAtual.etapasConcluidas,
			totalTarefas: progressoAtual.totalTarefas,
			tarefasConcluidas: progressoAtual.tarefasConcluidas,
		},
		etapaAtual: atual,
		proximaEtapa: proxima,
		etapas,
		atualizacoes,
	});
});

export default portal;

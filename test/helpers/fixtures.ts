import { env } from "cloudflare:workers";
import { hashPassword } from "../../src/worker/auth/hash";

/** Cria um usuário interno já com senha definida e devolve o id. */
export async function criarUsuario(email: string, perfil: string, senha = "senha-padrao-teste"): Promise<number> {
	const row = await env.DB.prepare(
		"INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash) VALUES (?, ?, ?, 1, ?) RETURNING id",
	)
		.bind(`Usuário ${perfil}`, email, perfil, await hashPassword(senha))
		.first<{ id: number }>();
	return row!.id;
}

export async function criarCliente(nome: string): Promise<number> {
	const row = await env.DB.prepare("INSERT INTO clientes (tipo, nome) VALUES ('PJ', ?) RETURNING id")
		.bind(nome)
		.first<{ id: number }>();
	return row!.id;
}

export async function criarProjeto(clienteId: number, criadoPorId: number, nome: string): Promise<number> {
	const row = await env.DB.prepare(
		"INSERT INTO projetos (cliente_id, nome, criado_por_id) VALUES (?, ?, ?) RETURNING id",
	)
		.bind(clienteId, nome, criadoPorId)
		.first<{ id: number }>();
	return row!.id;
}

export async function criarEtapa(projetoId: number, nome: string): Promise<number> {
	const row = await env.DB.prepare("INSERT INTO projeto_etapas (projeto_id, nome, ordem) VALUES (?, ?, 1) RETURNING id")
		.bind(projetoId, nome)
		.first<{ id: number }>();
	return row!.id;
}

export async function criarTarefa(projetoId: number, etapaId: number, nome: string): Promise<number> {
	const row = await env.DB.prepare(
		"INSERT INTO projeto_tarefas (projeto_id, etapa_id, nome, ordem) VALUES (?, ?, ?, 1) RETURNING id",
	)
		.bind(projetoId, etapaId, nome)
		.first<{ id: number }>();
	return row!.id;
}

export async function criarDocumento(projetoId: number, autorId: number, nome: string): Promise<number> {
	const row = await env.DB.prepare(
		"INSERT INTO projeto_documentos (projeto_id, nome, autor_id, storage_key) VALUES (?, ?, ?, NULL) RETURNING id",
	)
		.bind(projetoId, nome, autorId)
		.first<{ id: number }>();
	return row!.id;
}

/** Vincula um usuário (Parceiro) a um projeto em projeto_membros — mesma estrutura que a Rodada 03 reaproveita para "Meus Projetos". */
export async function vincularMembro(projetoId: number, usuarioId: number, funcao = "colaborador"): Promise<void> {
	await env.DB.prepare("INSERT INTO projeto_membros (projeto_id, usuario_id, funcao) VALUES (?, ?, ?)")
		.bind(projetoId, usuarioId, funcao)
		.run();
}

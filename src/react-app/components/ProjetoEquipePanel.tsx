import { useCallback, useEffect, useState } from "react";
import { FUNCAO_MEMBRO_LABEL, FUNCOES_MEMBRO, type FuncaoMembro, type MembroProjeto, type Projeto } from "../lib/projeto-tipos";

interface UsuarioOpcao {
	id: number;
	nome: string;
}

export default function ProjetoEquipePanel({
	projetoId,
	gerenteId,
	gerenteNome,
	podeGerenciar,
	onResponsavelAlterado,
}: {
	projetoId: number;
	gerenteId: number | null;
	gerenteNome: string | null;
	podeGerenciar: boolean;
	onResponsavelAlterado: (projeto: Projeto) => void;
}) {
	const [membros, setMembros] = useState<MembroProjeto[] | null>(null);
	const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [novoUsuarioId, setNovoUsuarioId] = useState("");
	const [novaFuncao, setNovaFuncao] = useState<FuncaoMembro>("colaborador");
	const [adicionando, setAdicionando] = useState(false);
	const [editandoResponsavel, setEditandoResponsavel] = useState(false);
	const [novoResponsavelId, setNovoResponsavelId] = useState(gerenteId ? String(gerenteId) : "");
	const [salvandoResponsavel, setSalvandoResponsavel] = useState(false);

	const carregarMembros = useCallback(() => {
		fetch(`/api/projetos/${projetoId}/membros`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar a equipe");
				return res.json() as Promise<{ membros: MembroProjeto[] }>;
			})
			.then((data) => setMembros(data.membros))
			.catch(() => setError("Não foi possível carregar a equipe."));
	}, [projetoId]);

	useEffect(() => {
		carregarMembros();
	}, [carregarMembros]);

	useEffect(() => {
		if (!podeGerenciar) return;
		fetch("/api/usuarios/opcoes", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ usuarios: UsuarioOpcao[] }>) : null))
			.then((data) => data && setUsuarios(data.usuarios))
			.catch(() => {});
	}, [podeGerenciar]);

	useEffect(() => {
		setNovoResponsavelId(gerenteId ? String(gerenteId) : "");
	}, [gerenteId]);

	async function salvarResponsavel() {
		setError(null);
		setSalvandoResponsavel(true);
		try {
			const res = await fetch(`/api/projetos/${projetoId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ gerente_id: novoResponsavelId ? Number(novoResponsavelId) : null }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível alterar o responsável principal");
			}
			const { projeto } = (await res.json()) as { projeto: Projeto };
			onResponsavelAlterado(projeto);
			setEditandoResponsavel(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível alterar o responsável principal");
		} finally {
			setSalvandoResponsavel(false);
		}
	}

	async function adicionarMembro() {
		if (!novoUsuarioId) return;
		setError(null);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/membros`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ usuario_id: Number(novoUsuarioId), funcao: novaFuncao }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível adicionar o membro");
			}
			setNovoUsuarioId("");
			setNovaFuncao("colaborador");
			setAdicionando(false);
			carregarMembros();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível adicionar o membro");
		}
	}

	async function alterarFuncao(usuarioId: number, funcao: FuncaoMembro) {
		setError(null);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/membros/${usuarioId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ funcao }),
			});
			if (!res.ok) throw new Error("não foi possível alterar a função");
			carregarMembros();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível alterar a função");
		}
	}

	async function removerMembro(usuarioId: number) {
		setError(null);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/membros/${usuarioId}`, {
				method: "DELETE",
				credentials: "same-origin",
			});
			if (!res.ok) throw new Error("não foi possível remover o membro");
			carregarMembros();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível remover o membro");
		}
	}

	const usuariosDisponiveis = usuarios.filter((u) => !membros?.some((m) => m.usuario_id === u.id));

	return (
		<div className="mt-6 space-y-6">
			<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
				<div className="flex items-center justify-between">
					<h2 className="font-display text-lg text-voia-green-900">Responsável principal</h2>
					{podeGerenciar && !editandoResponsavel && (
						<button
							type="button"
							onClick={() => setEditandoResponsavel(true)}
							className="text-xs font-medium text-voia-green-800 hover:underline"
						>
							{gerenteNome ? "Trocar" : "Definir"}
						</button>
					)}
				</div>

				{editandoResponsavel ? (
					<div className="mt-3 flex flex-wrap items-center gap-3">
						<select
							value={novoResponsavelId}
							onChange={(e) => setNovoResponsavelId(e.target.value)}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							<option value="">Nenhum</option>
							{usuarios.map((u) => (
								<option key={u.id} value={u.id}>
									{u.nome}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={salvarResponsavel}
							disabled={salvandoResponsavel}
							className="rounded-control bg-voia-gold-500 px-3 py-1.5 text-sm font-medium text-voia-green-950 hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
						>
							{salvandoResponsavel ? "Salvando…" : "Salvar"}
						</button>
						<button
							type="button"
							onClick={() => {
								setEditandoResponsavel(false);
								setNovoResponsavelId(gerenteId ? String(gerenteId) : "");
							}}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-(--color-surface)"
						>
							Cancelar
						</button>
					</div>
				) : (
					<p className="mt-2 text-sm text-voia-neutral-900">{gerenteNome ?? "Nenhum responsável definido"}</p>
				)}
			</div>

			<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
				<div className="flex items-center justify-between">
					<h2 className="font-display text-lg text-voia-green-900">Membros</h2>
					{podeGerenciar && !adicionando && (
						<button
							type="button"
							onClick={() => setAdicionando(true)}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
						>
							+ Adicionar membro
						</button>
					)}
				</div>

				{adicionando && (
					<div className="mt-4 flex flex-wrap items-end gap-3 rounded-control bg-voia-beige-50 p-3">
						<div>
							<label htmlFor="novo-membro" className="block text-xs font-medium text-voia-neutral-700">
								Usuário
							</label>
							<select
								id="novo-membro"
								value={novoUsuarioId}
								onChange={(e) => setNovoUsuarioId(e.target.value)}
								className="mt-1 rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
							>
								<option value="">Selecione…</option>
								{usuariosDisponiveis.map((u) => (
									<option key={u.id} value={u.id}>
										{u.nome}
									</option>
								))}
							</select>
						</div>
						<div>
							<label htmlFor="nova-funcao" className="block text-xs font-medium text-voia-neutral-700">
								Função
							</label>
							<select
								id="nova-funcao"
								value={novaFuncao}
								onChange={(e) => setNovaFuncao(e.target.value as FuncaoMembro)}
								className="mt-1 rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
							>
								{FUNCOES_MEMBRO.map((f) => (
									<option key={f} value={f}>
										{FUNCAO_MEMBRO_LABEL[f]}
									</option>
								))}
							</select>
						</div>
						<button
							type="button"
							onClick={adicionarMembro}
							disabled={!novoUsuarioId}
							className="rounded-control bg-voia-gold-500 px-3 py-1.5 text-sm font-medium text-voia-green-950 hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
						>
							Adicionar
						</button>
						<button
							type="button"
							onClick={() => setAdicionando(false)}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-(--color-surface)"
						>
							Cancelar
						</button>
					</div>
				)}

				{error && <p className="mt-3 text-sm text-voia-danger">{error}</p>}

				{!membros && <p className="mt-4 text-sm text-voia-neutral-500">Carregando…</p>}

				{membros && membros.length === 0 && (
					<p className="mt-4 text-sm text-voia-neutral-500">Nenhum membro adicionado ainda.</p>
				)}

				{membros && membros.length > 0 && (
					<div className="mt-4 overflow-x-auto">
						<table className="w-full min-w-[480px] text-left text-sm">
							<thead>
								<tr className="border-b border-voia-neutral-100 text-xs uppercase tracking-wide text-voia-neutral-500">
									<th className="py-2 font-medium">Nome</th>
									<th className="py-2 font-medium">Função</th>
									{podeGerenciar && <th className="py-2 font-medium">Ações</th>}
								</tr>
							</thead>
							<tbody>
								{membros.map((membro) => (
									<tr key={membro.usuario_id} className="border-b border-voia-neutral-100 last:border-b-0">
										<td className="py-2 font-medium text-voia-neutral-900">{membro.nome}</td>
										<td className="py-2">
											{podeGerenciar ? (
												<select
													value={membro.funcao}
													onChange={(e) => alterarFuncao(membro.usuario_id, e.target.value as FuncaoMembro)}
													className="rounded-control border border-voia-neutral-100 px-2 py-1 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
												>
													{FUNCOES_MEMBRO.map((f) => (
														<option key={f} value={f}>
															{FUNCAO_MEMBRO_LABEL[f]}
														</option>
													))}
												</select>
											) : (
												<span className="text-voia-neutral-700">{FUNCAO_MEMBRO_LABEL[membro.funcao]}</span>
											)}
										</td>
										{podeGerenciar && (
											<td className="py-2">
												<button
													type="button"
													onClick={() => removerMembro(membro.usuario_id)}
													className="text-xs font-medium text-voia-danger hover:underline"
												>
													Remover
												</button>
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}

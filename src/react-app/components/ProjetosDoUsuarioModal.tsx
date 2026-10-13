import { useEffect, useState } from "react";

interface ProjetoDoUsuario {
	id: number;
	codigo: string | null;
	nome: string;
	status: string;
	funcao: string;
	cliente_nome: string;
}

/**
 * Painel simples (admin-only) para visualizar a quais projetos um usuário
 * está vinculado — pedido explícito da Rodada 03 ("visualizar os projetos
 * associados ao parceiro"). Reaproveita GET /api/usuarios/:id/projetos
 * (projeto_membros), sem nenhuma tabela nova. Gerenciar o vínculo em si
 * (adicionar/remover) já existe na aba Equipe de cada projeto — este
 * painel é só a visão inversa, de leitura.
 */
export default function ProjetosDoUsuarioModal({
	usuarioId,
	usuarioNome,
	onClose,
}: {
	usuarioId: number;
	usuarioNome: string;
	onClose: () => void;
}) {
	const [projetos, setProjetos] = useState<ProjetoDoUsuario[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch(`/api/usuarios/${usuarioId}/projetos`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("falha");
				return res.json() as Promise<{ projetos: ProjetoDoUsuario[] }>;
			})
			.then((data) => {
				if (!cancelled) setProjetos(data.projetos);
			})
			.catch(() => {
				if (!cancelled) setError("Não foi possível carregar os projetos.");
			});
		return () => {
			cancelled = true;
		};
	}, [usuarioId]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-card bg-(--color-surface) shadow-elevated"
			>
				<div className="shrink-0 border-b border-voia-neutral-100 px-(--space-card) py-4">
					<h2 className="font-display text-xl text-voia-green-900">Projetos de {usuarioNome}</h2>
				</div>
				<div className="flex-1 overflow-y-auto px-(--space-card) py-4">
					{error && <p className="text-sm text-voia-danger">{error}</p>}
					{!error && !projetos && <p className="text-sm text-voia-neutral-500">Carregando…</p>}
					{projetos && projetos.length === 0 && (
						<p className="text-sm text-voia-neutral-500">Este usuário ainda não está vinculado a nenhum projeto.</p>
					)}
					{projetos && projetos.length > 0 && (
						<ul className="space-y-3">
							{projetos.map((p) => (
								<li key={p.id} className="text-sm">
									<span className="font-medium text-voia-neutral-900">{p.nome}</span>
									<span className="ml-2 text-xs text-voia-neutral-500">
										{p.cliente_nome} · {p.funcao}
									</span>
								</li>
							))}
						</ul>
					)}
				</div>
				<div className="flex shrink-0 justify-end gap-3 border-t border-voia-neutral-100 px-(--space-card) py-4">
					<button
						type="button"
						onClick={onClose}
						className="rounded-control border border-voia-neutral-100 px-4 py-2 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						Fechar
					</button>
				</div>
			</div>
		</div>
	);
}

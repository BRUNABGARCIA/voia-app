import { useEffect, useState } from "react";
import { formatarMoeda } from "../lib/projeto-tipos";

const TIPO_LABEL: Record<string, string> = {
	fixo: "Valor fixo",
	percentual: "Percentual",
	por_etapa: "Por etapa",
	por_entrega: "Por entrega",
	bonus: "Bônus",
	adiantamento: "Adiantamento",
	reembolso: "Reembolso",
};

interface RemuneracaoDoParceiro {
	id: number;
	projeto_nome: string;
	tipo: string;
	valor_acordado: number;
	percentual: number | null;
	ativo: number;
}

/**
 * Painel simples (admin-only) para visualizar a remuneração de um parceiro
 * em todos os projetos — visão inversa de "Remuneração de parceiros" (que
 * já existe na aba Equipe de cada projeto). Só leitura: criar/editar
 * remuneração continua feito por projeto, para não duplicar fluxo.
 */
export default function RecebimentosDoUsuarioModal({
	usuarioId,
	usuarioNome,
	onClose,
}: {
	usuarioId: number;
	usuarioNome: string;
	onClose: () => void;
}) {
	const [remuneracoes, setRemuneracoes] = useState<RemuneracaoDoParceiro[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch(`/api/financeiro/parceiros/${usuarioId}/remuneracoes`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("falha");
				return res.json() as Promise<{ remuneracoes: RemuneracaoDoParceiro[] }>;
			})
			.then((data) => {
				if (!cancelled) setRemuneracoes(data.remuneracoes);
			})
			.catch(() => {
				if (!cancelled) setError("Não foi possível carregar os recebimentos.");
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
					<h2 className="font-display text-xl text-voia-green-900">Recebimentos de {usuarioNome}</h2>
				</div>
				<div className="flex-1 overflow-y-auto px-(--space-card) py-4">
					{error && <p className="text-sm text-voia-danger">{error}</p>}
					{!error && !remuneracoes && <p className="text-sm text-voia-neutral-500">Carregando…</p>}
					{remuneracoes && remuneracoes.length === 0 && (
						<p className="text-sm text-voia-neutral-500">Este parceiro ainda não possui remuneração cadastrada.</p>
					)}
					{remuneracoes && remuneracoes.length > 0 && (
						<ul className="space-y-3">
							{remuneracoes.map((r) => (
								<li key={r.id} className="text-sm">
									<span className="font-medium text-voia-neutral-900">{r.projeto_nome}</span>
									<span className="ml-2 rounded-control bg-voia-beige-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-700">
										{TIPO_LABEL[r.tipo] ?? r.tipo}
									</span>
									{!r.ativo && (
										<span className="ml-2 rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
											Inativa
										</span>
									)}
									<div className="mt-0.5 text-xs text-voia-neutral-500">
										{formatarMoeda(r.valor_acordado)}
										{r.tipo === "percentual" && r.percentual !== null && ` · ${r.percentual}%`}
									</div>
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

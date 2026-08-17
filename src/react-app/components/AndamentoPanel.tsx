import { useCallback, useEffect, useState } from "react";
import AtualizacaoModal from "./AtualizacaoModal";
import { TIPO_ATUALIZACAO_LABEL, type Atualizacao } from "../lib/projeto-tipos";

export default function AndamentoPanel({ projetoId, podeEditar }: { projetoId: number; podeEditar: boolean }) {
	const [atualizacoes, setAtualizacoes] = useState<Atualizacao[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);

	const carregar = useCallback(() => {
		fetch(`/api/projetos/${projetoId}/atualizacoes`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar o andamento");
				return res.json() as Promise<{ atualizacoes: Atualizacao[] }>;
			})
			.then((data) => setAtualizacoes(data.atualizacoes))
			.catch(() => setError("Não foi possível carregar o andamento."));
	}, [projetoId]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	function formatarDataHora(valor: string): string {
		const data = new Date(valor.replace(" ", "T") + "Z");
		if (Number.isNaN(data.getTime())) return valor;
		return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
	}

	if (error && !atualizacoes) {
		return <p className="mt-6 text-sm text-voia-danger">{error}</p>;
	}

	if (!atualizacoes) {
		return <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>;
	}

	return (
		<div className="mt-6 rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-display text-lg text-voia-green-900">Andamento</h2>
					<p className="mt-1 text-sm text-voia-neutral-500">Histórico de eventos do processo.</p>
				</div>
				{podeEditar && (
					<button
						type="button"
						onClick={() => setCriando(true)}
						className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						+ Nova atualização
					</button>
				)}
			</div>

			{error && <p className="mt-3 text-sm text-voia-danger">{error}</p>}

			{atualizacoes.length === 0 ? (
				<p className="mt-4 text-sm text-voia-neutral-500">Nenhuma atualização registrada ainda.</p>
			) : (
				<ol className="mt-4 space-y-4 border-l-2 border-voia-neutral-100 pl-4">
					{atualizacoes.map((atualizacao) => (
						<li key={atualizacao.id} className="relative">
							<span className="absolute -left-[1.375rem] top-1 h-2.5 w-2.5 rounded-full bg-voia-gold-500" />
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-medium text-voia-neutral-900">{atualizacao.titulo}</span>
								{atualizacao.tipo_evento ? (
									<span className="rounded-control bg-voia-info/15 px-2 py-0.5 text-xs font-medium text-voia-info">
										Sistema
									</span>
								) : (
									<span className="rounded-control bg-voia-gold-500/20 px-2 py-0.5 text-xs font-medium text-voia-green-800">
										Atualização manual
									</span>
								)}
								<span className="rounded-control bg-voia-beige-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-700">
									{TIPO_ATUALIZACAO_LABEL[atualizacao.tipo]}
								</span>
								{atualizacao.visivel_cliente === 1 ? (
									<span className="rounded-control bg-voia-success/15 px-2 py-0.5 text-xs font-medium text-voia-success">
										Visível ao cliente
									</span>
								) : (
									<span className="rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
										Interna
									</span>
								)}
							</div>
							{atualizacao.descricao && <p className="mt-1 text-sm text-voia-neutral-700">{atualizacao.descricao}</p>}
							<p className="mt-1 text-xs text-voia-neutral-500">
								{formatarDataHora(atualizacao.criado_em)} · {atualizacao.criado_por_nome}
								{atualizacao.etapa_nome && ` · ${atualizacao.etapa_nome}`}
							</p>
						</li>
					))}
				</ol>
			)}

			{criando && (
				<AtualizacaoModal
					projetoId={projetoId}
					onClose={() => setCriando(false)}
					onSaved={() => {
						setCriando(false);
						carregar();
					}}
				/>
			)}
		</div>
	);
}

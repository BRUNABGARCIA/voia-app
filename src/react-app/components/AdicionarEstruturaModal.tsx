import { useEffect, useState } from "react";
import ModalShell from "./ModalShell";

interface TipoDisponivel {
	tipoServicoId: number;
	nome: string;
	totalEtapas: number;
	totalTarefas: number;
}

export default function AdicionarEstruturaModal({
	projetoId,
	onClose,
	onSaved,
}: {
	projetoId: number;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [disponiveis, setDisponiveis] = useState<TipoDisponivel[] | null>(null);
	const [selecionado, setSelecionado] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetch(`/api/projetos/${projetoId}/tipos-servico-disponiveis`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar os tipos de serviço disponíveis");
				return res.json() as Promise<{ tiposServicoDisponiveis: TipoDisponivel[] }>;
			})
			.then((data) => setDisponiveis(data.tiposServicoDisponiveis))
			.catch(() => setError("Não foi possível carregar os tipos de serviço disponíveis."));
	}, [projetoId]);

	async function confirmar() {
		if (selecionado === null) return;
		setError(null);
		setSubmitting(true);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/gerar-estrutura`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ tipo_servico_id: selecionado }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível gerar a estrutura");
			}
			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível gerar a estrutura");
		} finally {
			setSubmitting(false);
		}
	}

	const tipoSelecionado = disponiveis?.find((t) => t.tipoServicoId === selecionado) ?? null;

	return (
		<ModalShell
			title="Adicionar estrutura de um Tipo de Serviço"
			onClose={onClose}
			onSubmit={(e) => {
				e.preventDefault();
				void confirmar();
			}}
			maxWidthClassName="max-w-lg"
			footer={
				<>
					<button
						type="button"
						onClick={onClose}
						className="rounded-control border border-voia-neutral-100 px-4 py-2 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={submitting || selecionado === null}
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
					>
						{submitting ? "Gerando…" : "Adicionar estrutura"}
					</button>
				</>
			}
		>
			<div className="space-y-3">
				<p className="text-sm text-voia-neutral-700">
					Escolha um tipo de serviço deste projeto para copiar as etapas e tarefas do seu modelo. Isso não afeta a
					estrutura já existente no projeto.
				</p>

				{disponiveis === null ? (
					<p className="text-sm text-voia-neutral-500">Carregando…</p>
				) : disponiveis.length === 0 ? (
					<p className="text-sm text-voia-neutral-500">
						Não há tipos de serviço pendentes de geração — todos os tipos vinculados ao projeto já têm estrutura
						gerada, ou não têm modelo configurado.
					</p>
				) : (
					<ul className="space-y-2">
						{disponiveis.map((tipo) => (
							<li key={tipo.tipoServicoId}>
								<label className="flex items-center gap-2 rounded-control border border-voia-neutral-100 px-3 py-2 text-sm">
									<input
										type="radio"
										name="tipo-estrutura"
										checked={selecionado === tipo.tipoServicoId}
										onChange={() => setSelecionado(tipo.tipoServicoId)}
										className="h-4 w-4 text-voia-gold-500 focus:ring-voia-gold-500"
									/>
									<span className="flex-1">{tipo.nome}</span>
									<span className="text-xs text-voia-neutral-500">
										{tipo.totalEtapas} {tipo.totalEtapas === 1 ? "etapa" : "etapas"} · {tipo.totalTarefas}{" "}
										{tipo.totalTarefas === 1 ? "tarefa" : "tarefas"}
									</span>
								</label>
							</li>
						))}
					</ul>
				)}

				{tipoSelecionado && (
					<p className="rounded-control bg-voia-beige-100 px-3 py-2 text-xs text-voia-neutral-700">
						Serão criadas {tipoSelecionado.totalEtapas} etapa(s) e {tipoSelecionado.totalTarefas} tarefa(s) a partir do
						modelo de "{tipoSelecionado.nome}".
					</p>
				)}

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

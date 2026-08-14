import { useEffect, useState } from "react";
import ModalShell from "./ModalShell";
import type { ContatoCliente, ProcessoAutorizavel } from "../lib/cliente-tipos";

export default function ContatoProcessosModal({
	clienteId,
	contato,
	onClose,
	onSaved,
}: {
	clienteId: number;
	contato: ContatoCliente;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [processos, setProcessos] = useState<ProcessoAutorizavel[] | null>(null);
	const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetch(`/api/clientes/${clienteId}/contatos/${contato.id}/processos`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar os processos");
				return res.json() as Promise<{ processos: ProcessoAutorizavel[] }>;
			})
			.then((data) => {
				setProcessos(data.processos);
				setSelecionados(new Set(data.processos.filter((p) => p.autorizado === 1).map((p) => p.id)));
			})
			.catch(() => setError("Não foi possível carregar os processos deste cliente."));
	}, [clienteId, contato.id]);

	function alternar(id: number) {
		setSelecionados((atual) => {
			const novo = new Set(atual);
			if (novo.has(id)) novo.delete(id);
			else novo.add(id);
			return novo;
		});
	}

	async function salvar() {
		setError(null);
		setSubmitting(true);
		try {
			const res = await fetch(`/api/clientes/${clienteId}/contatos/${contato.id}/processos`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ projeto_ids: Array.from(selecionados) }),
			});
			if (!res.ok) throw new Error("não foi possível salvar as autorizações");
			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar as autorizações");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title={`Processos autorizados — ${contato.nome}`}
			onClose={onClose}
			onSubmit={(e) => {
				e.preventDefault();
				void salvar();
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
						disabled={submitting || processos === null}
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
					>
						{submitting ? "Salvando…" : "Salvar autorizações"}
					</button>
				</>
			}
		>
			<div className="space-y-3">
				<p className="text-sm text-voia-neutral-700">
					Marque os processos deste cliente que {contato.nome} pode acompanhar no Portal.
				</p>

				{processos === null ? (
					<p className="text-sm text-voia-neutral-500">Carregando…</p>
				) : processos.length === 0 ? (
					<p className="text-sm text-voia-neutral-500">Este cliente ainda não tem projetos cadastrados.</p>
				) : (
					<ul className="space-y-2">
						{processos.map((processo) => (
							<li key={processo.id}>
								<label className="flex items-center gap-2 rounded-control border border-voia-neutral-100 px-3 py-2 text-sm">
									<input
										type="checkbox"
										checked={selecionados.has(processo.id)}
										onChange={() => alternar(processo.id)}
										className="h-4 w-4 rounded border-voia-neutral-100 text-voia-gold-500 focus:ring-voia-gold-500"
									/>
									<span className="flex-1">
										{processo.codigo && <span className="text-voia-neutral-500">{processo.codigo} · </span>}
										{processo.nome}
									</span>
								</label>
							</li>
						))}
					</ul>
				)}

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

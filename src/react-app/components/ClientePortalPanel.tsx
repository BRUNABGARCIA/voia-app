import { useCallback, useEffect, useState } from "react";
import ContatoModal from "./ContatoModal";
import ContatoProcessosModal from "./ContatoProcessosModal";
import DefinirSenhaContatoModal from "./DefinirSenhaContatoModal";
import type { ContatoCliente } from "../lib/cliente-tipos";

export default function ClientePortalPanel({ clienteId }: { clienteId: number }) {
	const [contatos, setContatos] = useState<ContatoCliente[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);
	const [editando, setEditando] = useState<ContatoCliente | null>(null);
	const [gerenciandoProcessos, setGerenciandoProcessos] = useState<ContatoCliente | null>(null);
	const [definindoSenha, setDefinindoSenha] = useState<ContatoCliente | null>(null);
	const [removendoId, setRemovendoId] = useState<number | null>(null);

	const carregar = useCallback(() => {
		fetch(`/api/clientes/${clienteId}/contatos`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar os contatos");
				return res.json() as Promise<{ contatos: ContatoCliente[] }>;
			})
			.then((data) => setContatos(data.contatos))
			.catch(() => setError("Não foi possível carregar os acessos deste cliente."));
	}, [clienteId]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	function handleSaved() {
		setCriando(false);
		setEditando(null);
		carregar();
	}

	async function remover(contato: ContatoCliente) {
		if (!window.confirm(`Remover o contato "${contato.nome}"? Ele perderá o acesso ao Portal, se tiver.`)) return;
		setError(null);
		setRemovendoId(contato.id);
		try {
			const res = await fetch(`/api/clientes/${clienteId}/contatos/${contato.id}`, {
				method: "DELETE",
				credentials: "same-origin",
			});
			if (!res.ok) throw new Error("não foi possível remover o contato");
			carregar();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível remover o contato");
		} finally {
			setRemovendoId(null);
		}
	}

	if (error && !contatos) {
		return <p className="mt-6 text-sm text-voia-danger">{error}</p>;
	}

	if (!contatos) {
		return <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>;
	}

	return (
		<div className="mt-6 rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-display text-lg text-voia-green-900">Portal do Cliente</h2>
					<p className="mt-1 text-sm text-voia-neutral-500">
						Pessoas com acesso externo e os processos que cada uma pode acompanhar.
					</p>
				</div>
				<button
					type="button"
					onClick={() => setCriando(true)}
					className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
				>
					+ Novo contato
				</button>
			</div>

			{error && <p className="mt-3 text-sm text-voia-danger">{error}</p>}

			{contatos.length === 0 ? (
				<p className="mt-4 text-sm text-voia-neutral-500">Nenhum contato com acesso externo cadastrado ainda.</p>
			) : (
				<ul className="mt-4 space-y-3">
					{contatos.map((contato) => (
						<li key={contato.id} className="rounded-control border border-voia-neutral-100 p-3">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-medium text-voia-neutral-900">{contato.nome}</span>
										{contato.possui_acesso === 1 ? (
											<span className="rounded-control bg-voia-success/15 px-2 py-0.5 text-xs font-medium text-voia-success">
												Acesso ao Portal ativo
											</span>
										) : (
											<span className="rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
												Sem senha definida
											</span>
										)}
										{contato.ativo === 0 && (
											<span className="rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
												Inativo
											</span>
										)}
									</div>
									<p className="text-sm text-voia-neutral-700">{contato.email}</p>
									{contato.telefone && <p className="text-xs text-voia-neutral-500">{contato.telefone}</p>}
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-3">
									<button
										type="button"
										onClick={() => setGerenciandoProcessos(contato)}
										className="text-xs font-medium text-voia-green-800 hover:underline"
									>
										Processos autorizados
									</button>
									<button
										type="button"
										onClick={() => setDefinindoSenha(contato)}
										className="text-xs font-medium text-voia-green-800 hover:underline"
									>
										{contato.possui_acesso === 1 ? "Redefinir senha" : "Definir senha"}
									</button>
									<button
										type="button"
										onClick={() => setEditando(contato)}
										className="text-xs font-medium text-voia-green-800 hover:underline"
									>
										Editar
									</button>
									<button
										type="button"
										onClick={() => remover(contato)}
										disabled={removendoId === contato.id}
										className="text-xs font-medium text-voia-danger hover:underline disabled:opacity-(--opacity-disabled)"
									>
										Remover
									</button>
								</div>
							</div>
						</li>
					))}
				</ul>
			)}

			{criando && <ContatoModal clienteId={clienteId} contato={null} onClose={() => setCriando(false)} onSaved={handleSaved} />}
			{editando && (
				<ContatoModal clienteId={clienteId} contato={editando} onClose={() => setEditando(null)} onSaved={handleSaved} />
			)}
			{gerenciandoProcessos && (
				<ContatoProcessosModal
					clienteId={clienteId}
					contato={gerenciandoProcessos}
					onClose={() => setGerenciandoProcessos(null)}
					onSaved={() => setGerenciandoProcessos(null)}
				/>
			)}
			{definindoSenha && (
				<DefinirSenhaContatoModal
					clienteId={clienteId}
					contato={definindoSenha}
					onClose={() => setDefinindoSenha(null)}
					onSaved={carregar}
				/>
			)}
		</div>
	);
}

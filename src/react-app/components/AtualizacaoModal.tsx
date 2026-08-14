import { useEffect, useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import { TIPO_ATUALIZACAO, TIPO_ATUALIZACAO_LABEL } from "../lib/projeto-tipos";

interface EtapaOpcao {
	id: number;
	nome: string;
}

export default function AtualizacaoModal({
	projetoId,
	onClose,
	onSaved,
}: {
	projetoId: number;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [titulo, setTitulo] = useState("");
	const [descricao, setDescricao] = useState("");
	const [tipo, setTipo] = useState("geral");
	const [etapaId, setEtapaId] = useState("");
	const [visivelCliente, setVisivelCliente] = useState(false);
	const [etapas, setEtapas] = useState<EtapaOpcao[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetch(`/api/projetos/${projetoId}/etapas`, { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ etapas: EtapaOpcao[] }>) : null))
			.then((data) => data && setEtapas(data.etapas))
			.catch(() => {});
	}, [projetoId]);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (titulo.trim().length === 0) {
			setError("O título é obrigatório.");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/atualizacoes`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({
					titulo,
					descricao: descricao || null,
					tipo,
					etapa_id: etapaId ? Number(etapaId) : null,
					visivel_cliente: visivelCliente,
				}),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível publicar a atualização");
			}

			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível publicar a atualização");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title="Nova atualização"
			onClose={onClose}
			onSubmit={handleSubmit}
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
						disabled={submitting}
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
					>
						{submitting ? "Publicando…" : "Publicar"}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				<div>
					<label htmlFor="atualizacao-titulo" className="block text-sm font-medium text-voia-neutral-900">
						Título
					</label>
					<input
						id="atualizacao-titulo"
						type="text"
						value={titulo}
						maxLength={200}
						onChange={(e) => setTitulo(e.target.value)}
						placeholder="Ex.: Projeto protocolado."
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="atualizacao-descricao" className="block text-sm font-medium text-voia-neutral-900">
						Descrição
					</label>
					<textarea
						id="atualizacao-descricao"
						value={descricao}
						onChange={(e) => setDescricao(e.target.value)}
						rows={3}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="atualizacao-tipo" className="block text-sm font-medium text-voia-neutral-900">
							Tipo
						</label>
						<select
							id="atualizacao-tipo"
							value={tipo}
							onChange={(e) => setTipo(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							{TIPO_ATUALIZACAO.map((t) => (
								<option key={t} value={t}>
									{TIPO_ATUALIZACAO_LABEL[t]}
								</option>
							))}
						</select>
					</div>
					<div>
						<label htmlFor="atualizacao-etapa" className="block text-sm font-medium text-voia-neutral-900">
							Etapa relacionada
						</label>
						<select
							id="atualizacao-etapa"
							value={etapaId}
							onChange={(e) => setEtapaId(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							<option value="">Nenhuma</option>
							{etapas.map((etapa) => (
								<option key={etapa.id} value={etapa.id}>
									{etapa.nome}
								</option>
							))}
						</select>
					</div>
				</div>
				<label className="flex items-center gap-2 text-sm font-medium text-voia-neutral-900">
					<input
						type="checkbox"
						checked={visivelCliente}
						onChange={(e) => setVisivelCliente(e.target.checked)}
						className="h-4 w-4 rounded border-voia-neutral-100 text-voia-gold-500 focus:ring-voia-gold-500"
					/>
					Publicar também no Portal do Cliente
				</label>
				<p className="text-xs text-voia-neutral-500">
					Desmarcado, a atualização fica visível somente para a equipe interna.
				</p>

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

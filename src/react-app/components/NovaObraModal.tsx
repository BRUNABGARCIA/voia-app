import { useEffect, useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";

interface ProjetoOpcao {
	id: number;
	nome: string;
}

export default function NovaObraModal({ onClose, onCreated }: { onClose: () => void; onCreated: (obraId: number) => void }) {
	const [projetos, setProjetos] = useState<ProjetoOpcao[]>([]);
	const [projetoId, setProjetoId] = useState("");
	const [nome, setNome] = useState("");
	const [endereco, setEndereco] = useState("");
	const [dataInicioPrevista, setDataInicioPrevista] = useState("");
	const [dataFimPrevista, setDataFimPrevista] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetch("/api/projetos", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ projetos: ProjetoOpcao[] }>) : null))
			.then((data) => data && setProjetos(data.projetos))
			.catch(() => {});
	}, []);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		if (!projetoId) {
			setError("Selecione o projeto.");
			return;
		}
		if (nome.trim().length === 0) {
			setError("O nome da obra é obrigatório.");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch("/api/obras", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({
					projeto_id: Number(projetoId),
					nome,
					endereco: endereco || null,
					data_inicio_prevista: dataInicioPrevista || null,
					data_fim_prevista: dataFimPrevista || null,
				}),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível criar a obra");
			}
			const { obra } = (await res.json()) as { obra: { id: number } };
			onCreated(obra.id);
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível criar a obra");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title="Nova obra"
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
						{submitting ? "Criando…" : "Criar obra"}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				<div>
					<label htmlFor="nova-obra-projeto" className="block text-sm font-medium text-voia-neutral-900">
						Projeto
					</label>
					<select
						id="nova-obra-projeto"
						value={projetoId}
						onChange={(e) => setProjetoId(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					>
						<option value="">Selecione…</option>
						{projetos.map((p) => (
							<option key={p.id} value={p.id}>
								{p.nome}
							</option>
						))}
					</select>
				</div>
				<div>
					<label htmlFor="nova-obra-nome" className="block text-sm font-medium text-voia-neutral-900">
						Nome da obra
					</label>
					<input
						id="nova-obra-nome"
						type="text"
						value={nome}
						maxLength={200}
						onChange={(e) => setNome(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="nova-obra-endereco" className="block text-sm font-medium text-voia-neutral-900">
						Endereço/local
					</label>
					<input
						id="nova-obra-endereco"
						type="text"
						value={endereco}
						onChange={(e) => setEndereco(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="nova-obra-inicio" className="block text-sm font-medium text-voia-neutral-900">
							Início previsto
						</label>
						<input
							id="nova-obra-inicio"
							type="date"
							value={dataInicioPrevista}
							onChange={(e) => setDataInicioPrevista(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					<div>
						<label htmlFor="nova-obra-fim" className="block text-sm font-medium text-voia-neutral-900">
							Término previsto
						</label>
						<input
							id="nova-obra-fim"
							type="date"
							value={dataFimPrevista}
							onChange={(e) => setDataFimPrevista(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
				</div>

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

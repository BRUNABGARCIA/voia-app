import { useEffect, useState, type FormEvent } from "react";

interface FocoResposta {
	data: string;
	texto: string | null;
}

/**
 * "Meu foco de hoje" — sempre o foco do próprio usuário autenticado
 * (GET/PUT /api/foco nunca aceitam outro usuário). Editável inline, sem
 * modal: clique em "editar", escreve, salva.
 */
export default function MeuFocoHoje() {
	const [texto, setTexto] = useState<string | null>(null);
	const [carregando, setCarregando] = useState(true);
	const [editando, setEditando] = useState(false);
	const [rascunho, setRascunho] = useState("");
	const [salvando, setSalvando] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/foco", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<FocoResposta>) : null))
			.then((data) => {
				if (cancelled || !data) return;
				setTexto(data.texto);
				setRascunho(data.texto ?? "");
			})
			.finally(() => {
				if (!cancelled) setCarregando(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	async function salvar(e: FormEvent) {
		e.preventDefault();
		if (rascunho.trim().length === 0) {
			setError("Escreva o foco de hoje antes de salvar.");
			return;
		}
		setError(null);
		setSalvando(true);
		try {
			const res = await fetch("/api/foco", {
				method: "PUT",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ texto: rascunho.trim() }),
			});
			if (!res.ok) throw new Error();
			setTexto(rascunho.trim());
			setEditando(false);
		} catch {
			setError("Não foi possível salvar o foco de hoje.");
		} finally {
			setSalvando(false);
		}
	}

	if (carregando) return null;

	return (
		<div className="mt-6 rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
			<div className="flex items-center justify-between">
				<h2 className="font-display text-lg text-voia-green-900">Meu foco de hoje</h2>
				{!editando && (
					<button
						type="button"
						onClick={() => {
							setRascunho(texto ?? "");
							setEditando(true);
						}}
						className="text-sm font-medium text-voia-gold-500 hover:underline"
					>
						{texto ? "Editar" : "Definir"}
					</button>
				)}
			</div>

			{!editando && (
				<p className="mt-2 text-sm text-voia-neutral-900">
					{texto ?? <span className="text-voia-neutral-500">Você ainda não definiu o foco de hoje.</span>}
				</p>
			)}

			{editando && (
				<form onSubmit={salvar} className="mt-2 space-y-2">
					<textarea
						autoFocus
						value={rascunho}
						onChange={(e) => setRascunho(e.target.value)}
						maxLength={280}
						rows={2}
						placeholder="Ex.: Fechar o levantamento do projeto X até o fim do dia."
						className="w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
					{error && <p className="text-xs text-voia-danger">{error}</p>}
					<div className="flex gap-2">
						<button
							type="submit"
							disabled={salvando}
							className="rounded-control bg-voia-gold-500 px-3 py-1.5 text-xs font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
						>
							{salvando ? "Salvando…" : "Salvar"}
						</button>
						<button
							type="button"
							onClick={() => setEditando(false)}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-xs font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
						>
							Cancelar
						</button>
					</div>
				</form>
			)}
		</div>
	);
}

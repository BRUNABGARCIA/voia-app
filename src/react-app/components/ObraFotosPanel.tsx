import { useCallback, useEffect, useRef, useState } from "react";
import { formatarData } from "../lib/projeto-tipos";
import type { FotoObra } from "../lib/obra-tipos";

export default function ObraFotosPanel({ obraId, podeExcluir }: { obraId: number; podeExcluir: boolean }) {
	const [fotos, setFotos] = useState<FotoObra[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [enviando, setEnviando] = useState(false);
	const [legenda, setLegenda] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const carregar = useCallback(() => {
		fetch(`/api/obras/${obraId}/fotos`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<{ fotos: FotoObra[] }>;
			})
			.then((data) => setFotos(data.fotos))
			.catch(() => setError("Não foi possível carregar as fotos."));
	}, [obraId]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	async function enviar() {
		const arquivo = inputRef.current?.files?.[0];
		if (!arquivo) {
			setError("Selecione uma imagem (JPG ou PNG).");
			return;
		}
		setError(null);
		setEnviando(true);
		try {
			const form = new FormData();
			form.set("arquivo", arquivo);
			if (legenda) form.set("legenda", legenda);
			const res = await fetch(`/api/obras/${obraId}/fotos`, {
				method: "POST",
				credentials: "same-origin",
				body: form,
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível enviar a foto");
			}
			setLegenda("");
			if (inputRef.current) inputRef.current.value = "";
			carregar();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível enviar a foto");
		} finally {
			setEnviando(false);
		}
	}

	async function excluir(fotoId: number) {
		try {
			const res = await fetch(`/api/obras/${obraId}/fotos/${fotoId}`, { method: "DELETE", credentials: "same-origin" });
			if (!res.ok) throw new Error();
			carregar();
		} catch {
			setError("Não foi possível excluir a foto.");
		}
	}

	return (
		<div className="mt-6 space-y-4">
			<div className="rounded-card border border-voia-neutral-100 bg-voia-beige-50 p-(--space-card)">
				<h2 className="font-display text-lg text-voia-green-900">Fotos da obra</h2>
				<div className="mt-3 flex flex-wrap items-end gap-3">
					<input
						ref={inputRef}
						type="file"
						accept="image/jpeg,image/png"
						aria-label="Selecionar foto"
						className="text-sm text-voia-neutral-700"
					/>
					<input
						type="text"
						placeholder="Legenda (opcional)"
						value={legenda}
						onChange={(e) => setLegenda(e.target.value)}
						className="min-w-[180px] rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
					<button
						type="button"
						onClick={enviar}
						disabled={enviando}
						className="rounded-control bg-voia-gold-500 px-3 py-1.5 text-sm font-medium text-voia-green-950 hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
					>
						{enviando ? "Enviando…" : "Enviar foto"}
					</button>
				</div>
				{error && <p className="mt-2 text-sm text-voia-danger">{error}</p>}
			</div>

			{!fotos && <p className="text-sm text-voia-neutral-500">Carregando…</p>}
			{fotos && fotos.length === 0 && <p className="text-sm text-voia-neutral-500">Nenhuma foto enviada ainda.</p>}

			{fotos && fotos.length > 0 && (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{fotos.map((foto) => (
						<div key={foto.id} className="overflow-hidden rounded-card border border-voia-neutral-100 bg-(--color-surface) shadow-card">
							<a href={`/api/obras/${obraId}/fotos/${foto.id}/arquivo`} target="_blank" rel="noreferrer">
								<img
									src={`/api/obras/${obraId}/fotos/${foto.id}/arquivo`}
									alt={foto.legenda ?? "Foto da obra"}
									className="h-32 w-full object-cover"
								/>
							</a>
							<div className="p-2">
								<p className="truncate text-xs font-medium text-voia-neutral-900">{foto.legenda ?? "Sem legenda"}</p>
								<p className="text-xs text-voia-neutral-500">{formatarData(foto.data)}</p>
								{podeExcluir && (
									<button
										type="button"
										onClick={() => excluir(foto.id)}
										className="mt-1 text-xs font-medium text-voia-danger hover:underline"
									>
										Excluir
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

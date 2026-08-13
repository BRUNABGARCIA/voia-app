import { useRef, useState, type FormEvent } from "react";
import { useBranding } from "../contexts/useBranding";

const MAX_BYTES = 500 * 1024;

function PreviewImagem({ src, alt, className }: { src: string; alt: string; className: string }) {
	return <img src={src} alt={alt} className={className} />;
}

export default function Aparencia() {
	const branding = useBranding();

	const [nomeSistema, setNomeSistema] = useState(branding.nomeSistema);
	const [logoFile, setLogoFile] = useState<File | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);
	const [faviconFile, setFaviconFile] = useState<File | null>(null);
	const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sucesso, setSucesso] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const logoInputRef = useRef<HTMLInputElement>(null);
	const faviconInputRef = useRef<HTMLInputElement>(null);

	function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0] ?? null;
		setError(null);
		if (file && file.size > MAX_BYTES) {
			setError("A logo precisa ter no máximo 500 KB.");
			e.target.value = "";
			return;
		}
		setLogoFile(file);
		setLogoPreview(file ? URL.createObjectURL(file) : null);
	}

	function escolherFavicon(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0] ?? null;
		setError(null);
		if (file && file.size > MAX_BYTES) {
			setError("O ícone precisa ter no máximo 500 KB.");
			e.target.value = "";
			return;
		}
		setFaviconFile(file);
		setFaviconPreview(file ? URL.createObjectURL(file) : null);
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSucesso(null);
		setSubmitting(true);

		try {
			const formData = new FormData();
			formData.set("nome_sistema", nomeSistema);
			if (logoFile) formData.set("logo", logoFile);
			if (faviconFile) formData.set("favicon", faviconFile);

			const res = await fetch("/api/configuracoes", {
				method: "PATCH",
				credentials: "same-origin",
				body: formData,
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar as alterações");
			}

			await branding.refresh();
			setLogoFile(null);
			setLogoPreview(null);
			setFaviconFile(null);
			setFaviconPreview(null);
			if (logoInputRef.current) logoInputRef.current.value = "";
			if (faviconInputRef.current) faviconInputRef.current.value = "";
			setSucesso("Alterações salvas com sucesso.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar as alterações");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div>
			<h1 className="font-display text-2xl font-light text-voia-neutral-900">Aparência</h1>
			<p className="mt-1 text-sm text-voia-neutral-700">Personalize a identidade visual do VOIA.</p>

			<form onSubmit={handleSubmit} className="mt-6 max-w-lg rounded-card border border-voia-neutral-100 bg-white p-(--space-card) shadow-card">
				<h2 className="font-display text-lg text-voia-green-900">Identidade da marca</h2>

				<div className="mt-6">
					<span className="block text-sm font-medium text-voia-neutral-900">Logo do sistema</span>
					<div className="mt-2 flex items-center gap-4">
						<div className="flex h-16 w-40 items-center justify-center rounded-control bg-voia-black p-2">
							<PreviewImagem
								src={logoPreview ?? branding.logoUrl}
								alt="Logo atual"
								className="max-h-full max-w-full object-contain"
							/>
						</div>
						<button
							type="button"
							onClick={() => logoInputRef.current?.click()}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
						>
							Alterar logo
						</button>
						<input
							ref={logoInputRef}
							type="file"
							accept="image/png,image/jpeg,image/webp"
							onChange={escolherLogo}
							className="hidden"
						/>
					</div>
				</div>

				<div className="mt-6">
					<span className="block text-sm font-medium text-voia-neutral-900">Ícone do sistema</span>
					<div className="mt-2 flex items-center gap-4">
						<div className="flex h-16 w-16 items-center justify-center rounded-control border border-voia-neutral-100 bg-voia-beige-50 p-2">
							<PreviewImagem
								src={faviconPreview ?? branding.faviconUrl}
								alt="Ícone atual"
								className="max-h-full max-w-full object-contain"
							/>
						</div>
						<button
							type="button"
							onClick={() => faviconInputRef.current?.click()}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
						>
							Alterar ícone
						</button>
						<input
							ref={faviconInputRef}
							type="file"
							accept="image/png,image/jpeg,image/webp"
							onChange={escolherFavicon}
							className="hidden"
						/>
					</div>
				</div>

				<div className="mt-6">
					<label htmlFor="nome-sistema" className="block text-sm font-medium text-voia-neutral-900">
						Nome do sistema
					</label>
					<input
						id="nome-sistema"
						type="text"
						required
						value={nomeSistema}
						onChange={(e) => setNomeSistema(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>

				{error && <p className="mt-4 text-sm text-voia-danger">{error}</p>}
				{sucesso && (
					<p className="mt-4 rounded-control bg-voia-success/15 px-3 py-2 text-sm text-voia-success">{sucesso}</p>
				)}

				<div className="mt-6">
					<button
						type="submit"
						disabled={submitting}
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
					>
						{submitting ? "Salvando…" : "Salvar alterações"}
					</button>
				</div>
			</form>
		</div>
	);
}

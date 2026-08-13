import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBranding } from "../contexts/useBranding";
import ImageEditorModal from "../components/ImageEditorModal";
import { LOGO_ESCALA_MAX, LOGO_ESCALA_MIN, logoDimensoes } from "../lib/logo-escala";

const MAX_BYTES = 500 * 1024;

function PreviewImagem({ src, alt, className, style }: { src: string; alt: string; className: string; style?: React.CSSProperties }) {
	return <img src={src} alt={alt} className={className} style={style} />;
}

export default function Aparencia() {
	const branding = useBranding();

	const [nomeSistema, setNomeSistema] = useState(branding.nomeSistema);
	const [logoEscala, setLogoEscala] = useState(branding.logoEscala);

	// branding carrega de forma assíncrona (BrandingProvider); se esta página montar
	// antes do fetch inicial resolver, o useState acima captura os valores padrão.
	// Sincroniza uma vez, assim que os dados reais chegam.
	useEffect(() => {
		if (!branding.loading) {
			setNomeSistema(branding.nomeSistema);
			setLogoEscala(branding.logoEscala);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [branding.loading]);

	const [logoOriginal, setLogoOriginal] = useState<File | null>(null);
	const [logoProcessado, setLogoProcessado] = useState<File | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);

	const [faviconOriginal, setFaviconOriginal] = useState<File | null>(null);
	const [faviconProcessado, setFaviconProcessado] = useState<File | null>(null);
	const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

	const [editor, setEditor] = useState<{ aspectMode: "logo" | "favicon"; file: File } | null>(null);

	const [error, setError] = useState<string | null>(null);
	const [sucesso, setSucesso] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const logoInputRef = useRef<HTMLInputElement>(null);
	const faviconInputRef = useRef<HTMLInputElement>(null);

	function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0] ?? null;
		e.target.value = "";
		if (!file) return;
		setError(null);
		if (file.size > MAX_BYTES) {
			setError("A logo precisa ter no máximo 500 KB.");
			return;
		}
		setLogoOriginal(file);
		setEditor({ aspectMode: "logo", file });
	}

	function escolherFavicon(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0] ?? null;
		e.target.value = "";
		if (!file) return;
		setError(null);
		if (file.size > MAX_BYTES) {
			setError("O ícone precisa ter no máximo 500 KB.");
			return;
		}
		setFaviconOriginal(file);
		setEditor({ aspectMode: "favicon", file });
	}

	function onEditorConfirm(processado: File) {
		if (!editor) return;
		const url = URL.createObjectURL(processado);
		if (editor.aspectMode === "logo") {
			setLogoProcessado(processado);
			setLogoPreview(url);
		} else {
			setFaviconProcessado(processado);
			setFaviconPreview(url);
		}
		setEditor(null);
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSucesso(null);
		setSubmitting(true);

		try {
			const formData = new FormData();
			formData.set("nome_sistema", nomeSistema);
			formData.set("logo_escala", String(logoEscala));
			if (logoProcessado) formData.set("logo", logoProcessado);
			if (faviconProcessado) formData.set("favicon", faviconProcessado);

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
			setLogoOriginal(null);
			setLogoProcessado(null);
			setLogoPreview(null);
			setFaviconOriginal(null);
			setFaviconProcessado(null);
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

	const logoPreviewDim = logoDimensoes(logoEscala);

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
						<div className="flex flex-col gap-2">
							<button
								type="button"
								onClick={() => logoInputRef.current?.click()}
								className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
							>
								Alterar logo
							</button>
							{logoOriginal && (
								<button
									type="button"
									onClick={() => setEditor({ aspectMode: "logo", file: logoOriginal })}
									className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
								>
									Reeditar recorte
								</button>
							)}
						</div>
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
					<div className="flex items-center justify-between">
						<label htmlFor="logo-escala" className="text-sm font-medium text-voia-neutral-900">
							Tamanho da logo na sidebar
						</label>
						<span className="text-sm text-voia-neutral-700">{logoEscala}%</span>
					</div>
					<input
						id="logo-escala"
						type="range"
						min={LOGO_ESCALA_MIN}
						max={LOGO_ESCALA_MAX}
						step={5}
						value={logoEscala}
						onChange={(e) => setLogoEscala(Number(e.target.value))}
						className="mt-2 w-full"
					/>
					<div className="mt-2 flex h-16 w-40 items-center justify-center rounded-control bg-voia-black p-2">
						<PreviewImagem
							src={logoPreview ?? branding.logoUrl}
							alt="Prévia do tamanho na sidebar"
							className="object-contain"
							style={{ width: `${logoPreviewDim.width}px`, height: `${logoPreviewDim.height}px` }}
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
						<div className="flex flex-col gap-2">
							<button
								type="button"
								onClick={() => faviconInputRef.current?.click()}
								className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
							>
								Alterar ícone
							</button>
							{faviconOriginal && (
								<button
									type="button"
									onClick={() => setEditor({ aspectMode: "favicon", file: faviconOriginal })}
									className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
								>
									Reeditar recorte
								</button>
							)}
						</div>
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

			{editor && (
				<ImageEditorModal
					file={editor.file}
					aspectMode={editor.aspectMode}
					onCancel={() => setEditor(null)}
					onConfirm={onEditorConfirm}
				/>
			)}
		</div>
	);
}

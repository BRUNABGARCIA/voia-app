import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBranding } from "../contexts/useBranding";
import ImageEditorModal from "../components/ImageEditorModal";
import { LOGO_ESCALA_MAX, LOGO_ESCALA_MIN, logoDimensoes } from "../lib/logo-escala";
import {
	aplicarTema,
	CAMPOS_COR,
	CORES_PADRAO,
	hexValido,
	validarContraste,
	type CoresTema,
} from "../lib/tema";

const MAX_BYTES = 500 * 1024;

function PreviewImagem({ src, alt, className, style }: { src: string; alt: string; className: string; style?: React.CSSProperties }) {
	return <img src={src} alt={alt} className={className} style={style} />;
}

function CampoCor({ label, valor, onChange }: { label: string; valor: string; onChange: (hex: string) => void }) {
	const valido = hexValido(valor);
	return (
		<div>
			<label className="block text-sm font-medium text-voia-neutral-900">{label}</label>
			<div className="mt-1 flex items-center gap-2">
				<input
					type="color"
					value={valido ? valor : "#000000"}
					onChange={(e) => onChange(e.target.value.toUpperCase())}
					className="h-9 w-9 shrink-0 cursor-pointer rounded-control border border-voia-neutral-100 p-0.5"
					aria-label={`Seletor de cor: ${label}`}
				/>
				<input
					type="text"
					value={valor}
					onChange={(e) => onChange(e.target.value)}
					maxLength={7}
					className={`w-28 rounded-control border px-2 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500 ${
						valido ? "border-voia-neutral-100" : "border-voia-danger"
					}`}
				/>
			</div>
			{!valido && <p className="mt-1 text-xs text-voia-danger">Use o formato #rrggbb.</p>}
		</div>
	);
}

function PreviewTema({ cores, nomeSistema }: { cores: CoresTema; nomeSistema: string }) {
	return (
		<div
			className="mt-3 overflow-hidden rounded-control border border-voia-neutral-100"
			style={{ background: hexValido(cores.corFundo) ? cores.corFundo : "#f7f7f5" }}
		>
			<div className="flex" style={{ minHeight: "200px" }}>
				<div
					className="flex w-28 shrink-0 flex-col gap-2 p-3"
					style={{ background: hexValido(cores.corSidebar) ? cores.corSidebar : "#000000" }}
				>
					<div className="h-4 w-14 rounded-sm bg-white/30" />
					<div
						className="mt-3 rounded-control px-2 py-1 text-xs font-medium"
						style={{
							background: hexValido(cores.corDestaque) ? cores.corDestaque : "#f7c94a",
							color: "#071f17",
						}}
					>
						Início
					</div>
					<div className="rounded-control px-2 py-1 text-xs text-white/80">Clientes</div>
					<div className="rounded-control px-2 py-1 text-xs text-white/80">Projetos</div>
				</div>
				<div className="flex-1 p-4">
					<div
						className="rounded-control p-3 shadow-card"
						style={{ background: hexValido(cores.corSuperficie) ? cores.corSuperficie : "#ffffff" }}
					>
						<div
							className="font-display text-sm font-medium"
							style={{ color: hexValido(cores.corPrincipal) ? cores.corPrincipal : "#124435" }}
						>
							{nomeSistema || "VOIA Engenharia"}
						</div>
						<div
							className="mt-1 text-xs"
							style={{ color: hexValido(cores.corTextoPrincipal) ? cores.corTextoPrincipal : "#1b1f1c" }}
						>
							Texto principal de exemplo.
						</div>
						<div
							className="mt-1 text-xs"
							style={{ color: hexValido(cores.corTextoSecundario) ? cores.corTextoSecundario : "#3d443f" }}
						>
							Texto secundário de exemplo.
						</div>
						<button
							type="button"
							disabled
							className="mt-3 rounded-control px-3 py-1.5 text-xs font-medium"
							style={{
								background: hexValido(cores.corDestaque) ? cores.corDestaque : "#f7c94a",
								color: "#071f17",
							}}
						>
							Botão principal
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function Aparencia() {
	const branding = useBranding();

	const [nomeSistema, setNomeSistema] = useState(branding.nomeSistema);
	const [logoEscala, setLogoEscala] = useState(branding.logoEscala);
	const [cores, setCores] = useState<CoresTema>(() => ({
		corPrincipal: branding.corPrincipal,
		corDestaque: branding.corDestaque,
		corFundo: branding.corFundo,
		corSuperficie: branding.corSuperficie,
		corSidebar: branding.corSidebar,
		corTextoPrincipal: branding.corTextoPrincipal,
		corTextoSecundario: branding.corTextoSecundario,
	}));
	const [confirmarContraste, setConfirmarContraste] = useState(false);

	// branding carrega de forma assíncrona (BrandingProvider); se esta página montar
	// antes do fetch inicial resolver, o useState acima captura os valores padrão.
	// Sincroniza uma vez, assim que os dados reais chegam.
	useEffect(() => {
		if (!branding.loading) {
			setNomeSistema(branding.nomeSistema);
			setLogoEscala(branding.logoEscala);
			setCores({
				corPrincipal: branding.corPrincipal,
				corDestaque: branding.corDestaque,
				corFundo: branding.corFundo,
				corSuperficie: branding.corSuperficie,
				corSidebar: branding.corSidebar,
				corTextoPrincipal: branding.corTextoPrincipal,
				corTextoSecundario: branding.corTextoSecundario,
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [branding.loading]);

	// Pré-visualização ao vivo: aplica o rascunho de cores no app inteiro
	// enquanto o admin edita, sem persistir nada ainda.
	useEffect(() => {
		aplicarTema(cores);
	}, [cores]);

	// Ao sair da tela sem salvar (navegar para outra página), restaura o
	// tema realmente salvo — a pré-visualização nunca deve "vazar" para o
	// resto do app depois que o admin sai daqui. Usa um ref para sempre
	// pegar o branding mais recente (inclusive se um Salvar aconteceu).
	const brandingRef = useRef(branding);
	useEffect(() => {
		brandingRef.current = branding;
	}, [branding]);
	useEffect(() => {
		return () => {
			aplicarTema(brandingRef.current);
		};
	}, []);

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

	function setCor<K extends keyof CoresTema>(campo: K) {
		return (valor: string) => {
			setConfirmarContraste(false);
			setCores((atual) => ({ ...atual, [campo]: valor }));
		};
	}

	function restaurarPadrao() {
		setConfirmarContraste(false);
		setCores(CORES_PADRAO);
	}

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

	const todasCoresValidas = CAMPOS_COR.every((c) => hexValido(cores[c.chave]));
	const avisosContraste = todasCoresValidas ? validarContraste(cores) : [];
	const podeSalvar = todasCoresValidas && (avisosContraste.length === 0 || confirmarContraste);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSucesso(null);

		if (!todasCoresValidas) {
			setError("Corrija as cores em formato inválido antes de salvar.");
			return;
		}
		if (avisosContraste.length > 0 && !confirmarContraste) {
			setError("Existem combinações de cores com contraste baixo. Confirme que deseja salvar mesmo assim.");
			return;
		}

		setSubmitting(true);

		try {
			const formData = new FormData();
			formData.set("nome_sistema", nomeSistema);
			formData.set("logo_escala", String(logoEscala));
			formData.set("cor_principal", cores.corPrincipal);
			formData.set("cor_destaque", cores.corDestaque);
			formData.set("cor_fundo", cores.corFundo);
			formData.set("cor_superficie", cores.corSuperficie);
			formData.set("cor_sidebar", cores.corSidebar);
			formData.set("cor_texto_principal", cores.corTextoPrincipal);
			formData.set("cor_texto_secundario", cores.corTextoSecundario);
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
			setConfirmarContraste(false);
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

			<form onSubmit={handleSubmit} className="mt-6 max-w-2xl rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
				<h2 className="font-display text-lg text-voia-green-900">Identidade da marca</h2>

				<div className="mt-6">
					<span className="block text-sm font-medium text-voia-neutral-900">Logo do sistema</span>
					<div className="mt-2 flex items-center gap-4">
						<div className="flex h-16 w-40 items-center justify-center rounded-control bg-(--color-sidebar-bg) p-2">
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
					<div className="mt-2 flex h-16 w-40 items-center justify-center rounded-control bg-(--color-sidebar-bg) p-2">
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

				<div className="mt-8 border-t border-voia-neutral-100 pt-6">
					<div className="flex items-center justify-between">
						<h2 className="font-display text-lg text-voia-green-900">Cores do sistema</h2>
						<button
							type="button"
							onClick={restaurarPadrao}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
						>
							Restaurar cores padrão
						</button>
					</div>
					<p className="mt-1 text-sm text-voia-neutral-700">
						As alterações aparecem no sistema imediatamente, mas só ficam permanentes ao clicar em "Salvar
						alterações".
					</p>

					<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
						{CAMPOS_COR.map(({ chave, label }) => (
							<CampoCor key={chave} label={label} valor={cores[chave]} onChange={setCor(chave)} />
						))}
					</div>

					{avisosContraste.length > 0 && (
						<div className="mt-4 rounded-control border border-voia-warning/40 bg-voia-warning/10 p-3">
							<p className="text-sm font-medium text-voia-warning">Contraste baixo detectado</p>
							<ul className="mt-1 list-inside list-disc text-sm text-voia-neutral-700">
								{avisosContraste.map((aviso) => (
									<li key={aviso.par}>
										{aviso.par}: razão de contraste {aviso.razao}:1 (recomendado pelo menos 3:1)
									</li>
								))}
							</ul>
							<label className="mt-2 flex items-center gap-2 text-sm text-voia-neutral-900">
								<input
									type="checkbox"
									checked={confirmarContraste}
									onChange={(e) => setConfirmarContraste(e.target.checked)}
								/>
								Estou ciente e quero salvar mesmo assim
							</label>
						</div>
					)}

					<div>
						<span className="mt-6 block text-sm font-medium text-voia-neutral-900">Pré-visualização</span>
						<PreviewTema cores={cores} nomeSistema={nomeSistema} />
					</div>
				</div>

				{error && <p className="mt-4 text-sm text-voia-danger">{error}</p>}
				{sucesso && (
					<p className="mt-4 rounded-control bg-voia-success/15 px-3 py-2 text-sm text-voia-success">{sucesso}</p>
				)}

				<div className="mt-6">
					<button
						type="submit"
						disabled={submitting || !podeSalvar}
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

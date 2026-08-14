import { useEffect, useRef, useState } from "react";

const MAX_BYTES = 500 * 1024;

type FitMode = "conter" | "preencher";

interface Props {
	file: File;
	aspectMode: "logo" | "favicon";
	onCancel: () => void;
	onConfirm: (file: File) => void;
}

// Dimensões de saída do recorte — também a resolução final do arquivo gerado.
const SAIDA = {
	logo: { width: 400, height: 128 },
	favicon: { width: 240, height: 240 },
};

function mimeDeSaida(original: File): string {
	return original.type === "image/jpeg" ? "image/jpeg" : "image/png";
}

export default function ImageEditorModal({ file, aspectMode, onCancel, onConfirm }: Props) {
	const { width: outW, height: outH } = SAIDA[aspectMode];

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const previewSidebarRef = useRef<HTMLCanvasElement>(null);
	const previewFaviconRef = useRef<HTMLCanvasElement>(null);
	const imgRef = useRef<HTMLImageElement | null>(null);

	const [carregado, setCarregado] = useState(false);
	const [erro, setErro] = useState<string | null>(null);
	const [fitMode, setFitMode] = useState<FitMode>("conter");
	const [zoom, setZoom] = useState(1);
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const arrastoRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

	useEffect(() => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			imgRef.current = img;
			setCarregado(true);
		};
		img.onerror = () => setErro("não foi possível carregar a imagem selecionada");
		img.src = url;
		return () => URL.revokeObjectURL(url);
	}, [file]);

	function baseScale(mode: FitMode, naturalW: number, naturalH: number): number {
		return mode === "conter"
			? Math.min(outW / naturalW, outH / naturalH)
			: Math.max(outW / naturalW, outH / naturalH);
	}

	function desenhar() {
		const canvas = canvasRef.current;
		const img = imgRef.current;
		if (!canvas || !img) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const escala = baseScale(fitMode, img.naturalWidth, img.naturalHeight) * zoom;
		const drawnW = img.naturalWidth * escala;
		const drawnH = img.naturalHeight * escala;
		const x = outW / 2 + offset.x - drawnW / 2;
		const y = outH / 2 + offset.y - drawnH / 2;

		ctx.clearRect(0, 0, outW, outH);
		ctx.drawImage(img, x, y, drawnW, drawnH);

		for (const [ref, w, h, bg] of [
			[previewSidebarRef, 150, 48, "#000000"],
			[previewFaviconRef, 28, 28, null],
		] as const) {
			const pv = ref.current;
			if (!pv) continue;
			const pctx = pv.getContext("2d");
			if (!pctx) continue;
			pctx.clearRect(0, 0, w, h);
			if (bg) {
				pctx.fillStyle = bg;
				pctx.fillRect(0, 0, w, h);
			}
			// mesma lógica de "conter" usada na sidebar real (object-contain)
			const pScale = Math.min(w / outW, h / outH);
			const pw = outW * pScale;
			const ph = outH * pScale;
			pctx.drawImage(canvas, (w - pw) / 2, (h - ph) / 2, pw, ph);
		}
	}

	useEffect(() => {
		if (carregado) desenhar();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [carregado, fitMode, zoom, offset]);

	function resetar() {
		setFitMode("conter");
		setZoom(1);
		setOffset({ x: 0, y: 0 });
	}

	function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
		e.currentTarget.setPointerCapture(e.pointerId);
		arrastoRef.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
	}

	function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
		const inicio = arrastoRef.current;
		if (!inicio) return;
		setOffset({
			x: inicio.offsetX + (e.clientX - inicio.x),
			y: inicio.offsetY + (e.clientY - inicio.y),
		});
	}

	function onPointerUp() {
		arrastoRef.current = null;
	}

	function confirmar() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		setErro(null);
		const mime = mimeDeSaida(file);
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					setErro("não foi possível gerar a imagem processada");
					return;
				}
				if (blob.size > MAX_BYTES) {
					setErro("a imagem ajustada ficou maior que 500 KB — tente reduzir o zoom");
					return;
				}
				const nome = aspectMode === "logo" ? "logo-editado" : "icone-editado";
				const extensao = mime === "image/jpeg" ? "jpg" : "png";
				onConfirm(new File([blob], `${nome}.${extensao}`, { type: mime }));
			},
			mime,
			mime === "image/jpeg" ? 0.92 : undefined,
		);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
			<div className="w-full max-w-lg rounded-card bg-(--color-surface) p-(--space-card) shadow-card">
				<h2 className="font-display text-lg text-voia-green-900">
					{aspectMode === "logo" ? "Ajustar logo" : "Ajustar ícone"}
				</h2>
				<p className="mt-1 text-sm text-voia-neutral-700">
					Arraste para posicionar e use o zoom para ajustar. O arquivo original não é alterado.
				</p>

				<div className="mt-4 flex justify-center rounded-control bg-voia-beige-50 p-4">
					<canvas
						ref={canvasRef}
						width={outW}
						height={outH}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
						onPointerLeave={onPointerUp}
						className="cursor-move touch-none rounded-control border border-voia-neutral-100 bg-voia-black"
						style={{ width: outW, height: outH }}
					/>
				</div>

				<div className="mt-4 flex items-center gap-3">
					<label htmlFor="zoom" className="text-sm font-medium text-voia-neutral-900">
						Zoom
					</label>
					<input
						id="zoom"
						type="range"
						min={1}
						max={3}
						step={0.05}
						value={zoom}
						onChange={(e) => setZoom(Number(e.target.value))}
						className="flex-1"
					/>
				</div>

				<div className="mt-3 flex items-center gap-2">
					<span className="text-sm font-medium text-voia-neutral-900">Ajuste:</span>
					<button
						type="button"
						onClick={() => setFitMode("conter")}
						className={`rounded-control px-3 py-1 text-sm font-medium ${
							fitMode === "conter"
								? "bg-voia-gold-500 text-voia-green-950"
								: "border border-voia-neutral-100 text-voia-neutral-700 hover:bg-voia-beige-100"
						}`}
					>
						Conter
					</button>
					<button
						type="button"
						onClick={() => setFitMode("preencher")}
						className={`rounded-control px-3 py-1 text-sm font-medium ${
							fitMode === "preencher"
								? "bg-voia-gold-500 text-voia-green-950"
								: "border border-voia-neutral-100 text-voia-neutral-700 hover:bg-voia-beige-100"
						}`}
					>
						Preencher
					</button>
					<button
						type="button"
						onClick={resetar}
						className="ml-auto rounded-control border border-voia-neutral-100 px-3 py-1 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						Restaurar
					</button>
				</div>

				<div className="mt-4 flex items-center gap-6">
					{aspectMode === "logo" ? (
						<div>
							<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
								Prévia na sidebar
							</span>
							<canvas ref={previewSidebarRef} width={150} height={48} className="mt-1 rounded-control" />
						</div>
					) : (
						<div>
							<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
								Prévia do ícone
							</span>
							<canvas
								ref={previewFaviconRef}
								width={28}
								height={28}
								className="mt-1 rounded border border-voia-neutral-100"
							/>
						</div>
					)}
				</div>

				{erro && <p className="mt-4 text-sm text-voia-danger">{erro}</p>}

				<div className="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onClick={onCancel}
						className="rounded-control border border-voia-neutral-100 px-4 py-2 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={confirmar}
						disabled={!carregado}
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
					>
						Usar esta imagem
					</button>
				</div>
			</div>
		</div>
	);
}

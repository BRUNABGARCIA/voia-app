import { useEffect, type FormEvent, type ReactNode } from "react";

/**
 * Casco comum para modais de formulário longos: cabeçalho e rodapé fixos,
 * com scroll só no conteúdo do meio, sem nunca ultrapassar a altura da
 * viewport. Trava o scroll da página por trás enquanto está aberto.
 */
export default function ModalShell({
	title,
	onClose,
	onSubmit,
	footer,
	children,
	maxWidthClassName = "max-w-2xl",
}: {
	title: string;
	onClose: () => void;
	onSubmit: (e: FormEvent) => void;
	footer: ReactNode;
	children: ReactNode;
	maxWidthClassName?: string;
}) {
	useEffect(() => {
		const original = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = original;
		};
	}, []);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
			<form
				onSubmit={onSubmit}
				noValidate
				className={`flex max-h-[90vh] w-full ${maxWidthClassName} flex-col overflow-hidden rounded-card bg-(--color-surface) shadow-elevated`}
			>
				<div className="shrink-0 border-b border-voia-neutral-100 px-(--space-card) py-4">
					<h2 className="font-display text-xl text-voia-green-900">{title}</h2>
				</div>

				<div className="flex-1 overflow-y-auto px-(--space-card) py-4">{children}</div>

				<div className="flex shrink-0 justify-end gap-3 border-t border-voia-neutral-100 px-(--space-card) py-4">
					{footer}
				</div>
			</form>
		</div>
	);
}

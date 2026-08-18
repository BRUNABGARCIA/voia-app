import { useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";

/**
 * Confirmação de ação destrutiva reutilizável — mesmo casco visual dos
 * demais modais do app (ModalShell), no lugar de window.confirm(). Mostra
 * a mensagem específica do que será removido, desabilita os botões durante
 * a chamada (evita duplo clique) e só fecha sozinho se onConfirm() resolver
 * sem lançar erro; se falhar, mostra o erro inline e permanece aberto.
 */
export default function ConfirmModal({
	title,
	message,
	confirmLabel = "Remover",
	cancelLabel = "Cancelar",
	onConfirm,
	onClose,
}: {
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => Promise<void>;
	onClose: () => void;
}) {
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (submitting) return;
		setError(null);
		setSubmitting(true);
		try {
			await onConfirm();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível concluir a ação");
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title={title}
			onClose={onClose}
			onSubmit={handleSubmit}
			maxWidthClassName="max-w-md"
			footer={
				<>
					<button
						type="button"
						onClick={onClose}
						disabled={submitting}
						className="rounded-control border border-voia-neutral-100 px-4 py-2 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100 disabled:opacity-(--opacity-disabled)"
					>
						{cancelLabel}
					</button>
					<button
						type="submit"
						disabled={submitting}
						className="rounded-control bg-voia-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-voia-danger/90 disabled:opacity-(--opacity-disabled)"
					>
						{submitting ? "Removendo…" : confirmLabel}
					</button>
				</>
			}
		>
			<p className="text-sm text-voia-neutral-700">{message}</p>
			{error && <p className="mt-3 text-sm text-voia-danger">{error}</p>}
		</ModalShell>
	);
}

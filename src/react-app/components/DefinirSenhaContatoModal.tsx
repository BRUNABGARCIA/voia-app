import { useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import type { ContatoCliente } from "../lib/cliente-tipos";

/**
 * Fluxo administrativo dedicado de "Definir senha / Redefinir senha" do
 * Portal do Cliente — reaproveita o mesmo endpoint PATCH de contato já
 * usado pelo ContatoModal (mesmo hash, mesma autorização administrador/
 * gestor no backend), só isola a ação numa tela focada em vez de misturar
 * com edição de nome/e-mail/telefone. A senha em si nunca volta do
 * backend nem é reexibida — só a confirmação de que foi salva.
 */
export default function DefinirSenhaContatoModal({
	clienteId,
	contato,
	onClose,
	onSaved,
}: {
	clienteId: number;
	contato: ContatoCliente;
	onClose: () => void;
	onSaved: () => void;
}) {
	const redefinindo = contato.possui_acesso === 1;
	const [senha, setSenha] = useState("");
	const [confirmacao, setConfirmacao] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [sucesso, setSucesso] = useState(false);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (senha.length < 8) {
			setError("A senha precisa ter pelo menos 8 caracteres.");
			return;
		}
		if (senha !== confirmacao) {
			setError("As senhas não conferem.");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch(`/api/clientes/${clienteId}/contatos/${contato.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ senha }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar a senha");
			}
			onSaved(); // só atualiza a lista em segundo plano — a tela de sucesso abaixo fica visível até o usuário fechar.
			setSucesso(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar a senha");
		} finally {
			setSubmitting(false);
		}
	}

	if (sucesso) {
		return (
			<ModalShell
				title={redefinindo ? "Senha redefinida" : "Senha definida"}
				onClose={onClose}
				onSubmit={(e) => {
					e.preventDefault();
					onClose();
				}}
				maxWidthClassName="max-w-md"
				footer={
					<button
						type="submit"
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400"
					>
						Fechar
					</button>
				}
			>
				<p className="text-sm text-voia-neutral-700">
					A senha de <strong>{contato.nome}</strong> foi {redefinindo ? "redefinida" : "definida"} com sucesso.
				</p>
				<p className="mt-3 rounded-control bg-voia-beige-100 px-3 py-2 text-xs text-voia-neutral-700">
					A VOIA deve repassar a nova senha a este contato manualmente — ela não é enviada automaticamente pelo
					sistema.
				</p>
			</ModalShell>
		);
	}

	return (
		<ModalShell
			title={redefinindo ? "Redefinir senha" : "Definir senha"}
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
						Cancelar
					</button>
					<button
						type="submit"
						disabled={submitting}
						className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400 disabled:opacity-(--opacity-disabled)"
					>
						{submitting ? "Salvando…" : redefinindo ? "Redefinir senha" : "Definir senha"}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				<p className="text-sm text-voia-neutral-700">
					{redefinindo ? (
						<>
							Defina uma nova senha de acesso ao Portal para <strong>{contato.nome}</strong>. A senha atual deixa de
							funcionar imediatamente.
						</>
					) : (
						<>
							Defina a senha inicial de acesso ao Portal para <strong>{contato.nome}</strong>.
						</>
					)}
				</p>
				<div>
					<label htmlFor="definir-senha-nova" className="block text-sm font-medium text-voia-neutral-900">
						Nova senha
					</label>
					<input
						id="definir-senha-nova"
						type="password"
						value={senha}
						onChange={(e) => setSenha(e.target.value)}
						placeholder="Mínimo 8 caracteres"
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="definir-senha-confirmacao" className="block text-sm font-medium text-voia-neutral-900">
						Confirmar senha
					</label>
					<input
						id="definir-senha-confirmacao"
						type="password"
						value={confirmacao}
						onChange={(e) => setConfirmacao(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<p className="rounded-control bg-voia-beige-100 px-3 py-2 text-xs text-voia-neutral-700">
					A VOIA repassa esta senha ao contato manualmente (telefone, e-mail etc.) — ela não é enviada
					automaticamente pelo sistema.
				</p>
				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

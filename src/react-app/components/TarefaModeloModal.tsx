import { useEffect, useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import type { TarefaModelo } from "../lib/tipos-servico-tipos";
import { PRIORIDADE_LABEL, PRIORIDADES } from "../lib/projeto-tipos";

interface UsuarioOpcao {
	id: number;
	nome: string;
}

interface FormState {
	nome: string;
	descricao: string;
	prazo_dias: string;
	prioridade_padrao: string;
	responsavel_padrao_id: string;
	visivel_cliente: boolean;
	exige_aprovacao: boolean;
	ativa: boolean;
}

function tarefaParaForm(tarefa: TarefaModelo | null): FormState {
	return {
		nome: tarefa?.nome ?? "",
		descricao: tarefa?.descricao ?? "",
		prazo_dias: tarefa?.prazo_dias != null ? String(tarefa.prazo_dias) : "",
		prioridade_padrao: tarefa?.prioridade_padrao ?? "normal",
		responsavel_padrao_id: tarefa?.responsavel_padrao_id ? String(tarefa.responsavel_padrao_id) : "",
		visivel_cliente: tarefa ? tarefa.visivel_cliente === 1 : true,
		exige_aprovacao: tarefa ? tarefa.exige_aprovacao === 1 : false,
		ativa: tarefa ? tarefa.ativa === 1 : true,
	};
}

export default function TarefaModeloModal({
	tipoServicoId,
	etapaModeloId,
	tarefa,
	onClose,
	onSaved,
}: {
	tipoServicoId: number;
	etapaModeloId: number;
	tarefa: TarefaModelo | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const editando = tarefa !== null;
	const [form, setForm] = useState<FormState>(() => tarefaParaForm(tarefa));
	const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetch("/api/usuarios/opcoes", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ usuarios: UsuarioOpcao[] }>) : null))
			.then((data) => data && setUsuarios(data.usuarios))
			.catch(() => {});
	}, []);

	function set<K extends keyof FormState>(campo: K) {
		return (valor: FormState[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (form.nome.trim().length === 0) {
			setError("O nome da tarefa é obrigatório.");
			return;
		}

		let prazoDias: number | null = null;
		if (form.prazo_dias.trim()) {
			const valor = Number(form.prazo_dias);
			if (!Number.isInteger(valor) || valor < 0) {
				setError("Prazo em dias inválido.");
				return;
			}
			prazoDias = valor;
		}

		setSubmitting(true);
		try {
			const payload = {
				nome: form.nome,
				descricao: form.descricao || null,
				prazo_dias: prazoDias,
				prioridade_padrao: form.prioridade_padrao,
				responsavel_padrao_id: form.responsavel_padrao_id ? Number(form.responsavel_padrao_id) : null,
				visivel_cliente: form.visivel_cliente,
				exige_aprovacao: form.exige_aprovacao,
				ativa: form.ativa,
			};

			const url = editando
				? `/api/tipos-servico/${tipoServicoId}/modelo/${etapaModeloId}/tarefas/${tarefa.id}`
				: `/api/tipos-servico/${tipoServicoId}/modelo/${etapaModeloId}/tarefas`;

			const res = await fetch(url, {
				method: editando ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar a tarefa do modelo");
			}

			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar a tarefa do modelo");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title={editando ? "Editar tarefa padrão" : "Nova tarefa padrão"}
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
						{submitting ? "Salvando…" : editando ? "Salvar alterações" : "Criar tarefa"}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				<div>
					<label htmlFor="tarefa-modelo-nome" className="block text-sm font-medium text-voia-neutral-900">
						Nome
					</label>
					<input
						id="tarefa-modelo-nome"
						type="text"
						value={form.nome}
						maxLength={200}
						onChange={(e) => set("nome")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="tarefa-modelo-descricao" className="block text-sm font-medium text-voia-neutral-900">
						Descrição
					</label>
					<textarea
						id="tarefa-modelo-descricao"
						value={form.descricao}
						onChange={(e) => set("descricao")(e.target.value)}
						rows={2}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="tarefa-modelo-prazo" className="block text-sm font-medium text-voia-neutral-900">
							Prazo (dias corridos)
						</label>
						<input
							id="tarefa-modelo-prazo"
							type="number"
							min={0}
							max={3650}
							value={form.prazo_dias}
							onChange={(e) => set("prazo_dias")(e.target.value)}
							placeholder="Sem prazo definido"
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					<div>
						<label htmlFor="tarefa-modelo-prioridade" className="block text-sm font-medium text-voia-neutral-900">
							Prioridade padrão
						</label>
						<select
							id="tarefa-modelo-prioridade"
							value={form.prioridade_padrao}
							onChange={(e) => set("prioridade_padrao")(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							{PRIORIDADES.map((p) => (
								<option key={p} value={p}>
									{PRIORIDADE_LABEL[p]}
								</option>
							))}
						</select>
					</div>
				</div>
				<div>
					<label htmlFor="tarefa-modelo-responsavel" className="block text-sm font-medium text-voia-neutral-900">
						Responsável padrão (opcional)
					</label>
					<select
						id="tarefa-modelo-responsavel"
						value={form.responsavel_padrao_id}
						onChange={(e) => set("responsavel_padrao_id")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					>
						<option value="">Nenhum</option>
						{usuarios.map((u) => (
							<option key={u.id} value={u.id}>
								{u.nome}
							</option>
						))}
					</select>
				</div>
				<label className="flex items-center gap-2 text-sm font-medium text-voia-neutral-900">
					<input
						type="checkbox"
						checked={form.visivel_cliente}
						onChange={(e) => set("visivel_cliente")(e.target.checked)}
						className="h-4 w-4 rounded border-voia-neutral-100 text-voia-gold-500 focus:ring-voia-gold-500"
					/>
					Visível ao cliente no Portal
				</label>
				<label className="flex items-center gap-2 text-sm font-medium text-voia-neutral-900">
					<input
						type="checkbox"
						checked={form.exige_aprovacao}
						onChange={(e) => set("exige_aprovacao")(e.target.checked)}
						className="h-4 w-4 rounded border-voia-neutral-100 text-voia-gold-500 focus:ring-voia-gold-500"
					/>
					Exige aprovação/validação
				</label>
				<p className="text-xs text-voia-neutral-500">
					Preparado para uma evolução futura — nenhum fluxo de aprovação é aplicado nesta versão.
				</p>
				<label className="flex items-center gap-2 text-sm font-medium text-voia-neutral-900">
					<input
						type="checkbox"
						checked={form.ativa}
						onChange={(e) => set("ativa")(e.target.checked)}
						className="h-4 w-4 rounded border-voia-neutral-100 text-voia-gold-500 focus:ring-voia-gold-500"
					/>
					Ativa
				</label>

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

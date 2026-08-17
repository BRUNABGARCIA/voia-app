import { useEffect, useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import {
	PRIORIDADE_LABEL,
	PRIORIDADES,
	STATUS_TAREFA,
	STATUS_TAREFA_LABEL,
	type Tarefa,
} from "../lib/projeto-tipos";

interface UsuarioOpcao {
	id: number;
	nome: string;
}

interface ProjetoResumo {
	projeto: { gerente_id: number | null };
	membros: { usuario_id: number }[];
}

interface FormState {
	nome: string;
	descricao: string;
	status: string;
	prioridade: string;
	responsavel_id: string;
	data_inicio: string;
	prazo: string;
	visivel_cliente: boolean;
}

function tarefaParaForm(tarefa: Tarefa | null): FormState {
	return {
		nome: tarefa?.nome ?? "",
		descricao: tarefa?.descricao ?? "",
		status: tarefa?.status ?? "pendente",
		prioridade: tarefa?.prioridade ?? "normal",
		responsavel_id: tarefa?.responsavel_id ? String(tarefa.responsavel_id) : "",
		data_inicio: tarefa?.data_inicio ?? "",
		prazo: tarefa?.prazo ?? "",
		visivel_cliente: tarefa ? tarefa.visivel_cliente === 1 : true,
	};
}

export default function TarefaModal({
	projetoId,
	etapaId,
	tarefa,
	onClose,
	onSaved,
}: {
	projetoId: number;
	etapaId: number;
	tarefa: Tarefa | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const editando = tarefa !== null;
	const [form, setForm] = useState<FormState>(() => tarefaParaForm(tarefa));
	const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
	const [idsPrioritarios, setIdsPrioritarios] = useState<Set<number>>(new Set());
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetch("/api/usuarios/opcoes", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ usuarios: UsuarioOpcao[] }>) : null))
			.then((data) => data && setUsuarios(data.usuarios))
			.catch(() => {});

		// Membros do projeto (e o responsável principal) aparecem primeiro na
		// lista de responsáveis — são quem realmente trabalha neste projeto.
		fetch(`/api/projetos/${projetoId}`, { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<ProjetoResumo>) : null))
			.then((data) => {
				if (!data) return;
				const ids = new Set(data.membros.map((m) => m.usuario_id));
				if (data.projeto.gerente_id) ids.add(data.projeto.gerente_id);
				setIdsPrioritarios(ids);
			})
			.catch(() => {});
	}, [projetoId]);

	const usuariosPrioritarios = usuarios.filter((u) => idsPrioritarios.has(u.id));
	const outrosUsuarios = usuarios.filter((u) => !idsPrioritarios.has(u.id));

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

		setSubmitting(true);
		try {
			const payload = {
				nome: form.nome,
				descricao: form.descricao || null,
				status: form.status,
				prioridade: form.prioridade,
				responsavel_id: form.responsavel_id ? Number(form.responsavel_id) : null,
				data_inicio: form.data_inicio || null,
				prazo: form.prazo || null,
				visivel_cliente: form.visivel_cliente,
			};

			const url = editando
				? `/api/projetos/${projetoId}/tarefas/${tarefa.id}`
				: `/api/projetos/${projetoId}/etapas/${etapaId}/tarefas`;

			const res = await fetch(url, {
				method: editando ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar a tarefa");
			}

			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar a tarefa");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title={editando ? "Editar tarefa" : "Nova tarefa"}
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
					<label htmlFor="tarefa-nome" className="block text-sm font-medium text-voia-neutral-900">
						Nome
					</label>
					<input
						id="tarefa-nome"
						type="text"
						value={form.nome}
						maxLength={200}
						onChange={(e) => set("nome")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="tarefa-descricao" className="block text-sm font-medium text-voia-neutral-900">
						Descrição
					</label>
					<textarea
						id="tarefa-descricao"
						value={form.descricao}
						onChange={(e) => set("descricao")(e.target.value)}
						rows={2}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="tarefa-status" className="block text-sm font-medium text-voia-neutral-900">
							Status
						</label>
						<select
							id="tarefa-status"
							value={form.status}
							onChange={(e) => set("status")(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							{STATUS_TAREFA.map((s) => (
								<option key={s} value={s}>
									{STATUS_TAREFA_LABEL[s]}
								</option>
							))}
						</select>
					</div>
					<div>
						<label htmlFor="tarefa-prioridade" className="block text-sm font-medium text-voia-neutral-900">
							Prioridade
						</label>
						<select
							id="tarefa-prioridade"
							value={form.prioridade}
							onChange={(e) => set("prioridade")(e.target.value)}
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
					<label htmlFor="tarefa-responsavel" className="block text-sm font-medium text-voia-neutral-900">
						Responsável
					</label>
					<select
						id="tarefa-responsavel"
						value={form.responsavel_id}
						onChange={(e) => set("responsavel_id")(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					>
						<option value="">Nenhum</option>
						{usuariosPrioritarios.length > 0 && (
							<optgroup label="Equipe do projeto">
								{usuariosPrioritarios.map((u) => (
									<option key={u.id} value={u.id}>
										{u.nome}
									</option>
								))}
							</optgroup>
						)}
						<optgroup label={usuariosPrioritarios.length > 0 ? "Outros usuários" : "Usuários"}>
							{outrosUsuarios.map((u) => (
								<option key={u.id} value={u.id}>
									{u.nome}
								</option>
							))}
						</optgroup>
					</select>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="tarefa-inicio" className="block text-sm font-medium text-voia-neutral-900">
							Início
						</label>
						<input
							id="tarefa-inicio"
							type="date"
							value={form.data_inicio}
							onChange={(e) => set("data_inicio")(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					<div>
						<label htmlFor="tarefa-prazo" className="block text-sm font-medium text-voia-neutral-900">
							Prazo
						</label>
						<input
							id="tarefa-prazo"
							type="date"
							value={form.prazo}
							onChange={(e) => set("prazo")(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
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

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

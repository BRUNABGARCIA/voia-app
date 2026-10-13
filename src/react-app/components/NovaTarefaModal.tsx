import { useEffect, useState, type FormEvent } from "react";
import ModalShell from "./ModalShell";
import { PRIORIDADE_LABEL, PRIORIDADES } from "../lib/projeto-tipos";

interface ProjetoOpcao {
	id: number;
	nome: string;
}

interface EtapaOpcao {
	id: number;
	nome: string;
}

interface UsuarioOpcao {
	id: number;
	nome: string;
}

/**
 * Criação rápida de tarefa fora do contexto de uma etapa específica — usada
 * em "Meu Dia"/Kanban, onde o usuário escolhe o projeto primeiro (e,
 * opcionalmente, uma etapa dele). Sempre POST /api/projetos/:id/tarefas
 * (etapa_id opcional, migration 0024) — nunca a rota aninhada em etapa, que
 * continua exigindo etapa. A lista de projetos já vem escopada pelo
 * backend (GET /api/projetos: Parceiro só vê os seus).
 */
export default function NovaTarefaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
	const [projetos, setProjetos] = useState<ProjetoOpcao[]>([]);
	const [projetoId, setProjetoId] = useState("");
	const [etapas, setEtapas] = useState<EtapaOpcao[]>([]);
	const [etapaId, setEtapaId] = useState("");
	const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
	const [nome, setNome] = useState("");
	const [descricao, setDescricao] = useState("");
	const [prioridade, setPrioridade] = useState("normal");
	const [responsavelId, setResponsavelId] = useState("");
	const [prazo, setPrazo] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetch("/api/projetos", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ projetos: ProjetoOpcao[] }>) : null))
			.then((data) => data && setProjetos(data.projetos))
			.catch(() => {});
		fetch("/api/usuarios/opcoes", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ usuarios: UsuarioOpcao[] }>) : null))
			.then((data) => data && setUsuarios(data.usuarios))
			.catch(() => {});
	}, []);

	useEffect(() => {
		setEtapaId("");
		if (!projetoId) {
			setEtapas([]);
			return;
		}
		fetch(`/api/projetos/${projetoId}/etapas`, { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ etapas: EtapaOpcao[] }>) : null))
			.then((data) => setEtapas(data?.etapas ?? []))
			.catch(() => setEtapas([]));
	}, [projetoId]);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (!projetoId) {
			setError("Selecione o projeto.");
			return;
		}
		if (nome.trim().length === 0) {
			setError("O nome da tarefa é obrigatório.");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch(`/api/projetos/${projetoId}/tarefas`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({
					nome,
					descricao: descricao || null,
					etapa_id: etapaId ? Number(etapaId) : null,
					prioridade,
					responsavel_id: responsavelId ? Number(responsavelId) : null,
					prazo: prazo || null,
				}),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível criar a tarefa");
			}
			onCreated();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível criar a tarefa");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title="Nova tarefa"
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
						{submitting ? "Criando…" : "Criar tarefa"}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				<div>
					<label htmlFor="nova-tarefa-projeto" className="block text-sm font-medium text-voia-neutral-900">
						Projeto
					</label>
					<select
						id="nova-tarefa-projeto"
						value={projetoId}
						onChange={(e) => setProjetoId(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					>
						<option value="">Selecione…</option>
						{projetos.map((p) => (
							<option key={p.id} value={p.id}>
								{p.nome}
							</option>
						))}
					</select>
				</div>
				<div>
					<label htmlFor="nova-tarefa-etapa" className="block text-sm font-medium text-voia-neutral-900">
						Etapa (opcional)
					</label>
					<select
						id="nova-tarefa-etapa"
						value={etapaId}
						onChange={(e) => setEtapaId(e.target.value)}
						disabled={!projetoId}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500 disabled:opacity-(--opacity-disabled)"
					>
						<option value="">Nenhuma — tarefa geral do projeto</option>
						{etapas.map((e) => (
							<option key={e.id} value={e.id}>
								{e.nome}
							</option>
						))}
					</select>
				</div>
				<div>
					<label htmlFor="nova-tarefa-nome" className="block text-sm font-medium text-voia-neutral-900">
						Nome
					</label>
					<input
						id="nova-tarefa-nome"
						type="text"
						value={nome}
						maxLength={200}
						onChange={(e) => setNome(e.target.value)}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div>
					<label htmlFor="nova-tarefa-descricao" className="block text-sm font-medium text-voia-neutral-900">
						Descrição
					</label>
					<textarea
						id="nova-tarefa-descricao"
						value={descricao}
						onChange={(e) => setDescricao(e.target.value)}
						rows={2}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="nova-tarefa-prioridade" className="block text-sm font-medium text-voia-neutral-900">
							Prioridade
						</label>
						<select
							id="nova-tarefa-prioridade"
							value={prioridade}
							onChange={(e) => setPrioridade(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							{PRIORIDADES.map((p) => (
								<option key={p} value={p}>
									{PRIORIDADE_LABEL[p]}
								</option>
							))}
						</select>
					</div>
					<div>
						<label htmlFor="nova-tarefa-prazo" className="block text-sm font-medium text-voia-neutral-900">
							Prazo
						</label>
						<input
							id="nova-tarefa-prazo"
							type="date"
							value={prazo}
							onChange={(e) => setPrazo(e.target.value)}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
				</div>
				<div>
					<label htmlFor="nova-tarefa-responsavel" className="block text-sm font-medium text-voia-neutral-900">
						Responsável
					</label>
					<select
						id="nova-tarefa-responsavel"
						value={responsavelId}
						onChange={(e) => setResponsavelId(e.target.value)}
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

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../contexts/useAuth";
import {
	PRIORIDADE_LABEL,
	PRIORIDADES,
	STATUS_PROJETO,
	STATUS_PROJETO_LABEL,
	type Projeto,
	type TipoServico,
} from "../lib/projeto-tipos";
import ModalShell from "./ModalShell";

interface ClienteOpcao {
	id: number;
	nome: string;
}

interface UsuarioOpcao {
	id: number;
	nome: string;
}

interface FormState {
	cliente_id: string;
	nome: string;
	descricao: string;
	status: string;
	prioridade: string;
	valorContratado: string; // reais, com vírgula/ponto — convertido para centavos no envio
	data_inicio: string;
	prazo_previsto: string;
	cep: string;
	logradouro: string;
	numero: string;
	complemento: string;
	bairro: string;
	cidade: string;
	estado: string;
	gerente_id: string;
	observacoes: string;
}

function projetoParaForm(projeto: Projeto | null): FormState {
	return {
		cliente_id: projeto ? String(projeto.cliente_id) : "",
		nome: projeto?.nome ?? "",
		descricao: projeto?.descricao ?? "",
		status: projeto?.status ?? "planejamento",
		prioridade: projeto?.prioridade ?? "normal",
		valorContratado: projeto?.valor_contratado != null ? (projeto.valor_contratado / 100).toFixed(2) : "",
		data_inicio: projeto?.data_inicio ?? "",
		prazo_previsto: projeto?.prazo_previsto ?? "",
		cep: projeto?.cep ?? "",
		logradouro: projeto?.logradouro ?? "",
		numero: projeto?.numero ?? "",
		complemento: projeto?.complemento ?? "",
		bairro: projeto?.bairro ?? "",
		cidade: projeto?.cidade ?? "",
		estado: projeto?.estado ?? "",
		gerente_id: projeto?.gerente_id ? String(projeto.gerente_id) : "",
		observacoes: projeto?.observacoes ?? "",
	};
}

function campo(
	label: string,
	id: keyof FormState,
	form: FormState,
	set: (v: string) => void,
	opts?: { max?: number; type?: string; maiusculo?: boolean },
) {
	return (
		<div>
			<label htmlFor={id} className="block text-sm font-medium text-voia-neutral-900">
				{label}
			</label>
			<input
				id={id}
				type={opts?.type ?? "text"}
				value={form[id]}
				maxLength={opts?.max}
				onChange={(e) => set(opts?.maiusculo ? e.target.value.toUpperCase() : e.target.value)}
				className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
			/>
		</div>
	);
}

export default function ProjetoModal({
	projeto,
	tiposServicoAtuais,
	onClose,
	onSaved,
}: {
	projeto: Projeto | null;
	tiposServicoAtuais: TipoServico[];
	onClose: () => void;
	onSaved: (projeto: Projeto, tipoServicoIds: number[]) => void;
}) {
	const { user } = useAuth();
	const editando = projeto !== null;
	const podeCancelar = user?.perfil === "administrador" || user?.perfil === "gestor";

	const [form, setForm] = useState<FormState>(() => projetoParaForm(projeto));
	const [tipoServicoIds, setTipoServicoIds] = useState<Set<number>>(
		() => new Set(tiposServicoAtuais.map((t) => t.id)),
	);
	const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
	const [tiposServico, setTiposServico] = useState<TipoServico[]>([]);
	const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetch("/api/clientes", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ clientes: ClienteOpcao[] }>) : null))
			.then((data) => data && setClientes(data.clientes))
			.catch(() => {});

		fetch("/api/projetos/tipos-servico", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ tiposServico: TipoServico[] }>) : null))
			.then((data) => data && setTiposServico(data.tiposServico))
			.catch(() => {});

		fetch("/api/usuarios/opcoes", { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ usuarios: UsuarioOpcao[] }>) : null))
			.then((data) => data && setUsuarios(data.usuarios))
			.catch(() => {});
	}, []);

	function set<K extends keyof FormState>(campo: K) {
		return (valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }));
	}

	function alternarTipoServico(id: number) {
		setTipoServicoIds((atual) => {
			const novo = new Set(atual);
			if (novo.has(id)) novo.delete(id);
			else novo.add(id);
			return novo;
		});
	}

	// Colaborador não pode transicionar um projeto para "cancelado" (regra do
	// backend) — a opção some da lista, exceto se já for o status atual (não
	// impedimos ver/manter o valor corrente).
	const statusOptions = STATUS_PROJETO.filter((s) => s !== "cancelado" || podeCancelar || s === form.status);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (form.nome.trim().length === 0) {
			setError("O nome do projeto é obrigatório.");
			return;
		}
		if (!form.cliente_id) {
			setError("Selecione um cliente.");
			return;
		}

		let valorCentavos: number | null = null;
		if (form.valorContratado.trim()) {
			const normalizado = form.valorContratado.replace(/\./g, "").replace(",", ".");
			const valor = Number(normalizado);
			if (!Number.isFinite(valor) || valor < 0) {
				setError("Valor contratado inválido.");
				return;
			}
			valorCentavos = Math.round(valor * 100);
		}

		setSubmitting(true);
		try {
			const payload: Record<string, unknown> = {
				cliente_id: Number(form.cliente_id),
				nome: form.nome,
				descricao: form.descricao || null,
				status: form.status,
				prioridade: form.prioridade,
				valor_contratado: valorCentavos,
				data_inicio: form.data_inicio || null,
				prazo_previsto: form.prazo_previsto || null,
				cep: form.cep || null,
				logradouro: form.logradouro || null,
				numero: form.numero || null,
				complemento: form.complemento || null,
				bairro: form.bairro || null,
				cidade: form.cidade || null,
				estado: form.estado ? form.estado.toUpperCase() : null,
				gerente_id: form.gerente_id ? Number(form.gerente_id) : null,
				observacoes: form.observacoes || null,
				tipo_servico_ids: Array.from(tipoServicoIds),
			};

			const res = await fetch(editando ? `/api/projetos/${projeto.id}` : "/api/projetos", {
				method: editando ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível salvar o projeto");
			}

			const { projeto: salvo } = (await res.json()) as { projeto: Projeto };
			onSaved(salvo, Array.from(tipoServicoIds));
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível salvar o projeto");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<ModalShell
			title={editando ? "Editar projeto" : "Novo projeto"}
			onClose={onClose}
			onSubmit={handleSubmit}
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
						{submitting ? "Salvando…" : editando ? "Salvar alterações" : "Criar projeto"}
					</button>
				</>
			}
		>
			<div className="space-y-6">
				<section>
					<h3 className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Identificação</h3>
					<div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="cliente_id" className="block text-sm font-medium text-voia-neutral-900">
								Cliente
							</label>
							<select
								id="cliente_id"
								value={form.cliente_id}
								onChange={(e) => set("cliente_id")(e.target.value)}
								className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
							>
								<option value="">Selecione…</option>
								{clientes.map((c) => (
									<option key={c.id} value={c.id}>
										{c.nome}
									</option>
								))}
							</select>
						</div>
						{campo("Nome do projeto", "nome", form, set("nome"), { max: 200 })}
					</div>
					<div className="mt-4">
						<label htmlFor="descricao" className="block text-sm font-medium text-voia-neutral-900">
							Descrição
						</label>
						<textarea
							id="descricao"
							value={form.descricao}
							onChange={(e) => set("descricao")(e.target.value)}
							rows={2}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					<div className="mt-4">
						<span className="block text-sm font-medium text-voia-neutral-900">Tipos de serviço</span>
						<div className="mt-2 flex flex-wrap gap-2">
							{tiposServico.map((tipo) => (
								<button
									key={tipo.id}
									type="button"
									onClick={() => alternarTipoServico(tipo.id)}
									className={`rounded-control px-3 py-1 text-sm font-medium transition-colors ${
										tipoServicoIds.has(tipo.id)
											? "bg-voia-gold-500 text-voia-green-950"
											: "border border-voia-neutral-100 text-voia-neutral-700 hover:bg-voia-beige-100"
									}`}
								>
									{tipo.nome}
								</button>
							))}
						</div>
					</div>
				</section>

				<section>
					<h3 className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Gestão</h3>
					<div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="status" className="block text-sm font-medium text-voia-neutral-900">
								Status
							</label>
							<select
								id="status"
								value={form.status}
								onChange={(e) => set("status")(e.target.value)}
								className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
							>
								{statusOptions.map((s) => (
									<option key={s} value={s}>
										{STATUS_PROJETO_LABEL[s]}
									</option>
								))}
							</select>
						</div>
						<div>
							<label htmlFor="prioridade" className="block text-sm font-medium text-voia-neutral-900">
								Prioridade
							</label>
							<select
								id="prioridade"
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
						<div>
							<label htmlFor="gerente_id" className="block text-sm font-medium text-voia-neutral-900">
								Responsável principal
							</label>
							<select
								id="gerente_id"
								value={form.gerente_id}
								onChange={(e) => set("gerente_id")(e.target.value)}
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
						{campo("Valor contratado (R$)", "valorContratado", form, set("valorContratado"))}
						{campo("Data de início", "data_inicio", form, set("data_inicio"), { type: "date" })}
						{campo("Prazo previsto", "prazo_previsto", form, set("prazo_previsto"), { type: "date" })}
					</div>
					<p className="mt-4 text-xs text-voia-neutral-500">
						O progresso do projeto é calculado automaticamente a partir das etapas, na aba Etapas do projeto.
						{!editando &&
							" Ao criar o projeto, as etapas iniciais são copiadas automaticamente do modelo de processo de cada tipo de serviço selecionado (Configurações > Tipos de Serviço)."}
					</p>
				</section>

				<section>
					<h3 className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Endereço da obra</h3>
					<div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
						{campo("CEP", "cep", form, set("cep"), { max: 10 })}
						{campo("Logradouro", "logradouro", form, set("logradouro"), { max: 200 })}
						{campo("Número", "numero", form, set("numero"), { max: 20 })}
						{campo("Complemento", "complemento", form, set("complemento"), { max: 100 })}
						{campo("Bairro", "bairro", form, set("bairro"), { max: 100 })}
						{campo("Cidade", "cidade", form, set("cidade"), { max: 100 })}
						{campo("Estado (UF)", "estado", form, set("estado"), { max: 2, maiusculo: true })}
					</div>
				</section>

				<section>
					<label htmlFor="observacoes" className="block text-sm font-medium text-voia-neutral-900">
						Observações
					</label>
					<textarea
						id="observacoes"
						value={form.observacoes}
						onChange={(e) => set("observacoes")(e.target.value)}
						rows={3}
						className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
				</section>

				{error && <p className="text-sm text-voia-danger">{error}</p>}
			</div>
		</ModalShell>
	);
}

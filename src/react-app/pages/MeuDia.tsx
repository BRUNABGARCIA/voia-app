import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import NovaTarefaModal from "../components/NovaTarefaModal";
import Tabs from "../components/Tabs";
import { PRIORIDADE_BADGE, PRIORIDADE_LABEL, formatarData } from "../lib/projeto-tipos";

interface TarefaAgregada {
	id: number;
	projeto_id: number;
	projeto_nome: string;
	etapa_id: number | null;
	etapa_nome: string | null;
	nome: string;
	descricao: string | null;
	status: string;
	prioridade: "baixa" | "normal" | "alta" | "urgente";
	responsavel_id: number | null;
	responsavel_nome: string | null;
	prazo: string | null;
	data_conclusao: string | null;
	criado_em: string;
	atrasada: number;
}

interface EntregaProxima {
	id: number;
	nome: string;
	data_fim_prevista: string;
	projeto_id: number;
	projeto_nome: string;
}

interface MeuDiaResposta {
	atrasadas: TarefaAgregada[];
	hoje: TarefaAgregada[];
	proximas: TarefaAgregada[];
	proximasEntregas: EntregaProxima[];
}

const ABAS = [
	{ key: "hoje", label: "Hoje" },
	{ key: "kanban", label: "Kanban" },
];

const COLUNAS: { status: string; label: string }[] = [
	{ status: "pendente", label: "Pendente" },
	{ status: "em_andamento", label: "Em andamento" },
	{ status: "concluida", label: "Concluída" },
];

function CardTarefa({
	tarefa,
	onMover,
}: {
	tarefa: TarefaAgregada;
	/** Alternativa sem drag-and-drop (mobile/touch): mover para a coluna anterior/próxima. */
	onMover?: (direcao: -1 | 1) => void;
}) {
	return (
		<div className="rounded-control border border-voia-neutral-100 bg-(--color-surface) p-3 text-sm shadow-card">
			<div className="flex items-start justify-between gap-2">
				<span className="font-medium text-voia-neutral-900">{tarefa.nome}</span>
				<span className={`shrink-0 rounded-control px-2 py-0.5 text-xs font-medium ${PRIORIDADE_BADGE[tarefa.prioridade]}`}>
					{PRIORIDADE_LABEL[tarefa.prioridade]}
				</span>
			</div>
			<div className="mt-1 text-xs text-voia-neutral-500">
				<Link to={`/projetos/${tarefa.projeto_id}`} className="hover:underline">
					{tarefa.projeto_nome}
				</Link>
				{tarefa.etapa_nome && <span> · {tarefa.etapa_nome}</span>}
			</div>
			<div className="mt-1 flex items-center justify-between text-xs">
				<span className="text-voia-neutral-500">{tarefa.responsavel_nome ?? "Sem responsável"}</span>
				<span className={tarefa.atrasada ? "font-medium text-voia-danger" : "text-voia-neutral-500"}>
					{formatarData(tarefa.prazo)}
					{tarefa.atrasada ? " · Atrasada" : ""}
				</span>
			</div>
			{onMover && (
				<div className="mt-2 flex justify-end gap-2">
					<button
						type="button"
						aria-label="Mover para a coluna anterior"
						onClick={() => onMover(-1)}
						className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						←
					</button>
					<button
						type="button"
						aria-label="Mover para a próxima coluna"
						onClick={() => onMover(1)}
						className="rounded-control border border-voia-neutral-100 px-2 py-1 text-xs font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						→
					</button>
				</div>
			)}
		</div>
	);
}

function SecaoTarefas({ titulo, tarefas, vazio }: { titulo: string; tarefas: TarefaAgregada[]; vazio: string }) {
	return (
		<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
			<h2 className="font-display text-lg text-voia-green-900">{titulo}</h2>
			{tarefas.length === 0 ? (
				<p className="mt-3 text-sm text-voia-neutral-500">{vazio}</p>
			) : (
				<ul className="mt-3 space-y-2">
					{tarefas.map((t) => (
						<li key={t.id}>
							<CardTarefa tarefa={t} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export default function MeuDia() {
	const [aba, setAba] = useState("hoje");
	const [resumo, setResumo] = useState<MeuDiaResposta | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);

	const [kanban, setKanban] = useState<TarefaAgregada[] | null>(null);
	const [kanbanError, setKanbanError] = useState<string | null>(null);
	const [filtroPrioridade, setFiltroPrioridade] = useState("");
	const [arrastandoId, setArrastandoId] = useState<number | null>(null);

	const carregarMeuDia = useCallback(() => {
		fetch("/api/tarefas/meu-dia", { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<MeuDiaResposta>;
			})
			.then(setResumo)
			.catch(() => setError("Não foi possível carregar o seu dia."));
	}, []);

	const carregarKanban = useCallback(() => {
		const params = new URLSearchParams();
		if (filtroPrioridade) params.set("prioridade", filtroPrioridade);
		fetch(`/api/tarefas?${params.toString()}`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<{ tarefas: TarefaAgregada[] }>;
			})
			.then((data) => setKanban(data.tarefas))
			.catch(() => setKanbanError("Não foi possível carregar o Kanban."));
	}, [filtroPrioridade]);

	useEffect(() => {
		carregarMeuDia();
	}, [carregarMeuDia]);

	useEffect(() => {
		if (aba === "kanban") carregarKanban();
	}, [aba, carregarKanban]);

	const colunas = useMemo(() => {
		const mapa = new Map<string, TarefaAgregada[]>();
		for (const col of COLUNAS) mapa.set(col.status, []);
		for (const t of kanban ?? []) {
			const lista = mapa.get(t.status);
			if (lista) lista.push(t);
		}
		return mapa;
	}, [kanban]);

	function moverColuna(tarefa: TarefaAgregada, direcao: -1 | 1) {
		const indiceAtual = COLUNAS.findIndex((c) => c.status === tarefa.status);
		const proximoIndice = indiceAtual + direcao;
		if (proximoIndice < 0 || proximoIndice >= COLUNAS.length) return;
		moverParaStatus(tarefa, COLUNAS[proximoIndice].status);
	}

	async function moverParaStatus(tarefa: TarefaAgregada, status: string) {
		if (tarefa.status === status) return;
		// Otimista: move o card já na tela, sem esperar a rede.
		setKanban((atual) => atual?.map((t) => (t.id === tarefa.id ? { ...t, status } : t)) ?? atual);
		try {
			const res = await fetch(`/api/projetos/${tarefa.projeto_id}/tarefas/${tarefa.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ status }),
			});
			if (!res.ok) throw new Error();
		} catch {
			setKanbanError("Não foi possível mover a tarefa — tente novamente.");
			carregarKanban();
		}
	}

	function handleCriada() {
		setCriando(false);
		carregarMeuDia();
		if (aba === "kanban") carregarKanban();
	}

	return (
		<div>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="font-display text-2xl font-light text-voia-neutral-900">Meu Dia</h1>
					<p className="mt-1 text-sm text-voia-neutral-700">Suas tarefas, prazos e entregas em um só lugar.</p>
				</div>
				<button
					type="button"
					onClick={() => setCriando(true)}
					className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400"
				>
					+ Nova tarefa
				</button>
			</div>

			<div className="mt-6">
				<Tabs abas={ABAS} ativa={aba} onChange={setAba} />
			</div>

			{aba === "hoje" && (
				<div className="mt-6 space-y-6">
					{error && <p className="text-sm text-voia-danger">{error}</p>}
					{!error && !resumo && <p className="text-sm text-voia-neutral-500">Carregando…</p>}
					{resumo && (
						<>
							<SecaoTarefas titulo="Atrasadas" tarefas={resumo.atrasadas} vazio="Nenhuma tarefa atrasada." />
							<SecaoTarefas titulo="Hoje" tarefas={resumo.hoje} vazio="Nenhuma tarefa para hoje." />
							<SecaoTarefas titulo="Próximas" tarefas={resumo.proximas} vazio="Nenhuma tarefa futura pendente." />
							<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
								<h2 className="font-display text-lg text-voia-green-900">Próximas entregas</h2>
								{resumo.proximasEntregas.length === 0 ? (
									<p className="mt-3 text-sm text-voia-neutral-500">Nenhuma entrega prevista nos próximos 7 dias.</p>
								) : (
									<ul className="mt-3 space-y-2">
										{resumo.proximasEntregas.map((e) => (
											<li key={e.id} className="text-sm">
												<Link to={`/projetos/${e.projeto_id}`} className="font-medium text-voia-green-800 hover:underline">
													{e.nome}
												</Link>
												<span className="ml-2 text-xs text-voia-neutral-500">
													{e.projeto_nome} · {formatarData(e.data_fim_prevista)}
												</span>
											</li>
										))}
									</ul>
								)}
							</div>
						</>
					)}
				</div>
			)}

			{aba === "kanban" && (
				<div className="mt-6">
					<div className="flex flex-wrap items-center gap-3">
						<select
							value={filtroPrioridade}
							onChange={(e) => setFiltroPrioridade(e.target.value)}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							<option value="">Todas as prioridades</option>
							<option value="urgente">Urgente</option>
							<option value="alta">Alta</option>
							<option value="normal">Normal</option>
							<option value="baixa">Baixa</option>
						</select>
						<span className="text-xs text-voia-neutral-500">Arraste um card para outra coluna para mudar o status.</span>
					</div>

					{kanbanError && <p className="mt-3 text-sm text-voia-danger">{kanbanError}</p>}
					{!kanban && !kanbanError && <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>}

					{kanban && (
						<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
							{COLUNAS.map((col) => (
								<div
									key={col.status}
									onDragOver={(e) => e.preventDefault()}
									onDrop={(e) => {
										e.preventDefault();
										const tarefa = kanban.find((t) => t.id === arrastandoId);
										if (tarefa) moverParaStatus(tarefa, col.status);
										setArrastandoId(null);
									}}
									className="rounded-card border border-voia-neutral-100 bg-voia-beige-50 p-3"
								>
									<div className="flex items-center justify-between px-1">
										<h3 className="text-sm font-medium text-voia-neutral-700">{col.label}</h3>
										<span className="text-xs text-voia-neutral-500">{colunas.get(col.status)?.length ?? 0}</span>
									</div>
									<div className="mt-2 space-y-2">
										{(colunas.get(col.status) ?? []).map((t) => (
											<div
												key={t.id}
												draggable
												onDragStart={() => setArrastandoId(t.id)}
												onDragEnd={() => setArrastandoId(null)}
												className="cursor-grab active:cursor-grabbing"
											>
												<CardTarefa tarefa={t} onMover={(direcao) => moverColuna(t, direcao)} />
											</div>
										))}
										{(colunas.get(col.status) ?? []).length === 0 && (
											<p className="px-1 py-2 text-xs text-voia-neutral-500">Nenhuma tarefa aqui.</p>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{criando && <NovaTarefaModal onClose={() => setCriando(false)} onCreated={handleCriada} />}
		</div>
	);
}

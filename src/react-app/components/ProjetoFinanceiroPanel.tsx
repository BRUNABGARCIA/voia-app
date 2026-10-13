import { useCallback, useEffect, useState } from "react";
import { formatarMoeda, type MembroProjeto } from "../lib/projeto-tipos";

const TIPOS_REMUNERACAO = ["fixo", "percentual", "por_etapa", "por_entrega", "bonus", "adiantamento", "reembolso"] as const;
type TipoRemuneracao = (typeof TIPOS_REMUNERACAO)[number];

const TIPO_LABEL: Record<string, string> = {
	fixo: "Valor fixo",
	percentual: "Percentual",
	por_etapa: "Por etapa",
	por_entrega: "Por entrega",
	bonus: "Bônus",
	adiantamento: "Adiantamento",
	reembolso: "Reembolso",
};

const STATUS_LABEL: Record<string, string> = {
	pendente: "Pendente",
	programado: "Programado",
	pago: "Pago",
	cancelado: "Cancelado",
};

const STATUS_BADGE: Record<string, string> = {
	pendente: "bg-voia-neutral-100 text-voia-neutral-500",
	programado: "bg-voia-warning/15 text-voia-warning",
	pago: "bg-voia-success/15 text-voia-success",
	cancelado: "bg-voia-danger/15 text-voia-danger",
};

function formatarData(valor: string | null): string {
	if (!valor) return "—";
	const data = new Date(valor.length <= 10 ? `${valor}T00:00:00` : valor.replace(" ", "T"));
	if (Number.isNaN(data.getTime())) return "—";
	return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function paraCentavos(valor: string): number | null {
	if (!valor.trim()) return null;
	const normalizado = valor.replace(/\./g, "").replace(",", ".");
	const numero = Number(normalizado);
	if (!Number.isFinite(numero) || numero < 0) return null;
	return Math.round(numero * 100);
}

interface Remuneracao {
	id: number;
	projeto_id: number;
	parceiro_id: number;
	parceiro_nome: string;
	tipo: TipoRemuneracao;
	valor_acordado: number;
	percentual: number | null;
	referencia_entrega: string | null;
	ativo: number;
	criado_em: string;
}

interface Pagamento {
	id: number;
	remuneracao_id: number;
	valor: number;
	data_programada: string | null;
	data_pagamento: string | null;
	status: string;
	observacao: string | null;
}

function PagamentosDaRemuneracao({ remuneracaoId }: { remuneracaoId: number }) {
	const [pagamentos, setPagamentos] = useState<Pagamento[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [adicionando, setAdicionando] = useState(false);
	const [valor, setValor] = useState("");
	const [dataProgramada, setDataProgramada] = useState("");

	const carregar = useCallback(() => {
		fetch(`/api/financeiro/remuneracoes/${remuneracaoId}/pagamentos`, { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ pagamentos: Pagamento[] }>) : null))
			.then((data) => data && setPagamentos(data.pagamentos))
			.catch(() => setError("Não foi possível carregar os pagamentos."));
	}, [remuneracaoId]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	async function adicionarPagamento() {
		const centavos = paraCentavos(valor);
		if (centavos === null) {
			setError("Informe um valor válido.");
			return;
		}
		setError(null);
		try {
			const res = await fetch(`/api/financeiro/remuneracoes/${remuneracaoId}/pagamentos`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ valor: centavos, data_programada: dataProgramada || null }),
			});
			if (!res.ok) throw new Error();
			setValor("");
			setDataProgramada("");
			setAdicionando(false);
			carregar();
		} catch {
			setError("Não foi possível adicionar o pagamento.");
		}
	}

	async function alterarStatus(id: number, status: "pago" | "cancelado") {
		setError(null);
		try {
			const res = await fetch(`/api/financeiro/pagamentos/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ status }),
			});
			if (!res.ok) throw new Error();
			carregar();
		} catch {
			setError("Não foi possível atualizar o pagamento.");
		}
	}

	return (
		<div className="mt-3 rounded-control border border-voia-neutral-100 bg-voia-beige-50 p-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Pagamentos</span>
				{!adicionando && (
					<button type="button" onClick={() => setAdicionando(true)} className="text-xs font-medium text-voia-gold-500 hover:underline">
						+ Programar pagamento
					</button>
				)}
			</div>

			{adicionando && (
				<div className="mt-2 flex flex-wrap items-end gap-2">
					<input
						type="text"
						placeholder="Valor (R$)"
						value={valor}
						onChange={(e) => setValor(e.target.value)}
						className="w-28 rounded-control border border-voia-neutral-100 px-2 py-1 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
					<input
						type="date"
						value={dataProgramada}
						onChange={(e) => setDataProgramada(e.target.value)}
						className="rounded-control border border-voia-neutral-100 px-2 py-1 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
					/>
					<button
						type="button"
						onClick={adicionarPagamento}
						className="rounded-control bg-voia-gold-500 px-3 py-1 text-xs font-medium text-voia-green-950 hover:bg-voia-gold-400"
					>
						Adicionar
					</button>
					<button
						type="button"
						onClick={() => setAdicionando(false)}
						className="rounded-control border border-voia-neutral-100 px-3 py-1 text-xs font-medium text-voia-neutral-700"
					>
						Cancelar
					</button>
				</div>
			)}

			{error && <p className="mt-2 text-xs text-voia-danger">{error}</p>}
			{!pagamentos && <p className="mt-2 text-sm text-voia-neutral-500">Carregando…</p>}
			{pagamentos && pagamentos.length === 0 && <p className="mt-2 text-sm text-voia-neutral-500">Nenhum pagamento programado ainda.</p>}
			{pagamentos && pagamentos.length > 0 && (
				<ul className="mt-2 space-y-2">
					{pagamentos.map((p) => (
						<li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
							<span className="font-medium text-voia-neutral-900">{formatarMoeda(p.valor)}</span>
							<span className={`rounded-control px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status]}`}>
								{STATUS_LABEL[p.status] ?? p.status}
							</span>
							<span className="text-xs text-voia-neutral-500">
								{p.status === "pago" ? formatarData(p.data_pagamento) : formatarData(p.data_programada)}
							</span>
							{(p.status === "pendente" || p.status === "programado") && (
								<div className="flex gap-2">
									<button type="button" onClick={() => alterarStatus(p.id, "pago")} className="text-xs font-medium text-voia-success hover:underline">
										Confirmar pago
									</button>
									<button type="button" onClick={() => alterarStatus(p.id, "cancelado")} className="text-xs font-medium text-voia-danger hover:underline">
										Cancelar
									</button>
								</div>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/**
 * Admin/gestor: remuneração e pagamentos dos parceiros vinculados ao
 * projeto. Fluxo deliberadamente simples (lista + formulário inline), sem
 * tela própria — a visão detalhada por parceiro já existe em "Meus
 * Recebimentos" (parceiro) e não precisa ser duplicada aqui.
 */
export default function ProjetoFinanceiroPanel({ projetoId }: { projetoId: number }) {
	const [remuneracoes, setRemuneracoes] = useState<Remuneracao[] | null>(null);
	const [membros, setMembros] = useState<MembroProjeto[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);
	const [abertaId, setAbertaId] = useState<number | null>(null);

	const [parceiroId, setParceiroId] = useState("");
	const [tipo, setTipo] = useState<TipoRemuneracao>("fixo");
	const [valor, setValor] = useState("");
	const [percentual, setPercentual] = useState("");
	const [referencia, setReferencia] = useState("");

	const carregar = useCallback(() => {
		fetch(`/api/financeiro/projetos/${projetoId}/remuneracoes`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<{ remuneracoes: Remuneracao[] }>;
			})
			.then((data) => setRemuneracoes(data.remuneracoes))
			.catch(() => setError("Não foi possível carregar a remuneração dos parceiros."));
	}, [projetoId]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	useEffect(() => {
		fetch(`/api/projetos/${projetoId}/membros`, { credentials: "same-origin" })
			.then((res) => (res.ok ? (res.json() as Promise<{ membros: MembroProjeto[] }>) : null))
			.then((data) => data && setMembros(data.membros))
			.catch(() => {});
	}, [projetoId]);

	function limparFormulario() {
		setParceiroId("");
		setTipo("fixo");
		setValor("");
		setPercentual("");
		setReferencia("");
	}

	async function criarRemuneracao() {
		const centavos = paraCentavos(valor);
		if (!parceiroId || centavos === null) {
			setError("Selecione o parceiro e informe um valor válido.");
			return;
		}
		setError(null);
		try {
			const res = await fetch(`/api/financeiro/projetos/${projetoId}/remuneracoes`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({
					parceiro_id: Number(parceiroId),
					tipo,
					valor_acordado: centavos,
					percentual: tipo === "percentual" && percentual.trim() ? Number(percentual.replace(",", ".")) : null,
					referencia_entrega: referencia || null,
				}),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível criar a remuneração");
			}
			limparFormulario();
			setCriando(false);
			carregar();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível criar a remuneração");
		}
	}

	async function alternarAtivo(remuneracao: Remuneracao) {
		setError(null);
		try {
			const res = await fetch(`/api/financeiro/remuneracoes/${remuneracao.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ ativo: remuneracao.ativo ? false : true }),
			});
			if (!res.ok) throw new Error();
			carregar();
		} catch {
			setError("Não foi possível atualizar a remuneração.");
		}
	}

	return (
		<div className="mt-6 rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
			<div className="flex items-center justify-between">
				<h2 className="font-display text-lg text-voia-green-900">Remuneração de parceiros</h2>
				{!criando && membros.length > 0 && (
					<button
						type="button"
						onClick={() => setCriando(true)}
						className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						+ Nova remuneração
					</button>
				)}
			</div>

			{membros.length === 0 && (
				<p className="mt-3 text-sm text-voia-neutral-500">Adicione membros à equipe do projeto para vincular remuneração.</p>
			)}

			{criando && (
				<div className="mt-4 flex flex-wrap items-end gap-3 rounded-control bg-voia-beige-50 p-3">
					<div>
						<label htmlFor="fin-parceiro" className="block text-xs font-medium text-voia-neutral-700">
							Parceiro
						</label>
						<select
							id="fin-parceiro"
							value={parceiroId}
							onChange={(e) => setParceiroId(e.target.value)}
							className="mt-1 rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							<option value="">Selecione…</option>
							{membros.map((m) => (
								<option key={m.usuario_id} value={m.usuario_id}>
									{m.nome}
								</option>
							))}
						</select>
					</div>
					<div>
						<label htmlFor="fin-tipo" className="block text-xs font-medium text-voia-neutral-700">
							Tipo
						</label>
						<select
							id="fin-tipo"
							value={tipo}
							onChange={(e) => setTipo(e.target.value as TipoRemuneracao)}
							className="mt-1 rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						>
							{TIPOS_REMUNERACAO.map((t) => (
								<option key={t} value={t}>
									{TIPO_LABEL[t]}
								</option>
							))}
						</select>
					</div>
					<div>
						<label htmlFor="fin-valor" className="block text-xs font-medium text-voia-neutral-700">
							Valor acordado (R$)
						</label>
						<input
							id="fin-valor"
							type="text"
							value={valor}
							onChange={(e) => setValor(e.target.value)}
							className="mt-1 w-32 rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					{tipo === "percentual" && (
						<div>
							<label htmlFor="fin-percentual" className="block text-xs font-medium text-voia-neutral-700">
								Percentual (%)
							</label>
							<input
								id="fin-percentual"
								type="text"
								value={percentual}
								onChange={(e) => setPercentual(e.target.value)}
								className="mt-1 w-20 rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
							/>
						</div>
					)}
					<div>
						<label htmlFor="fin-referencia" className="block text-xs font-medium text-voia-neutral-700">
							Referência (opcional)
						</label>
						<input
							id="fin-referencia"
							type="text"
							value={referencia}
							onChange={(e) => setReferencia(e.target.value)}
							className="mt-1 rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					<button
						type="button"
						onClick={criarRemuneracao}
						className="rounded-control bg-voia-gold-500 px-3 py-1.5 text-sm font-medium text-voia-green-950 hover:bg-voia-gold-400"
					>
						Criar
					</button>
					<button
						type="button"
						onClick={() => {
							setCriando(false);
							limparFormulario();
						}}
						className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-(--color-surface)"
					>
						Cancelar
					</button>
				</div>
			)}

			{error && <p className="mt-3 text-sm text-voia-danger">{error}</p>}
			{!remuneracoes && <p className="mt-4 text-sm text-voia-neutral-500">Carregando…</p>}
			{remuneracoes && remuneracoes.length === 0 && (
				<p className="mt-4 text-sm text-voia-neutral-500">Nenhuma remuneração cadastrada ainda.</p>
			)}

			{remuneracoes && remuneracoes.length > 0 && (
				<ul className="mt-4 space-y-3">
					{remuneracoes.map((r) => (
						<li key={r.id} className="rounded-control border border-voia-neutral-100 p-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<span className="font-medium text-voia-neutral-900">{r.parceiro_nome}</span>
									<span className="ml-2 rounded-control bg-voia-beige-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-700">
										{TIPO_LABEL[r.tipo] ?? r.tipo}
									</span>
									{r.tipo === "percentual" && r.percentual !== null && (
										<span className="ml-2 text-xs text-voia-neutral-500">{r.percentual}%</span>
									)}
									{!r.ativo && (
										<span className="ml-2 rounded-control bg-voia-neutral-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-500">
											Inativa
										</span>
									)}
								</div>
								<div className="flex items-center gap-3">
									<span className="text-sm font-medium text-voia-neutral-900">{formatarMoeda(r.valor_acordado)}</span>
									<button
										type="button"
										onClick={() => setAbertaId(abertaId === r.id ? null : r.id)}
										className="text-sm font-medium text-voia-gold-500 hover:underline"
									>
										{abertaId === r.id ? "Ocultar pagamentos" : "Ver pagamentos"}
									</button>
									<button type="button" onClick={() => alternarAtivo(r)} className="text-xs font-medium text-voia-neutral-500 hover:underline">
										{r.ativo ? "Desativar" : "Reativar"}
									</button>
								</div>
							</div>
							{r.referencia_entrega && <p className="mt-1 text-xs text-voia-neutral-500">{r.referencia_entrega}</p>}
							{abertaId === r.id && <PagamentosDaRemuneracao remuneracaoId={r.id} />}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

import { useEffect, useState } from "react";
import { formatarMoeda } from "../lib/projeto-tipos";

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

interface Remuneracao {
	id: number;
	projeto_id: number;
	projeto_nome: string;
	tipo: string;
	valor_acordado: number;
	percentual: number | null;
	referencia_entrega: string | null;
	total_pago: number;
	saldo_a_receber: number;
}

interface Pagamento {
	id: number;
	valor: number;
	data_programada: string | null;
	data_pagamento: string | null;
	status: string;
	observacao: string | null;
}

interface Resumo {
	totalAcordado: number;
	totalRecebido: number;
	saldoAReceber: number;
}

function formatarData(valor: string | null): string {
	if (!valor) return "—";
	const data = new Date(valor.length <= 10 ? `${valor}T00:00:00` : valor.replace(" ", "T"));
	if (Number.isNaN(data.getTime())) return "—";
	return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DetalheRemuneracao({ remuneracaoId, onClose }: { remuneracaoId: number; onClose: () => void }) {
	const [pagamentos, setPagamentos] = useState<Pagamento[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch(`/api/financeiro/meus-recebimentos/${remuneracaoId}/pagamentos`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<{ pagamentos: Pagamento[] }>;
			})
			.then((data) => {
				if (!cancelled) setPagamentos(data.pagamentos);
			})
			.catch(() => {
				if (!cancelled) setError("Não foi possível carregar os pagamentos.");
			});
		return () => {
			cancelled = true;
		};
	}, [remuneracaoId]);

	return (
		<div className="mt-3 rounded-control border border-voia-neutral-100 bg-voia-beige-50 p-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Pagamentos</span>
				<button type="button" onClick={onClose} className="text-xs text-voia-neutral-500 hover:underline">
					Fechar
				</button>
			</div>
			{error && <p className="mt-2 text-sm text-voia-danger">{error}</p>}
			{!error && !pagamentos && <p className="mt-2 text-sm text-voia-neutral-500">Carregando…</p>}
			{pagamentos && pagamentos.length === 0 && (
				<p className="mt-2 text-sm text-voia-neutral-500">Nenhum pagamento programado ainda.</p>
			)}
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
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export default function MeusRecebimentos() {
	const [resumo, setResumo] = useState<Resumo | null>(null);
	const [remuneracoes, setRemuneracoes] = useState<Remuneracao[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [detalheAberto, setDetalheAberto] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/financeiro/meus-recebimentos", { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<{ resumo: Resumo; remuneracoes: Remuneracao[] }>;
			})
			.then((data) => {
				if (cancelled) return;
				setResumo(data.resumo);
				setRemuneracoes(data.remuneracoes);
			})
			.catch(() => {
				if (!cancelled) setError("Não foi possível carregar seus recebimentos.");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div>
			<h1 className="font-display text-2xl font-light text-voia-neutral-900">Meus Recebimentos</h1>
			<p className="mt-1 text-sm text-voia-neutral-700">Valores combinados com você e o andamento dos pagamentos.</p>

			{error && <p className="mt-6 text-sm text-voia-danger">{error}</p>}
			{!error && !resumo && <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>}

			{resumo && remuneracoes && (
				<>
					<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Total acordado</span>
							<span className="mt-1 block font-display text-2xl font-light text-voia-green-900">
								{formatarMoeda(resumo.totalAcordado)}
							</span>
						</div>
						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Total recebido</span>
							<span className="mt-1 block font-display text-2xl font-light text-voia-success">
								{formatarMoeda(resumo.totalRecebido)}
							</span>
						</div>
						<div className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Saldo a receber</span>
							<span className="mt-1 block font-display text-2xl font-light text-voia-green-900">
								{formatarMoeda(resumo.saldoAReceber)}
							</span>
						</div>
					</div>

					<div className="mt-6">
						{remuneracoes.length === 0 ? (
							<p className="text-sm text-voia-neutral-500">Você ainda não possui recebimentos cadastrados.</p>
						) : (
							<ul className="space-y-3">
								{remuneracoes.map((r) => (
									<li
										key={r.id}
										className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card"
									>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div>
												<span className="font-medium text-voia-neutral-900">{r.projeto_nome}</span>
												<span className="ml-2 rounded-control bg-voia-beige-100 px-2 py-0.5 text-xs font-medium text-voia-neutral-700">
													{TIPO_LABEL[r.tipo] ?? r.tipo}
												</span>
												{r.tipo === "percentual" && r.percentual !== null && (
													<span className="ml-2 text-xs text-voia-neutral-500">{r.percentual}%</span>
												)}
											</div>
											<button
												type="button"
												onClick={() => setDetalheAberto(detalheAberto === r.id ? null : r.id)}
												className="text-sm font-medium text-voia-gold-500 hover:underline"
											>
												{detalheAberto === r.id ? "Ocultar pagamentos" : "Ver pagamentos"}
											</button>
										</div>
										<div className="mt-3 grid grid-cols-3 gap-4 text-sm">
											<div>
												<span className="block text-xs text-voia-neutral-500">Acordado</span>
												<span className="font-medium text-voia-neutral-900">{formatarMoeda(r.valor_acordado)}</span>
											</div>
											<div>
												<span className="block text-xs text-voia-neutral-500">Recebido</span>
												<span className="font-medium text-voia-success">{formatarMoeda(r.total_pago)}</span>
											</div>
											<div>
												<span className="block text-xs text-voia-neutral-500">Saldo</span>
												<span className="font-medium text-voia-neutral-900">{formatarMoeda(r.saldo_a_receber)}</span>
											</div>
										</div>
										{detalheAberto === r.id && <DetalheRemuneracao remuneracaoId={r.id} onClose={() => setDetalheAberto(null)} />}
									</li>
								))}
							</ul>
						)}
					</div>
				</>
			)}
		</div>
	);
}

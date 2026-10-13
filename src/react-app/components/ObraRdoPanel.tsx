import { useCallback, useEffect, useState } from "react";
import { formatarData } from "../lib/projeto-tipos";
import type { Rdo } from "../lib/obra-tipos";

interface FormState {
	data: string;
	condicoes_climaticas: string;
	mao_de_obra: string;
	servicos_executados: string;
	equipamentos: string;
	materiais: string;
	ocorrencias: string;
	observacoes: string;
}

function formVazio(): FormState {
	return {
		data: new Date().toISOString().slice(0, 10),
		condicoes_climaticas: "",
		mao_de_obra: "",
		servicos_executados: "",
		equipamentos: "",
		materiais: "",
		ocorrencias: "",
		observacoes: "",
	};
}

export default function ObraRdoPanel({ obraId, podeEditar }: { obraId: number; podeEditar: boolean }) {
	const [rdos, setRdos] = useState<Rdo[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [criando, setCriando] = useState(false);
	const [form, setForm] = useState<FormState>(formVazio());
	const [abertoId, setAbertoId] = useState<number | null>(null);

	const carregar = useCallback(() => {
		fetch(`/api/obras/${obraId}/rdo`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.json() as Promise<{ rdos: Rdo[] }>;
			})
			.then((data) => setRdos(data.rdos))
			.catch(() => setError("Não foi possível carregar o diário de obra."));
	}, [obraId]);

	useEffect(() => {
		carregar();
	}, [carregar]);

	function set<K extends keyof FormState>(campo: K) {
		return (valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }));
	}

	async function criar() {
		setError(null);
		try {
			const res = await fetch(`/api/obras/${obraId}/rdo`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({
					data: form.data,
					condicoes_climaticas: form.condicoes_climaticas || null,
					mao_de_obra: form.mao_de_obra || null,
					servicos_executados: form.servicos_executados || null,
					equipamentos: form.equipamentos || null,
					materiais: form.materiais || null,
					ocorrencias: form.ocorrencias || null,
					observacoes: form.observacoes || null,
				}),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? "não foi possível registrar o RDO");
			}
			setForm(formVazio());
			setCriando(false);
			carregar();
		} catch (err) {
			setError(err instanceof Error ? err.message : "não foi possível registrar o RDO");
		}
	}

	return (
		<div className="mt-6 space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="font-display text-lg text-voia-green-900">Diário de Obra</h2>
				{podeEditar && !criando && (
					<button
						type="button"
						onClick={() => setCriando(true)}
						className="rounded-control bg-voia-gold-500 px-3 py-1.5 text-sm font-medium text-voia-green-950 hover:bg-voia-gold-400"
					>
						+ Novo RDO
					</button>
				)}
			</div>

			{criando && (
				<div className="space-y-3 rounded-card border border-voia-neutral-100 bg-voia-beige-50 p-(--space-card)">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label htmlFor="rdo-data" className="block text-xs font-medium text-voia-neutral-700">
								Data
							</label>
							<input
								id="rdo-data"
								type="date"
								value={form.data}
								onChange={(e) => set("data")(e.target.value)}
								className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
							/>
						</div>
						<div>
							<label htmlFor="rdo-clima" className="block text-xs font-medium text-voia-neutral-700">
								Condições climáticas
							</label>
							<input
								id="rdo-clima"
								type="text"
								value={form.condicoes_climaticas}
								onChange={(e) => set("condicoes_climaticas")(e.target.value)}
								placeholder="Ex.: Ensolarado, sem chuva"
								className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
							/>
						</div>
					</div>
					<div>
						<label htmlFor="rdo-mao-obra" className="block text-xs font-medium text-voia-neutral-700">
							Mão de obra presente
						</label>
						<textarea
							id="rdo-mao-obra"
							value={form.mao_de_obra}
							onChange={(e) => set("mao_de_obra")(e.target.value)}
							rows={2}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					<div>
						<label htmlFor="rdo-servicos" className="block text-xs font-medium text-voia-neutral-700">
							Serviços executados
						</label>
						<textarea
							id="rdo-servicos"
							value={form.servicos_executados}
							onChange={(e) => set("servicos_executados")(e.target.value)}
							rows={3}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label htmlFor="rdo-equipamentos" className="block text-xs font-medium text-voia-neutral-700">
								Equipamentos (opcional)
							</label>
							<textarea
								id="rdo-equipamentos"
								value={form.equipamentos}
								onChange={(e) => set("equipamentos")(e.target.value)}
								rows={2}
								className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
							/>
						</div>
						<div>
							<label htmlFor="rdo-materiais" className="block text-xs font-medium text-voia-neutral-700">
								Materiais (opcional)
							</label>
							<textarea
								id="rdo-materiais"
								value={form.materiais}
								onChange={(e) => set("materiais")(e.target.value)}
								rows={2}
								className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
							/>
						</div>
					</div>
					<div>
						<label htmlFor="rdo-ocorrencias" className="block text-xs font-medium text-voia-neutral-700">
							Ocorrências do dia (opcional)
						</label>
						<textarea
							id="rdo-ocorrencias"
							value={form.ocorrencias}
							onChange={(e) => set("ocorrencias")(e.target.value)}
							rows={2}
							className="mt-1 w-full rounded-control border border-voia-neutral-100 px-3 py-2 text-sm text-voia-neutral-900 outline-none focus:border-voia-gold-500"
						/>
					</div>
					{error && <p className="text-sm text-voia-danger">{error}</p>}
					<div className="flex gap-2">
						<button
							type="button"
							onClick={criar}
							className="rounded-control bg-voia-gold-500 px-3 py-1.5 text-sm font-medium text-voia-green-950 hover:bg-voia-gold-400"
						>
							Salvar RDO
						</button>
						<button
							type="button"
							onClick={() => {
								setCriando(false);
								setForm(formVazio());
								setError(null);
							}}
							className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-sm font-medium text-voia-neutral-700 hover:bg-(--color-surface)"
						>
							Cancelar
						</button>
					</div>
				</div>
			)}

			{!criando && error && <p className="text-sm text-voia-danger">{error}</p>}
			{!rdos && <p className="text-sm text-voia-neutral-500">Carregando…</p>}
			{rdos && rdos.length === 0 && <p className="text-sm text-voia-neutral-500">Nenhum registro de diário de obra ainda.</p>}

			{rdos && rdos.length > 0 && (
				<ul className="space-y-2">
					{rdos.map((rdo) => (
						<li key={rdo.id} className="rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<button
								type="button"
								onClick={() => setAbertoId(abertoId === rdo.id ? null : rdo.id)}
								className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
							>
								<span className="font-medium text-voia-neutral-900">{formatarData(rdo.data)}</span>
								<span className="text-xs text-voia-neutral-500">{rdo.criado_por_nome ?? "—"}</span>
							</button>
							{abertoId === rdo.id && (
								<div className="mt-3 space-y-2 text-sm text-voia-neutral-700">
									{rdo.condicoes_climaticas && (
										<p>
											<span className="font-medium text-voia-neutral-900">Clima:</span> {rdo.condicoes_climaticas}
										</p>
									)}
									{rdo.mao_de_obra && (
										<p>
											<span className="font-medium text-voia-neutral-900">Mão de obra:</span> {rdo.mao_de_obra}
										</p>
									)}
									{rdo.servicos_executados && (
										<p>
											<span className="font-medium text-voia-neutral-900">Serviços executados:</span> {rdo.servicos_executados}
										</p>
									)}
									{rdo.equipamentos && (
										<p>
											<span className="font-medium text-voia-neutral-900">Equipamentos:</span> {rdo.equipamentos}
										</p>
									)}
									{rdo.materiais && (
										<p>
											<span className="font-medium text-voia-neutral-900">Materiais:</span> {rdo.materiais}
										</p>
									)}
									{rdo.ocorrencias && (
										<p>
											<span className="font-medium text-voia-neutral-900">Ocorrências do dia:</span> {rdo.ocorrencias}
										</p>
									)}
									{rdo.observacoes && (
										<p>
											<span className="font-medium text-voia-neutral-900">Observações:</span> {rdo.observacoes}
										</p>
									)}
								</div>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

import { useEffect, useState } from "react";

interface HealthResponse {
	status: "ok" | "degraded" | "error";
	api: "ok";
	database: {
		binding: boolean;
		connected: boolean;
		migrationApplied: boolean;
	};
	timestamp: string;
}

type CheckState = "checking" | "ok" | "fail";

function StatusBadge({ state }: { state: CheckState }) {
	const label = { checking: "Verificando…", ok: "OK", fail: "Falhou" }[state];
	const classes = {
		checking: "bg-voia-neutral-100 text-voia-neutral-700",
		ok: "bg-voia-success/15 text-voia-success",
		fail: "bg-voia-danger/15 text-voia-danger",
	}[state];

	return (
		<span className={`rounded-control px-2.5 py-1 text-sm font-medium ${classes}`}>
			{label}
		</span>
	);
}

function CheckRow({ label, state }: { label: string; state: CheckState }) {
	return (
		<div className="flex items-center justify-between border-b border-voia-neutral-100 py-3 last:border-b-0">
			<span className="text-voia-neutral-900">{label}</span>
			<StatusBadge state={state} />
		</div>
	);
}

export default function InfraCheck() {
	const [apiState, setApiState] = useState<CheckState>("checking");
	const [dbState, setDbState] = useState<CheckState>("checking");
	const [migrationState, setMigrationState] = useState<CheckState>("checking");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		fetch("/api/health")
			.then(async (res) => {
				const data = (await res.json()) as HealthResponse;
				if (cancelled) return;

				setApiState(data.api === "ok" ? "ok" : "fail");
				setDbState(data.database.connected ? "ok" : "fail");
				setMigrationState(data.database.migrationApplied ? "ok" : "fail");
			})
			.catch(() => {
				if (cancelled) return;
				setApiState("fail");
				setDbState("fail");
				setMigrationState("fail");
				setError("Não foi possível contatar a API (/api/health).");
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<main className="flex min-h-screen items-center justify-center p-(--space-page)">
			<div className="w-full max-w-md rounded-card bg-white p-(--space-card) shadow-card">
				<h1 className="font-display text-2xl text-voia-green-900">VOIA</h1>
				<p className="mt-1 text-sm text-voia-neutral-700">
					Verificação de infraestrutura — Etapa A (fundação)
				</p>

				<div className="mt-6">
					<CheckRow label="Frontend" state="ok" />
					<CheckRow label="Worker / API" state={apiState} />
					<CheckRow label="Banco de dados (D1)" state={dbState} />
					<CheckRow label="Migration aplicada" state={migrationState} />
				</div>

				{error && <p className="mt-4 text-sm text-voia-danger">{error}</p>}

				<p className="mt-6 text-xs text-voia-neutral-500">
					Esta é uma tela temporária de verificação técnica, não o produto final.
				</p>
			</div>
		</main>
	);
}

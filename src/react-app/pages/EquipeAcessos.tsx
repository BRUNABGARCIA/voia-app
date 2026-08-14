import { useEffect, useState } from "react";
import EditarUsuarioModal from "../components/EditarUsuarioModal";
import NovoUsuarioModal from "../components/NovoUsuarioModal";

export interface Usuario {
	id: number;
	nome: string;
	email: string;
	perfil: string;
	ativo: number | boolean;
	ultimo_login_em: string | null;
	criado_em: string;
}

const PERFIL_LABEL: Record<string, string> = {
	administrador: "Administrador",
	gestor: "Gestor",
	colaborador: "Colaborador",
	visualizador: "Visualizador",
	engenheiro: "Engenheiro",
	financeiro: "Financeiro",
};

function formatarData(valor: string | null): string {
	if (!valor) return "Nunca";
	const data = new Date(valor.includes("T") ? valor : `${valor.replace(" ", "T")}Z`);
	if (Number.isNaN(data.getTime())) return "—";
	return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function EquipeAcessos() {
	const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [editando, setEditando] = useState<Usuario | null>(null);
	const [criando, setCriando] = useState(false);
	const [sucesso, setSucesso] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		fetch("/api/usuarios", { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("não foi possível carregar a equipe");
				return res.json() as Promise<{ usuarios: Usuario[] }>;
			})
			.then((data) => {
				if (!cancelled) setUsuarios(data.usuarios);
			})
			.catch(() => {
				if (!cancelled) setError("Não foi possível carregar a equipe.");
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!sucesso) return;
		const timer = setTimeout(() => setSucesso(null), 4000);
		return () => clearTimeout(timer);
	}, [sucesso]);

	function handleSaved(atualizado: Usuario) {
		setUsuarios((atual) => atual?.map((u) => (u.id === atualizado.id ? atualizado : u)) ?? atual);
		setEditando(null);
	}

	function handleCreated(criado: Usuario) {
		setUsuarios((atual) =>
			[...(atual ?? []), criado].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
		);
		setCriando(false);
		setSucesso(`Usuário "${criado.nome}" criado com sucesso.`);
	}

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-display text-2xl font-light text-voia-neutral-900">Equipe e Acessos</h1>
					<p className="mt-1 text-sm text-voia-neutral-700">Gerencie quem pode acessar e operar o VOIA.</p>
				</div>
				<button
					type="button"
					onClick={() => setCriando(true)}
					className="rounded-control bg-voia-gold-500 px-4 py-2 text-sm font-medium text-voia-green-950 transition-colors hover:bg-voia-gold-400"
				>
					+ Novo usuário
				</button>
			</div>

			{sucesso && (
				<p className="mt-4 rounded-control bg-voia-success/15 px-3 py-2 text-sm text-voia-success">{sucesso}</p>
			)}
			{error && <p className="mt-6 text-sm text-voia-danger">{error}</p>}

			{!error && !usuarios && <p className="mt-6 text-sm text-voia-neutral-500">Carregando…</p>}

			{usuarios && (
				<div className="mt-6 overflow-x-auto rounded-card border border-voia-neutral-100 bg-(--color-surface) shadow-card">
					<table className="w-full min-w-[720px] text-left text-sm">
						<thead>
							<tr className="border-b border-voia-neutral-100 text-xs uppercase tracking-wide text-voia-neutral-500">
								<th className="px-4 py-3 font-medium">Nome</th>
								<th className="px-4 py-3 font-medium">E-mail</th>
								<th className="px-4 py-3 font-medium">Perfil</th>
								<th className="px-4 py-3 font-medium">Status</th>
								<th className="px-4 py-3 font-medium">Último acesso</th>
								<th className="px-4 py-3 font-medium">Criado em</th>
								<th className="px-4 py-3 font-medium">Ações</th>
							</tr>
						</thead>
						<tbody>
							{usuarios.map((u) => (
								<tr key={u.id} className="border-b border-voia-neutral-100 last:border-b-0">
									<td className="px-4 py-3 font-medium text-voia-neutral-900">{u.nome}</td>
									<td className="px-4 py-3 text-voia-neutral-700">{u.email}</td>
									<td className="px-4 py-3 text-voia-neutral-700">{PERFIL_LABEL[u.perfil] ?? u.perfil}</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-control px-2 py-1 text-xs font-medium ${
												u.ativo ? "bg-voia-success/15 text-voia-success" : "bg-voia-neutral-100 text-voia-neutral-500"
											}`}
										>
											{u.ativo ? "Ativo" : "Inativo"}
										</span>
									</td>
									<td className="px-4 py-3 text-voia-neutral-700">{formatarData(u.ultimo_login_em)}</td>
									<td className="px-4 py-3 text-voia-neutral-700">{formatarData(u.criado_em)}</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => setEditando(u)}
											className="rounded-control border border-voia-neutral-100 px-3 py-1.5 text-xs font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
										>
											Editar
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{editando && (
				<EditarUsuarioModal usuario={editando} onClose={() => setEditando(null)} onSaved={handleSaved} />
			)}

			{criando && <NovoUsuarioModal onClose={() => setCriando(false)} onCreated={handleCreated} />}
		</div>
	);
}

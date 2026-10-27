import { mensagemEtapas } from '../../shared/situacao-etapas';
import AssistenteVoia from '../components/AssistenteVoia';
import { FASE_COMERCIAL_LABEL } from '../../shared/operacao-voia';
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../contexts/useAuth";
import ProjetoModal from "../components/ProjetoModal";
import ProjetoEquipePanel from "../components/ProjetoEquipePanel";
import ProjetoFinanceiroPanel from "../components/ProjetoFinanceiroPanel";
import CronogramaPanel from "../components/CronogramaPanel";
import ProjetoEdicaoInline from "../components/ProjetoEdicaoInline";
import ProjetoProximosPassos from "../components/ProjetoProximosPassos";
import AndamentoPanel from "../components/AndamentoPanel";
import DocumentosPanel from "../components/DocumentosPanel";
import { localProjeto } from '../lib/local-projeto';
import ProgressoBar from "../components/ProgressoBar";
import Tabs from "../components/Tabs";
import {
	PRIORIDADE_BADGE,
	PRIORIDADE_LABEL,
	STATUS_ETAPA_BADGE,
	STATUS_ETAPA_LABEL,
	STATUS_PROJETO_BADGE,
	STATUS_PROJETO_LABEL,
	formatarData,
	formatarMoeda,
	projetoAtrasado,
	type Projeto,
	type ResumoOperacional,
	type TipoServico,
} from "../lib/projeto-tipos";

const PERFIS_QUE_EDITAM = ["administrador", "gestor", "colaborador"];
const PERFIS_QUE_GERENCIAM_EQUIPE = ["administrador", "gestor"];
const PERFIS_QUE_EXCLUEM_ETAPA = ["administrador", "gestor"];

const ABAS = [
	{ key: "visao-geral", label: "Visão Geral" },
	{ key: "cronograma", label: "Cronograma" },
	{ key: "documentos", label: "Documentos" },
	{ key: "andamento", label: "Andamento" },
];

function linha(label: string, valor: string | null | undefined) {
	return (
		<div>
			<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">{label}</span>
			<span className="text-sm text-voia-neutral-900">{valor || "—"}</span>
		</div>
	);
}

export default function ProjetoWorkspace() {
	const { id } = useParams<{ id: string }>();
	const { user } = useAuth();
	const navigate = useNavigate();

	const [projeto, setProjeto] = useState<Projeto | null>(null);
	const [tiposServico, setTiposServico] = useState<TipoServico[]>([]);
	const [resumo, setResumo] = useState<ResumoOperacional | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [aba, setAba] = useState("visao-geral");
	const [revisao,setRevisao]=useState(0);
	const [cancelando, setCancelando] = useState(false);
	const [editando, setEditando] = useState(false);
	const [inline,setInline]=useState(false),[feedback,setFeedback]=useState('');
	const [financeiro,setFinanceiro]=useState(false);

	const podeEditar = user ? PERFIS_QUE_EDITAM.includes(user.perfil) : false;
	const podeGerenciarEquipe = user ? PERFIS_QUE_GERENCIAM_EQUIPE.includes(user.perfil) : false;
	const podeExcluirEtapa = user ? PERFIS_QUE_EXCLUEM_ETAPA.includes(user.perfil) : false;

	const carregar = useCallback(() => {
		fetch(`/api/projetos/${id}`, { credentials: "same-origin" })
			.then((res) => {
				if (!res.ok) throw new Error("projeto não encontrado");
				return res.json() as Promise<{ projeto: Projeto; tiposServico: TipoServico[]; resumoOperacional: ResumoOperacional }>;
			})
			.then((data) => {
				setProjeto(data.projeto);
				setTiposServico(data.tiposServico);
				setResumo(data.resumoOperacional);
			})
			.catch(() => setError("Não foi possível carregar este projeto."));
	}, [id]);

	// Carrega no primeiro acesso e sempre que o usuário volta para a Visão
	// Geral — mantém "etapa atual"/"tarefas atrasadas"/"próximo prazo" em dia
	// sem ficar refazendo essa consulta enquanto a pessoa trabalha nas
	// outras abas (Etapas e Tarefas já tem sua própria atualização).
	useEffect(() => {
		if (aba === "visao-geral") carregar();
	}, [aba, carregar]);

	function handleSaved(atualizado: Projeto) {
		setProjeto(atualizado);
		carregar(); // recarrega tiposServico (nomes) refletindo a edição
		setEditando(false);
	}

	// Etapas é quem manda no progresso — quando a aba Etapas recalcula (criar,
	// editar, mudar status, excluir etapa), reflete aqui sem precisar recarregar
	// o projeto inteiro.


	if (error) {
		return <p className="text-sm text-voia-danger">{error}</p>;
	}

	if (!projeto) {
		return <p className="text-sm text-voia-neutral-500">Carregando…</p>;
	}

	async function cancelarCadastro() {
    if (!window.confirm('Cancelar este projeto criado por engano? O projeto sairá do andamento ativo. Cliente, tarefas, etapas, documentos, obras, financeiro e histórico serão preservados; nenhum registro será excluído.')) return;
    setCancelando(true);
    try {
      const res = await fetch(`/api/projetos/${projeto!.id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelado' }) });
      if (!res.ok) throw new Error('Não foi possível cancelar o projeto.');
      carregar();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível cancelar.'); }
    finally { setCancelando(false); }
  }
  const local = localProjeto(projeto);
	const atrasado = projetoAtrasado(projeto);

	return (
		<div className="projeto-workspace">
			<button
				type="button"
				onClick={() => navigate("/projetos")}
				className="text-sm font-medium text-voia-neutral-500 hover:text-voia-neutral-900"
			>
				← Projetos
			</button>

			<div className="project-header mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="font-display text-2xl font-semibold tracking-tight text-voia-neutral-900 break-words sm:text-3xl">
							{projeto.codigo && <span className="mb-2 block font-mono text-[11px] font-medium tracking-[0.14em] text-voia-neutral-500">{projeto.codigo}</span>}
							{projeto.nome}
						</h1>
						<span className={`rounded-control px-2 py-1 text-xs font-medium ${STATUS_PROJETO_BADGE[projeto.status]}`}>
							{STATUS_PROJETO_LABEL[projeto.status]}
						</span>
						<span
							className={`rounded-control px-2 py-1 text-xs font-medium ${PRIORIDADE_BADGE[projeto.prioridade]}`}
						>
							{PRIORIDADE_LABEL[projeto.prioridade]}
						</span>
					</div>
					<p className="mt-1 text-sm text-voia-neutral-700">
						Cliente:{" "}
						<Link to={`/clientes/${projeto.cliente_id}`} className="font-medium text-voia-green-800 hover:underline">
							{projeto.cliente_nome}
						</Link>
					</p><p className="mt-1 text-xs text-neutral-500">{[local.local,projeto.cidade,projeto.estado].filter(Boolean).join(' · ')}</p>
				</div>
				{podeEditar && (
					<button
						type="button"
						onClick={() => {setAba("visao-geral");setInline(true);setFeedback('');}}
						className="rounded-control border border-voia-neutral-100 px-4 py-2 text-sm font-medium text-voia-neutral-700 hover:bg-voia-beige-100"
					>
						Editar informações
					</button>
				)}
			</div>

      {podeGerenciarEquipe && <AssistenteVoia projetoId={projeto.id} onSaved={()=>{carregar();setRevisao(r=>r+1);}}/>}
      <div className="project-metrics" aria-label="Resumo executivo">
        <div><span>Fase comercial</span><strong>{projeto.fase_comercial?FASE_COMERCIAL_LABEL[projeto.fase_comercial]:'Não informada'}</strong></div>
        {user?.perfil!=='colaborador'&&projeto.valor_contratado!=null&&<div><span>Valor contratado</span><strong>{formatarMoeda(projeto.valor_contratado)}</strong></div>}
        {resumo?.proximoPrazo&&<div><span>Próximo prazo</span><strong>{formatarData(resumo.proximoPrazo)}</strong></div>}
        <div><span>Progresso</span><strong>{projeto.progresso}%</strong><div className="mt-2 w-24"><ProgressoBar valor={projeto.progresso}/></div></div>
        <details className="project-overflow"><summary aria-label="Ações do projeto">⋯</summary><div>{podeEditar&&<button onClick={()=>setEditando(true)}>Edição completa</button>}{podeGerenciarEquipe&&projeto.status!=='cancelado'&&<button disabled={cancelando} onClick={cancelarCadastro} className="text-red-700">Cancelar cadastro criado por engano</button>}</div></details>
      </div>
      <div className="project-tabs mt-4"><Tabs abas={ABAS} ativa={aba} onChange={setAba} />
			</div>

			{aba === "visao-geral" && (
				<div className="project-overview mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {feedback&&<p role="status" className="text-sm text-emerald-700 lg:col-span-2">{feedback}</p>}
          {inline&&podeEditar&&<section className="voia-panel lg:col-span-2"><h2>Informações do projeto</h2><ProjetoEdicaoInline projeto={projeto} comercial={podeGerenciarEquipe} onCancel={()=>setInline(false)} onSaved={()=>{setInline(false);setFeedback('Informações salvas.');carregar();}}/></section>}
					<div className="project-info rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
						<span className="voia-eyebrow">Informações do projeto</span><h2 className="font-display text-lg text-voia-green-900">Gestão</h2>
						<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
							{linha("Responsável", projeto.gerente_nome)}
							{user?.perfil !== "colaborador" && linha("Valor contratado", formatarMoeda(projeto.valor_contratado))}
							{linha("Data de início", formatarData(projeto.data_inicio))}
							<div>
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">Prazo</span>
								<span className="text-sm text-voia-neutral-900">
									{formatarData(projeto.prazo_previsto)}
									{atrasado && (
										<span className="ml-2 rounded-control bg-voia-danger/15 px-2 py-0.5 text-xs font-medium text-voia-danger">
											Atrasado
										</span>
									)}
								</span>
							</div>
						</div>
						{tiposServico.length > 0 && (
							<div className="mt-4">
								<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
									Tipos de serviço
								</span>
								<div className="mt-1 flex flex-wrap gap-1.5">
									{tiposServico.map((tipo) => (
										<span
											key={tipo.id}
											className="rounded-control bg-voia-beige-100 px-2 py-1 text-xs font-medium text-voia-neutral-700"
										>
											{tipo.nome}
										</span>
									))}
								</div>
							</div>
						)}
					</div>

					{resumo && (
						<div className="project-summary rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
							<h2 className="font-display text-lg text-voia-green-900">Andamento</h2>
							<div className="mt-4 space-y-3">
								<div>
									<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
										Etapa atual
									</span>
									{resumo.etapaAtual ? (
										<div className="mt-1 flex flex-wrap items-center gap-2">
											<span className="text-sm text-voia-neutral-900">{resumo.etapaAtual.nome}</span>
											<span
												className={`rounded-control px-2 py-0.5 text-xs font-medium ${STATUS_ETAPA_BADGE[resumo.etapaAtual.status]}`}
											>
												{STATUS_ETAPA_LABEL[resumo.etapaAtual.status]}
											</span>
											{resumo.etapaAtual.data_fim_prevista && (
												<span className="text-xs text-voia-neutral-500">
													Prazo: {formatarData(resumo.etapaAtual.data_fim_prevista)}
												</span>
											)}
										</div>
									) : (
										<p className="mt-1 text-sm text-voia-neutral-500">{mensagemEtapas(resumo.totalEtapas,resumo.etapasConcluidas)}</p>
									)}
								</div>
								{resumo.tarefasAtrasadas > 0 && (
									<p className="text-sm text-voia-danger">
										{resumo.tarefasAtrasadas}{" "}
										{resumo.tarefasAtrasadas === 1 ? "tarefa atrasada" : "tarefas atrasadas"}
									</p>
								)}
								{resumo.proximoPrazo && (
									<div>
										<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
											Próximo prazo
										</span>
										<span className="text-sm text-voia-neutral-900">{formatarData(resumo.proximoPrazo)}</span>
									</div>
								)}
							</div>
						</div>
					)}

					<div className="project-location rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card">
						<h2 className="font-display text-lg text-voia-green-900">Local do serviço</h2>
						<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
							{linha("Local/Condomínio", local.local || "Não informado")}
                {linha("Endereço completo", local.endereco || 'Não informado — pendente')}
                {linha("Cidade", projeto.cidade || "Não informada")}
                {linha("UF", projeto.estado || "Não informada")}
							{linha("Complemento", projeto.complemento)}
							{linha("CEP", projeto.cep || "Não informado")}
						</div>
					</div>

					{(projeto.descricao || projeto.observacoes) && (
						<div className="project-notes rounded-card border border-voia-neutral-100 bg-(--color-surface) p-(--space-card) shadow-card lg:col-span-2">
							{projeto.descricao && (
								<div>
									<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
										Descrição
									</span>
									<p className="mt-1 whitespace-pre-wrap text-sm text-voia-neutral-900">{projeto.descricao}</p>
								</div>
							)}
							{projeto.observacoes && (
								<div className={projeto.descricao ? "mt-4" : ""}>
									<span className="block text-xs font-medium uppercase tracking-wide text-voia-neutral-500">
										Observações
									</span>
									<p className="mt-1 whitespace-pre-wrap text-sm text-voia-neutral-900">{projeto.observacoes}</p>
								</div>
							)}
						</div>
					)}
          <ProjetoProximosPassos key={revisao} projetoId={projeto.id} abrirCronograma={()=>setAba('cronograma')}/>
          <section className="project-team lg:col-span-2" aria-label="Equipe do projeto"><div className="project-section-title"><span className="voia-eyebrow">Pessoas e responsabilidades</span><h2>Equipe</h2></div><ProjetoEquipePanel projetoId={projeto.id} gerenteId={projeto.gerente_id} gerenteNome={projeto.gerente_nome} podeGerenciar={podeGerenciarEquipe} onResponsavelAlterado={handleSaved}/></section>
          {podeGerenciarEquipe&&<details className="voia-panel lg:col-span-2" onToggle={e=>setFinanceiro(e.currentTarget.open)}><summary className="cursor-pointer text-sm font-semibold">Comercial · Remuneração de parceiros</summary>{financeiro&&<ProjetoFinanceiroPanel projetoId={projeto.id}/>}</details>}


				</div>
			)}

      {aba === "cronograma" && <CronogramaPanel key={revisao} projetoId={projeto.id} podeEditar={podeEditar} podeExcluir={podeExcluirEtapa} onSaved={carregar}/>}

			{aba === "documentos" && (
				<DocumentosPanel key={revisao} projetoId={projeto.id} podeEditar={podeEditar} podeExcluir={podeExcluirEtapa} />
			)}

			{aba === "andamento" && <AndamentoPanel key={revisao} projetoId={projeto.id} podeEditar={podeEditar} />}

			{editando && (
				<ProjetoModal
					projeto={projeto}
					tiposServicoAtuais={tiposServico}
					onClose={() => setEditando(false)}
					onSaved={handleSaved}
				/>
			)}
		</div>
	);
}
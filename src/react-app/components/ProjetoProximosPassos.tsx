import { useEffect, useState } from 'react';
import { ordenarAtividades } from '../lib/cronograma-projeto';
import { formatarData, type Tarefa } from '../lib/projeto-tipos';

export default function ProjetoProximosPassos({projetoId,abrirCronograma}:{projetoId:number;abrirCronograma:()=>void}) {
  const [tarefas,setTarefas]=useState<Tarefa[]|null>(null),[erro,setErro]=useState(false);
  useEffect(()=>{let ativo=true;fetch(`/api/projetos/${projetoId}/tarefas`,{credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(ativo)setTarefas(d.tarefas||[]);}).catch(()=>{if(ativo)setErro(true);});return()=>{ativo=false;};},[projetoId]);
  const abertas=(tarefas||[]).filter(t=>t.status!=='concluida'&&t.status!=='cancelada'),proximas=ordenarAtividades(abertas).slice(0,3),validas=(tarefas||[]).filter(t=>t.status!=='cancelada');
  return <section className="project-next voia-panel"><div className="flex flex-wrap items-start justify-between gap-2"><div><span className="voia-eyebrow">Execução</span><h2>Próximos passos</h2></div><button onClick={abrirCronograma} className="voia-text-btn">Ver cronograma →</button></div>{erro?<p className="voia-empty">Não foi possível carregar as próximas atividades.</p>:!tarefas?<p className="voia-empty">Carregando atividades…</p>:<><p className="my-3 text-xs text-neutral-500">{validas.filter(t=>t.status==='concluida').length} / {validas.length} tarefas concluídas</p>{!proximas.length?<p className="voia-empty">Nenhuma atividade pendente.</p>:<ol className="divide-y divide-neutral-100">{proximas.map(t=><li key={t.id} className="flex items-start justify-between gap-3 py-3 text-sm"><span className="min-w-0 break-words font-medium">{t.nome}<span className="mt-1 block text-xs font-normal text-neutral-500">{t.responsavel_nome||'Sem responsável'}</span></span><span className="shrink-0 text-xs text-neutral-500">{t.prazo?formatarData(t.prazo):'A agendar'}</span></li>)}</ol>}</>}</section>;
}

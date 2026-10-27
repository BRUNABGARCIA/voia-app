import type { Etapa, Tarefa } from './projeto-tipos';
import { ordenarAtividades } from './cronograma-projeto';

export function diaIso(valor:string|null|undefined):number|null {
  if(!valor||!/^\d{4}-\d{2}-\d{2}$/.test(valor))return null;
  const n=Date.parse(valor+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===valor?n/86400000:null;
}
export function gruposCronograma(etapas:Etapa[],tarefas:Tarefa[]) {
  const ids=new Set(etapas.map(e=>e.id));
  const grupos=etapas.map(etapa=>{const ts=ordenarAtividades(tarefas.filter(t=>t.etapa_id===etapa.id));return {etapa,datadas:ts.filter(t=>t.prazo),semData:ts.filter(t=>!t.prazo),ordemData:etapa.data_inicio_prevista||etapa.data_fim_prevista||ts.find(t=>t.prazo)?.prazo||'9999'};}).sort((a,b)=>a.ordemData.localeCompare(b.ordemData)||a.etapa.ordem-b.etapa.ordem);
  const soltas=ordenarAtividades(tarefas.filter(t=>!t.etapa_id||!ids.has(t.etapa_id)));
  return {grupos,datadas:soltas.filter(t=>t.prazo),semData:soltas.filter(t=>!t.prazo)};
}
export interface LinhaGantt {chave:string;nome:string;tipo:'etapa'|'tarefa';etapaId:number|null;inicio:string|null;fim:string|null;status:string;atrasada:boolean;progresso:number|null}
export function linhasGantt(etapas:Etapa[],tarefas:Tarefa[]):LinhaGantt[] {
  const {grupos,datadas,semData}=gruposCronograma(etapas,tarefas);
  const tarefa=(t:Tarefa):LinhaGantt=>({chave:'t-'+t.id,nome:t.nome,tipo:'tarefa',etapaId:t.etapa_id,inicio:t.data_inicio||null,fim:t.prazo||null,status:t.status,atrasada:!!t.atrasada,progresso:t.status==='concluida'?100:null});
  return [...grupos.flatMap(g=>[{chave:'e-'+g.etapa.id,nome:g.etapa.nome,tipo:'etapa' as const,etapaId:g.etapa.id,inicio:g.etapa.data_inicio_prevista||null,fim:g.etapa.data_fim_prevista||null,status:g.etapa.status,atrasada:!!g.etapa.atrasada,progresso:g.etapa.tarefas_total>0?Math.round(g.etapa.tarefas_concluidas/g.etapa.tarefas_total*100):null},...[...g.datadas,...g.semData].map(tarefa)]),...datadas.map(tarefa),...semData.map(tarefa)];
}
export interface PontoProgresso {data:string;planejado:number;realizado:number|null}
export function progressoNoTempo(tarefas:Tarefa[],hoje:string):{pontos:PontoProgresso[];motivo:string|null;total:number} {
  const validas=tarefas.filter(t=>t.status!=='cancelada'),concluidas=validas.filter(t=>t.status==='concluida');
  if(!validas.length)return {pontos:[],motivo:'Nenhuma tarefa válida disponível para comparar as conclusões.',total:0};
  if(validas.some(t=>diaIso(t.prazo)===null))return {pontos:[],motivo:'Faltam prazos em tarefas. Complete o cronograma para comparar o percentual de conclusões previsto e registrado.',total:validas.length};
  if(!concluidas.length||concluidas.some(t=>diaIso(t.data_conclusao)===null||t.data_conclusao!>hoje))return {pontos:[],motivo:'Não há conclusões datadas suficientes e válidas para reconstruir o realizado.',total:validas.length};
  const datas=[...new Set([...validas.map(t=>t.prazo!),...concluidas.map(t=>t.data_conclusao!),hoje])].sort();
  const inicio=new Date((diaIso(datas[0])!-1)*86400000).toISOString().slice(0,10);
  return {total:validas.length,motivo:null,pontos:[inicio,...datas].map(data=>({data,planejado:validas.filter(t=>t.prazo!<=data).length/validas.length*100,realizado:data>hoje?null:concluidas.filter(t=>t.data_conclusao!<=data).length/validas.length*100}))};
}

// O financeiro atual é de remunerações do Projeto, sem associação inequívoca à Obra.
// Não ratear o contrato nem pagamentos de parceiros para fabricar uma curva de custo da Obra.
export const MOTIVO_FINANCEIRO_OBRA='Dados financeiros insuficientes para gerar a curva Valor × Tempo.';

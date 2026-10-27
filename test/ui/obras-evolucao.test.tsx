import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ObraFotosPanel from '../../src/react-app/components/ObraFotosPanel';
import ObraOcorrenciasPanel from '../../src/react-app/components/ObraOcorrenciasPanel';
import CronogramaPanel from '../../src/react-app/components/CronogramaPanel';
import ObraGantt from '../../src/react-app/components/ObraGantt';
import { diaIso, gruposCronograma, linhasGantt, progressoNoTempo } from '../../src/react-app/lib/cronograma-obra';
import type { Etapa, Tarefa } from '../../src/react-app/lib/projeto-tipos';

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const etapa={id:1,nome:'Briefing e Levantamento',ordem:1,status:'em_andamento',data_inicio_prevista:'2026-09-28',data_fim_prevista:'2026-10-01',tarefas_total:2,tarefas_concluidas:1} as Etapa;
const tarefa={id:1,nome:'Medição',etapa_id:1,status:'concluida',data_inicio:'2026-09-28',prazo:'2026-10-01',data_conclusao:'2026-09-30',descricao:null,responsavel_id:null} as Tarefa;
const resposta=(d:object,status=200)=>new Response(JSON.stringify(d),{status});
it('editar legenda faz apenas PATCH de metadados e não solicita confirmação ou upload',async()=>{
  let legenda='Fundação';const mock=vi.fn(async(_url:string,init?:RequestInit)=>{if(init?.method==='PATCH')legenda=JSON.parse(init.body as string).legenda;return resposta({fotos:[{id:2,obra_id:1,rdo_id:10,data:'2026-10-26',legenda}]});});vi.stubGlobal('fetch',mock);const confirm=vi.spyOn(window,'confirm');render(<ObraFotosPanel obraId={1} rdoId={10} podeExcluir podeEditar/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Editar foto Fundação'}));fireEvent.change(screen.getByLabelText('Legenda da foto'),{target:{value:'Legenda revisada'}});await user.click(screen.getByRole('button',{name:'Salvar legenda'}));await screen.findByText('Legenda revisada');const writes=mock.mock.calls.filter(([,i])=>i?.method);expect(writes).toHaveLength(1);expect(writes[0][0]).toBe('/api/obras/1/fotos/2?rdo_id=10');expect(JSON.parse(writes[0][1]!.body as string)).toEqual({legenda:'Legenda revisada'});expect(confirm).not.toHaveBeenCalled();
});
it('cancelar legenda não persiste; leitura não exibe lápis',async()=>{
  const mock=vi.fn(async()=>resposta({fotos:[{id:2,obra_id:1,rdo_id:10,data:'2026-10-26',legenda:'Original'}]}));vi.stubGlobal('fetch',mock);const user=userEvent.setup();const view=render(<ObraFotosPanel obraId={1} podeExcluir={false} podeEditar/>);await user.click(await screen.findByRole('button',{name:'Editar foto Original'}));fireEvent.change(screen.getByLabelText('Legenda da foto'),{target:{value:'Rascunho'}});await user.click(screen.getByRole('button',{name:'Cancelar edição'}));expect(mock.mock.calls).toHaveLength(1);view.unmount();render(<ObraFotosPanel obraId={1} podeExcluir={false} podeEditar={false}/>);await screen.findByText('Original');expect(screen.queryByTitle('Editar foto')).toBeNull();
});
it('edição de ocorrência permite campos reais sem enviar autor, status ou obra',async()=>{
  let titulo='Ocorrência inicial';const mock=vi.fn(async(url:string,init?:RequestInit)=>{if(init?.method){titulo=JSON.parse(init.body as string).titulo;return resposta({});}return resposta(url.endsWith('/ocorrencias')?{ocorrencias:[{id:8,titulo,descricao:'Descrição',categoria:'execucao',prioridade:'normal',status:'aberta',responsavel_id:null,prazo:null,criado_por_nome:'Autor original',criado_em:'2026-10-26'}]}:url.endsWith('/membros')?{membros:[{usuario_id:3,nome:'Membro'}]}:{obra:{projeto_id:7}});});vi.stubGlobal('fetch',mock);render(<ObraOcorrenciasPanel obraId={1} podeEditar/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Editar ocorrência Ocorrência inicial'}));fireEvent.change(screen.getByLabelText('Título da ocorrência'),{target:{value:'Título corrigido'}});await user.click(screen.getByRole('button',{name:'Salvar ocorrência'}));await waitFor(()=>expect(screen.queryByRole('form',{name:'Editar ocorrência'})).toBeNull());const writes=mock.mock.calls.filter(([,i])=>i?.method);expect(JSON.parse(writes[0][1]!.body as string)).toEqual({titulo:'Título corrigido'});expect(screen.getByText(/Autor original/)).toBeTruthy();
});
it('Timeline da Obra integra período e tarefas por etapa sem duplicar bloco antigo',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>resposta(url.endsWith('/etapas')?{etapas:[etapa]}:{tarefas:[{...tarefa,id:2,nome:'Sem prazo',prazo:null},tarefa]})));render(<CronogramaPanel projetoId={7} obraId={1}/>);const grupo=await screen.findByRole('region',{name:'Etapa Briefing e Levantamento'});expect(within(grupo).getByText('28/09/2026 → 01/10/2026')).toBeTruthy();expect(within(grupo).getByRole('heading',{name:'Medição'})).toBeTruthy();const datadas=within(grupo).getByRole('list',{name:/Atividades com data/}),semData=within(grupo).getByRole('list',{name:/Atividades a agendar/});expect(datadas.compareDocumentPosition(semData)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(screen.queryByText('Períodos das etapas')).toBeNull();await userEvent.setup().click(screen.getByRole('button',{name:'Gantt'}));expect(await screen.findByLabelText('Gantt da Obra')).toBeTruthy();
});
it('modelo do Gantt usa datas reais, mantém hierarquia e não inventa prazo de tarefa',()=>{
  const linhas=linhasGantt([etapa],[tarefa,{...tarefa,id:2,nome:'A agendar',data_inicio:null,prazo:null}]);expect(linhas.map(l=>l.chave)).toEqual(['e-1','t-1','t-2']);expect(linhas[0]).toMatchObject({inicio:'2026-09-28',fim:'2026-10-01'});expect(linhas[2]).toMatchObject({inicio:null,fim:null});expect(gruposCronograma([etapa],[tarefa]).grupos[0].datadas[0].etapa_id).toBe(1);expect(diaIso('2026-02-31')).toBeNull();
});
it('Gantt reflete atualização das mesmas datas e status sem escrita',()=>{
  const mock=vi.fn();vi.stubGlobal('fetch',mock);const view=render(<ObraGantt etapas={[etapa]} tarefas={[tarefa]}/>);expect(screen.getByRole('img',{name:/Medição · 28\/09\/2026 → 01\/10\/2026/})).toBeTruthy();view.rerender(<ObraGantt etapas={[etapa]} tarefas={[{...tarefa,prazo:'2026-10-05',status:'pendente'}]}/>);expect(screen.getByRole('img',{name:/Medição · 28\/09\/2026 → 05\/10\/2026.*Pendente/})).toBeTruthy();expect(mock).not.toHaveBeenCalled();
});
it('Valor × Tempo mostra insuficiência e nunca rateia valores por tarefas',async()=>{
  render(<ObraGantt etapas={[etapa]} tarefas={[tarefa]}/>);await userEvent.setup().click(screen.getByRole('button',{name:'Valor × Tempo'}));expect(screen.getByText('Dados financeiros insuficientes para gerar a curva Valor × Tempo.')).toBeTruthy();expect(screen.queryByRole('img')).toBeNull();
});
it('Progresso × Tempo não fabrica realizado quando faltam conclusões datadas',async()=>{
  render(<ObraGantt etapas={[]} tarefas={[{...tarefa,status:'pendente',data_conclusao:null}]}/>);await userEvent.setup().click(screen.getByRole('button',{name:'Progresso × Tempo'}));expect(screen.getByText(/Não há conclusões datadas suficientes/)).toBeTruthy();expect(screen.queryByRole('img',{name:/Curvas/})).toBeNull();
});
it('curva de conclusões compara previsto e registrado, sem projetar realizado no futuro',()=>{
  const r=progressoNoTempo([tarefa,{...tarefa,id:2,status:'pendente',prazo:'2026-11-01',data_conclusao:null}],'2026-10-26');expect(r.motivo).toBeNull();expect(r.pontos.find(p=>p.data==='2026-10-26')).toMatchObject({planejado:50,realizado:50});expect(r.pontos.find(p=>p.data==='2026-11-01')).toMatchObject({planejado:100,realizado:null});expect(progressoNoTempo([{...tarefa,prazo:null}],'2026-10-26').pontos).toEqual([]);
});
it('Gantt lista itens sem data fora da escala e usa seleção de escala leve',async()=>{
  render(<ObraGantt etapas={[]} tarefas={[{...tarefa,data_inicio:null,prazo:null,nome:'Sem data'}]}/>);expect(screen.getByText('A agendar / revisar período')).toBeTruthy();expect(screen.getByText(/Tarefa · Sem data/)).toBeTruthy();await userEvent.setup().selectOptions(screen.getByLabelText('Escala'),'trimestre');expect((screen.getByLabelText('Escala') as HTMLSelectElement).value).toBe('trimestre');
});

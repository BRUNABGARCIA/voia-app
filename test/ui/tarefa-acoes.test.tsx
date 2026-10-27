import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CronogramaPanel from '../../src/react-app/components/CronogramaPanel';

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
function contexto(falha=false){let tarefas=[{id:1,nome:'Datada',status:'pendente',prazo:'2026-10-30',etapa_id:1},{id:2,nome:'A agendar',status:'pendente',prazo:null,etapa_id:null}];const mock=vi.fn(async(url:string,init?:RequestInit)=>{
  if(init?.method==='DELETE'){if(falha)return new Response(JSON.stringify({error:'Exclusão recusada'}),{status:403});tarefas=tarefas.filter(t=>!url.endsWith('/'+t.id));return new Response('{}');}
  if(init?.method==='PATCH'){const {status}=JSON.parse(init.body as string);tarefas=tarefas.map(t=>url.endsWith('/'+t.id)?{...t,status}:t);return new Response('{}');}
  return new Response(JSON.stringify(url.endsWith('/etapas')?{etapas:[]}:{tarefas}));
});vi.stubGlobal('fetch',mock);return mock;}
it('ações sempre visíveis em tarefas datadas e sem data, com SVG, title e sem menu',async()=>{
  const mock=contexto();render(<CronogramaPanel projetoId={4} podeEditar podeExcluir/>);await screen.findByRole('button',{name:'Editar tarefa Datada'});
  for(const nome of ['Datada','A agendar'])for(const acao of ['Editar tarefa','Excluir tarefa']){const button=screen.getByRole('button',{name:`${acao} ${nome}`});expect(button.getAttribute('title')).toBe(acao);expect(button.querySelector('svg')).toBeTruthy();expect(button.closest('details')).toBeNull();}
  expect(screen.getByLabelText('Status de Datada')).toBeTruthy();expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);
});
it('cancelar exclusão não escreve; confirmar remove somente a tarefa escolhida',async()=>{
  const mock=contexto(),confirm=vi.spyOn(window,'confirm').mockReturnValue(false);render(<CronogramaPanel projetoId={4} podeEditar podeExcluir/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Excluir tarefa Datada'}));expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);confirm.mockReturnValue(true);await user.click(screen.getByRole('button',{name:'Excluir tarefa Datada'}));await waitFor(()=>expect(screen.queryByRole('heading',{name:'Datada'})).toBeNull());expect(screen.getByRole('button',{name:'Excluir tarefa A agendar'})).toBeTruthy();expect(mock.mock.calls.filter(([,init])=>init?.method==='DELETE').map(([url])=>url)).toEqual(['/api/projetos/4/tarefas/1']);
});
it('erro de exclusão preserva tarefa e exibe falha',async()=>{
  contexto(true);vi.spyOn(window,'confirm').mockReturnValue(true);render(<CronogramaPanel projetoId={4} podeEditar podeExcluir/>);await userEvent.setup().click(await screen.findByRole('button',{name:'Excluir tarefa Datada'}));expect((await screen.findByRole('alert')).textContent).toContain('Exclusão recusada');expect(screen.getByRole('heading',{name:'Datada'})).toBeTruthy();
});
it('alteração de status mantém o contrato PATCH somente de status',async()=>{
  const mock=contexto();render(<CronogramaPanel projetoId={4} podeEditar/>);await userEvent.setup().selectOptions(await screen.findByLabelText('Status de Datada'),'concluida');await screen.findByRole('status');const patches=mock.mock.calls.filter(([,init])=>init?.method==='PATCH');expect(patches).toHaveLength(1);expect(JSON.parse(patches[0][1]!.body as string)).toEqual({status:'concluida'});expect(screen.queryByTitle('Excluir tarefa')).toBeNull();
});
it('somente leitura não oferece edição, exclusão ou seletor de status',async()=>{
  contexto();render(<CronogramaPanel projetoId={4}/>);await screen.findByRole('heading',{name:'Datada'});expect(screen.queryByTitle('Editar tarefa')).toBeNull();expect(screen.queryByTitle('Excluir tarefa')).toBeNull();expect(screen.queryByLabelText('Status de Datada')).toBeNull();
});

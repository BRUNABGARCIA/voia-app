import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../../src/react-app/contexts/auth-context';
import ProjetoWorkspace from '../../src/react-app/pages/ProjetoWorkspace';
import CronogramaPanel from '../../src/react-app/components/CronogramaPanel';
import TarefaEdicaoInline from '../../src/react-app/components/TarefaEdicaoInline';
import TarefaModal from '../../src/react-app/components/TarefaModal';
import ProjetoEdicaoInline from '../../src/react-app/components/ProjetoEdicaoInline';
import type { Projeto, Tarefa } from '../../src/react-app/lib/projeto-tipos';

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const projeto={id:4,codigo:'PRJ-2026-0004',nome:'Projeto sintético',cliente_id:2,cliente_nome:'Cliente sintético',status:'em_andamento',fase_comercial:null,prioridade:'normal',progresso:0,valor_contratado:null,gerente_id:null,gerente_nome:null,descricao:null,data_inicio:null,prazo_previsto:null} as Projeto;
const tarefa={id:1,nome:'Vistoria inicial',status:'pendente',prazo:'2026-10-15',responsavel_id:null,responsavel_nome:null,descricao:'Horário: 09:00.',etapa_id:null} as Tarefa;
const membros=[{usuario_id:7,nome:'Membro válido',funcao:'fiscal',perfil:'colaborador'}];
const resposta=(d:object,status=200)=>new Response(JSON.stringify(d),{status});
function mockContexto(){const mock=vi.fn(async(url:string,init?:RequestInit)=>{if(init?.method)return resposta({});if(url.endsWith('/membros'))return resposta({membros});if(url==='/api/usuarios/opcoes')return resposta({usuarios:[{id:7,nome:'Membro válido'},{id:8,nome:'Fora da equipe'}]});if(url.endsWith('/tarefas'))return resposta({tarefas:[tarefa,{...tarefa,id:2,nome:'Vistoria final',prazo:null}]});if(url.endsWith('/etapas'))return resposta({etapas:[]});return resposta({projeto,tiposServico:[],resumoOperacional:{totalEtapas:0,etapasConcluidas:0,etapaAtual:null,tarefasAtrasadas:0,proximoPrazo:null}});});vi.stubGlobal('fetch',mock);return mock;}
function workspace(perfil='administrador'){render(<AuthContext.Provider value={{user:{id:1,nome:'Bruna',email:'sintetico@voia.local',perfil},loading:false,login:async()=>{},logout:async()=>{}}}><MemoryRouter initialEntries={['/projetos/4']}><Routes><Route path="/projetos/:id" element={<ProjetoWorkspace/>}/></Routes></MemoryRouter></AuthContext.Provider>);}
it('quatro abas, equipe na visão geral e carregamento somente de leitura',async()=>{
  const mock=mockContexto();workspace();await screen.findByRole('heading',{name:/Projeto sintético/});await screen.findByText('Membro válido');
  for(const nome of ['Visão Geral','Cronograma','Documentos','Andamento'])expect(screen.getByRole('button',{name:nome})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Equipe'})).toBeNull();expect(screen.queryByRole('button',{name:'Etapas e Tarefas'})).toBeNull();expect(screen.getByRole('region',{name:'Equipe do projeto'})).toBeTruthy();expect(within(screen.getByLabelText('Resumo executivo')).getByText('Não informada')).toBeTruthy();expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);
});
it('editar projeto abre formulário inline; cancelar não persiste',async()=>{
  const mock=mockContexto();workspace();const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Editar informações'}));const form=screen.getByRole('form',{name:'Editar informações do projeto'});fireEvent.change(within(form).getByLabelText('Nome do projeto'),{target:{value:'Rascunho'}});await user.click(within(form).getByRole('button',{name:'Cancelar'}));expect(screen.queryByRole('form')).toBeNull();expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);
});
it('salvar inline envia somente campos alterados sem mudar fase legada/cliente/endereço',async()=>{
  const mock=mockContexto(),salvo=vi.fn();render(<ProjetoEdicaoInline projeto={projeto} comercial onSaved={salvo} onCancel={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Nome do projeto'),{target:{value:'Nome revisado'}});await userEvent.setup().click(screen.getByRole('button',{name:'Salvar informações'}));await waitFor(()=>expect(salvo).toHaveBeenCalled());const posts=mock.mock.calls.filter(([,init])=>init?.method);expect(posts).toHaveLength(1);expect(JSON.parse(posts[0][1]!.body as string)).toEqual({nome:'Nome revisado'});
});
it('falha de salvamento mantém rascunho e mostra erro do backend',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>resposta({error:'Prazo inválido'},400)));render(<ProjetoEdicaoInline projeto={projeto} comercial onSaved={vi.fn()} onCancel={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Nome do projeto'),{target:{value:'Rascunho'}});await userEvent.setup().click(screen.getByRole('button',{name:'Salvar informações'}));expect((await screen.findByRole('alert')).textContent).toContain('Prazo inválido');expect((screen.getByLabelText('Nome do projeto') as HTMLInputElement).value).toBe('Rascunho');
});
it('cronograma permite editar e concluir na linha sem criar registros',async()=>{
  const mock=mockContexto();render(<CronogramaPanel projetoId={4} podeEditar/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Editar tarefa Vistoria inicial'}));await screen.findByRole('option',{name:'Membro válido'});expect(screen.queryByRole('option',{name:'Fora da equipe'})).toBeNull();await user.selectOptions(screen.getByLabelText('Situação'),'concluida');await user.click(screen.getByRole('button',{name:'Salvar tarefa'}));await screen.findByRole('status');const writes=mock.mock.calls.filter(([,init])=>init?.method);expect(writes).toHaveLength(1);expect(writes[0][0]).toBe('/api/projetos/4/tarefas/1');expect(JSON.parse(writes[0][1]!.body as string)).toEqual({status:'concluida'});
});
it('responsável anterior fora da equipe bloqueia salvar até escolha válida',async()=>{
  const mock=mockContexto();render(<TarefaEdicaoInline projetoId={4} tarefa={{...tarefa,responsavel_id:8,responsavel_nome:'Fora da equipe'}} onSaved={vi.fn()} onCancel={vi.fn()}/>);await screen.findByRole('option',{name:'Membro válido'});await userEvent.setup().click(screen.getByRole('button',{name:'Salvar tarefa'}));expect((await screen.findByRole('alert')).textContent).toContain('deve ser membro');expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);
});
it('nova tarefa não oferece gerente fora do membership nem cria nada ao cancelar',async()=>{
  const mock=vi.fn(async(url:string,init?:RequestInit)=>{if(init?.method)throw Error('Escrita indevida');return resposta(url==='/api/usuarios/opcoes'?{usuarios:[{id:7,nome:'Membro válido'},{id:8,nome:'Gerente sem vínculo'}]}:{projeto:{gerente_id:8},membros});});vi.stubGlobal('fetch',mock);const fechar=vi.fn();render(<TarefaModal projetoId={4} etapaId={null} tarefa={null} onClose={fechar} onSaved={vi.fn()}/>);await screen.findByRole('option',{name:'Membro válido'});expect(screen.queryByRole('option',{name:'Gerente sem vínculo'})).toBeNull();await userEvent.setup().click(screen.getByRole('button',{name:'Cancelar'}));expect(fechar).toHaveBeenCalled();expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);
});
it('cronograma oferece nova tarefa e gerenciar etapas; datadas antes de a agendar',async()=>{
  const mock=mockContexto();render(<CronogramaPanel projetoId={4} podeEditar/>);const datadas=await screen.findByRole('list',{name:'Atividades com data'}),semData=screen.getByRole('list',{name:'Atividades a agendar'});expect(datadas.compareDocumentPosition(semData)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(screen.getByText('Gerenciar etapas')).toBeTruthy();expect(screen.getByRole('button',{name:'+ Nova tarefa'})).toBeTruthy();expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);
});
it('parceiro não recebe gestão de equipe, Assistente ou dados comerciais',async()=>{
  mockContexto();workspace('colaborador');await screen.findByText('Membro válido');expect(screen.queryByRole('button',{name:'+ Adicionar membro'})).toBeNull();expect(screen.queryByText('Assistente VOIA')).toBeNull();expect(screen.queryByText('Comercial · Remuneração de parceiros')).toBeNull();
});

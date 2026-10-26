import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../../src/react-app/contexts/auth-context';
import ProjetoWorkspace from '../../src/react-app/pages/ProjetoWorkspace';
import PortalProcesso from '../../src/react-app/portal/PortalProcesso';
import DocumentosPanel from '../../src/react-app/components/DocumentosPanel';
import AssistenteVoia from '../../src/react-app/components/AssistenteVoia';
import { mensagemEtapas } from '../../src/shared/situacao-etapas';
import { localProjeto } from '../../src/react-app/lib/local-projeto';
import { interpretarAtualizacao } from '../../src/shared/assistente-voia';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const resposta=(d:object)=>new Response(JSON.stringify(d),{status:200});
const projeto={id:4,nome:'Projeto legado',status:'em_andamento',fase_comercial:null,prioridade:'normal',progresso:0,cliente_id:2,cliente_nome:'Cliente',observacoes:'Local: Condomínio Parque Chapada dos Campos',cidade:'Várzea Grande',estado:'MT',logradouro:null,numero:null,bairro:null,cep:null};
function auth(element:React.ReactNode,perfil='administrador'){return <AuthContext.Provider value={{user:{id:1,nome:'Bruna',email:'teste@voia.local',perfil},loading:false,login:async()=>{},logout:async()=>{}}}>{element}</AuthContext.Provider>;}
function workspace(){render(auth(<MemoryRouter initialEntries={['/projetos/4']}><Routes><Route path="/projetos/:id" element={<ProjetoWorkspace/>}/></Routes></MemoryRouter>));}

describe('mensagens de etapa sem conclusão presumida',()=>{
  it.each([[0,0,'Sem etapa definida.'],[0,5,'Sem etapa definida.'],[1,1,'Todas as etapas concluídas.'],[2,2,'Todas as etapas concluídas.'],[2,1,'Nenhuma etapa em andamento.'],[undefined,undefined,'Nenhuma etapa em andamento.']] as const)('total=%s, concluídas=%s', (total,concluidas,texto)=>expect(mensagemEtapas(total,concluidas)).toBe(texto));
  it.each([0,1])('portal com %s etapas exige conclusão real e não depende da existência de etapa atual',async(total)=>{
    const etapas=total?[{id:1,nome:'Concluída',status:'concluida',tarefas:[],ordem:1}]:[];
    vi.stubGlobal('fetch',vi.fn(async()=>resposta({processo:{id:4,nome:'Processo',status:'em_andamento',progresso:0,baseadoEm:'tarefas',totalEtapas:total,etapasConcluidas:total,totalTarefas:5,tarefasConcluidas:0,tiposServico:[]},etapaAtual:null,proximaEtapa:null,etapas,atualizacoes:[],documentos:[]})));
    render(<MemoryRouter initialEntries={['/portal/processos/4']}><Routes><Route path="/portal/processos/:id" element={<PortalProcesso/>}/></Routes></MemoryRouter>);
    expect(await screen.findByText(total?'Todas as etapas concluídas.':'Sem etapa definida.')).toBeTruthy();if(!total)expect(screen.queryByText('Todas as etapas concluídas.')).toBeNull();
  });
});

describe('Workspace de projeto legado e novo',()=>{
  it.each([null,'aprovada'] as const)('Admin visualiza Assistente com fase %s, abaixo do título e antes das abas',async(fase)=>{
    const fetchMock=vi.fn(async(url:string,init?:RequestInit)=>{if(url!=='/api/projetos/4'||init?.method)throw Error('Somente leitura do projeto é permitida neste teste');return resposta({projeto:{...projeto,fase_comercial:fase},tiposServico:[],resumoOperacional:{totalEtapas:0,etapasConcluidas:0,etapaAtual:null,tarefasAtrasadas:0,proximoPrazo:null}});});vi.stubGlobal('fetch',fetchMock);workspace();
    const titulo=await screen.findByRole('heading',{name:'Projeto legado'}),assistente=screen.getByText('Assistente VOIA'),aba=screen.getByRole('button',{name:'Visão Geral'});
    expect(titulo.compareDocumentPosition(assistente)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(assistente.compareDocumentPosition(aba)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(screen.getByText(fase?'Aprovada':'Não informada')).toBeTruthy();expect(screen.getByText('Em andamento')).toBeTruthy();expect(screen.getByText('Sem etapa definida.')).toBeTruthy();expect(screen.queryByText('Todas as etapas concluídas.')).toBeNull();expect(screen.getByRole('heading',{name:'Local do serviço'})).toBeTruthy();expect(screen.queryByText('Endereço da obra')).toBeNull();expect(screen.getByText('Condomínio Parque Chapada dos Campos')).toBeTruthy();expect(fetchMock.mock.calls.every(([,init])=>!init?.method)).toBe(true);
  });
  it('não conclui etapas apenas por ausência da etapa atual quando faltam dados de conclusão',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>resposta({projeto,tiposServico:[],resumoOperacional:{totalEtapas:2,etapaAtual:null,tarefasAtrasadas:0,proximoPrazo:null}})));workspace();expect(await screen.findByText('Nenhuma etapa em andamento.')).toBeTruthy();expect(screen.queryByText('Todas as etapas concluídas.')).toBeNull();
  });
  it('Visão Geral pode informar conclusão quando duas etapas estão efetivamente concluídas',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>resposta({projeto,tiposServico:[],resumoOperacional:{totalEtapas:2,etapasConcluidas:2,etapaAtual:null,tarefasAtrasadas:0,proximoPrazo:null}})));workspace();expect(await screen.findByText('Todas as etapas concluídas.')).toBeTruthy();
  });
  it('parceiro não recebe o Assistente administrativo',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>resposta({projeto,tiposServico:[],resumoOperacional:{totalEtapas:0,etapaAtual:null,tarefasAtrasadas:0,proximoPrazo:null}})));render(auth(<MemoryRouter initialEntries={['/projetos/4']}><Routes><Route path="/projetos/:id" element={<ProjetoWorkspace/>}/></Routes></MemoryRouter>,'colaborador'));await screen.findByRole('heading',{name:'Projeto legado'});expect(screen.queryByText('Assistente VOIA')).toBeNull();
  });
});

describe('local explícito e documentos legados',()=>{
  it('prioriza endereço estruturado, reconhece rótulo explícito e conserva o texto original',()=>{
    const entrada={...projeto,logradouro:'Rua existente',numero:'10',bairro:'Centro',observacoes:'Local: Condomínio dos Campos\nEndereço completo: Endereço anotado'};
    expect(localProjeto(entrada)).toEqual({local:'Condomínio dos Campos',endereco:'Rua existente, 10, Centro'});expect(entrada.observacoes).toBe('Local: Condomínio dos Campos\nEndereço completo: Endereço anotado');
  });
  it('não infere condomínio de frase livre, nem escolhe entre rótulos conflitantes ou consome a linha seguinte',()=>{
    expect(localProjeto({...projeto,observacoes:'Mensagem sobre Condomínio dos Campos'}).local).toBe('');expect(localProjeto({...projeto,observacoes:'Local: Campo A\nLocal: Campo B'}).local).toBe('');expect(localProjeto({...projeto,observacoes:'Local:\nEndereço completo: Rua anotada'})).toEqual({local:'',endereco:'Rua anotada'});
  });
  it('checklist vazio é explícito e Admin pode adicionar esperado sem transformar documentos legados',async()=>{
    const mock=vi.fn(async(url:string)=>resposta(url.endsWith('/etapas')?{etapas:[]}:{documentos:[{id:1,nome:'Documento legado',categoria:'outros',esperado:0,estado_documental:null,possui_arquivo:0,criado_em:'2026-10-14'}]}));vi.stubGlobal('fetch',mock);render(auth(<DocumentosPanel projetoId={4} podeEditar podeExcluir/>));expect(await screen.findByText('Documento legado')).toBeTruthy();expect(screen.getByText('Nenhum documento esperado cadastrado. Os documentos existentes permanecem na lista abaixo.')).toBeTruthy();expect(screen.getByRole('button',{name:'+ Adicionar documento esperado'})).toBeTruthy();expect(mock.mock.calls.every(([url])=>url.startsWith('/api/projetos/4/'))).toBe(true);
  });
});

describe('Assistente com nomenclatura legada sem persistência',()=>{
  it('localiza Emissão da ART e exige seleção quando há múltiplas tarefas correspondentes',()=>{
    const tarefas=[{id:2,nome:'Emissão da ART',status:'pendente'}];const r=interpretarAtualizacao('Já emiti a ART.',{tarefas,documentos:[]},'2026-10-14');expect(r.sugestoes.map(s=>s.operacao)).toContainEqual({tipo:'tarefa',id:2,dados:{status:'concluida'}});
    const ambiguo=interpretarAtualizacao('Já emiti a ART.',{tarefas:[...tarefas,{id:3,nome:'Emitir ART',status:'pendente'}],documentos:[]},'2026-10-14');const sugestao=ambiguo.sugestoes.find(s=>s.operacao.tipo==='tarefa')!;expect(sugestao.selecionada).toBe(false);expect(sugestao.operacao).toMatchObject({id:0});
  });
  it('cenário pedido só faz GETs, revisa tarefas existentes e ART sem arquivo; cancelar não persiste',async()=>{
    const mock=vi.fn(async(url:string,init?:RequestInit)=>{if(init?.method)throw Error('Escrita indevida');return resposta(url.endsWith('/tarefas')?{tarefas:[{id:1,nome:'Vistoria inicial',status:'pendente'},{id:2,nome:'Emissão da ART',status:'pendente'}]}:url.endsWith('/documentos')?{documentos:[{id:3,nome:'ART',categoria:'art_rrt',estado_documental:'pendente_emissao',possui_arquivo:0}]}:{projeto:{fase_comercial:null}});});vi.stubGlobal('fetch',mock);const user=userEvent.setup();render(<AssistenteVoia projetoId={4} onSaved={vi.fn()}/>);await user.click(screen.getByText('Assistente VOIA'));await user.type(screen.getByLabelText('Atualização'),'Fiz a vistoria inicial hoje e já emiti a ART.');await user.click(screen.getByRole('button',{name:'Analisar mudanças'}));expect(await screen.findByText('Revisar alterações sugeridas')).toBeTruthy();expect(screen.getByText('Concluir tarefa de emissão de ART')).toBeTruthy();expect(screen.getByText('ART: marcar como emitido; arquivo permanece independente')).toBeTruthy();expect(screen.getByText('Arquivo: pendente de upload')).toBeTruthy();await user.click(screen.getByRole('button',{name:'Cancelar revisão'}));await waitFor(()=>expect(screen.queryByText('Revisar alterações sugeridas')).toBeNull());expect(mock.mock.calls).toHaveLength(3);expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);
  });
});

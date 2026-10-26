import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import AssistenteVoia from '../../src/react-app/components/AssistenteVoia';
import PlanoExecucaoEditor from '../../src/react-app/components/PlanoExecucaoEditor';
import NovoTrabalhoInteligenteModal from '../../src/react-app/components/NovoTrabalhoInteligenteModal';
import DocumentosPanel from '../../src/react-app/components/DocumentosPanel';
import CronogramaPanel from '../../src/react-app/components/CronogramaPanel';
import { AuthContext } from '../../src/react-app/contexts/auth-context';
import { consolidarTrabalho } from '../../src/react-app/lib/consolidar-trabalho';
import { incorporarModelo } from '../../src/react-app/lib/plano-trabalho';
import { interpretarAtualizacao } from '../../src/shared/assistente-voia';
import { identificarFase } from '../../src/shared/operacao-voia';
import { textoYara } from '../fixtures/yara';

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const resposta=(d:object,status=200)=>new Response(JSON.stringify(d),{status});
const contexto={fase_comercial:'aguardando_retorno' as const,tarefas:[{id:1,nome:'Vistoria inicial',status:'pendente',descricao:'Levar trena.'},{id:2,nome:'Emitir ART',status:'pendente'}],documentos:[{id:3,nome:'ART',categoria:'art_rrt',estado_documental:'pendente_emissao' as const,possui_arquivo:0}]};
function auth(element:React.ReactNode){return <AuthContext.Provider value={{user:{id:1,nome:'Bruna',email:'teste@voia.local',perfil:'administrador'},loading:false,login:async()=>{},logout:async()=>{}}}>{element}</AuthContext.Provider>;}

describe('interpretação determinística genérica',()=>{
  it.each([
    ['Em levantamento','levantamento'],['Orçamento em elaboração','proposta_em_elaboracao'],['Enviei essa proposta para o cliente hoje','proposta_enviada'],['Aguardando retorno','aguardando_retorno'],['Cliente fechou essa proposta','aprovada'],['Cliente disse que não vai fazer','perdida'],['Preparando o serviço','preparacao'],['Iniciamos a execução','em_andamento'],['Serviço concluído','concluida'],['Trabalho cancelado','cancelada'],
  ])('identifica %s sem presumir execução', (texto,fase)=>expect(identificarFase(texto)).toBe(fase));
  it('proposta isolada aguarda aceite e informação insuficiente não gera etapas ou documentos universais',()=>{
    const r=consolidarTrabalho([{nome:'proposta.pdf',texto:'Cliente: Ana Silva\nServiço: Consultoria\nTarefa: Telefonar para cliente'}]).rascunho;
    expect(r.projeto).toMatchObject({fase_comercial:'aguardando_retorno',status:'prospeccao'});expect(r.etapas).toEqual([]);expect(r.documentosEsperados).toEqual([]);expect(r.acoes[0]).toMatchObject({nome:'Telefonar para cliente',prazo:null,etapaChave:null,responsavel_id:null,status:'aguardando'});
  });
  it('escopo explícito de outro serviço gera etapas próprias, tarefas vinculadas e documentos somente mencionados',()=>{
    const r=consolidarTrabalho([{nome:'Briefing',texto:'Serviço: Projeto estrutural\nEtapa 1 — Levantamento\nTarefa: Medir terreno\nEtapa 2 — Projeto estrutural\nTarefa: Calcular estrutura\nElaborar memorial descritivo'}]).rascunho;
    expect(r.etapas?.map(e=>e.nome)).toEqual(['Levantamento','Projeto estrutural']);expect(r.acoes.map(a=>a.etapaChave)).toEqual(['etapa-0','etapa-1']);expect(r.acoes.every(a=>a.prazo===null&&a.responsavel_id===null)).toBe(true);expect(r.documentosEsperados?.map(d=>d.nome)).toEqual(['Memorial']);
    expect(consolidarTrabalho([{nome:'Escopo',texto:'Sem emissão da ART.'}]).rascunho.documentosEsperados).toEqual([]);
  });
  it('modelo existente acrescenta sugestões sem duplicar tarefas ou inventar datas e responsáveis',()=>{
    const r=consolidarTrabalho([{nome:'Texto',texto:'Tarefa: Medir terreno'}]).rascunho;
    const modelo=[{id:10,nome:'Levantamento',ordem:0,ativa:1,tarefas:[{nome:'Medir terreno',descricao:null,ativa:1},{nome:'Fotografar terreno',descricao:'Registro autorizado no modelo',ativa:1}]}];
    const p=incorporarModelo(incorporarModelo(r,7,modelo),7,modelo);
    expect(p.etapas).toHaveLength(1);expect(p.acoes).toHaveLength(2);expect(p.acoes.every(a=>a.prazo===null&&!a.responsavel_id)).toBe(true);expect(p.projeto.tipo_servico_ids).toEqual([7]);
  });
  it('aprovação posterior não conflita com uma proposta sem evidência de recusa',()=>{
    const r=consolidarTrabalho([{nome:'proposta.txt',texto:'Cliente: Ana Silva\nValor: R$ 500,00'},{nome:'WhatsApp',texto:'Cliente aprovou a proposta.'}]);expect(r.conflitos).toEqual([]);expect(r.rascunho.projeto.fase_comercial).toBe('aprovada');
    const conflito=consolidarTrabalho([{nome:'WhatsApp 1',texto:'Cliente aprovou a proposta.'},{nome:'WhatsApp 2',texto:'Cliente não aprovou a proposta.'}]);expect(conflito.conflitos.some(c=>c.campo==='projeto.fase_comercial')).toBe(true);
  });
  it('sugere agendamento de quinta usando referência explícita, preserva descrição e não grava pagamento',()=>{
    const r=interpretarAtualizacao('Cliente aprovou a proposta. Fechou por R$ 5.000, vai pagar 50% de entrada e marcamos a vistoria para quinta às 14h.',contexto,'2026-10-14');
    expect(r.sugestoes.map(s=>s.operacao)).toContainEqual({tipo:'tarefa',id:1,dados:{prazo:'2026-10-15',descricao:'Horário: 14:00.\nLevar trena.'}});expect(r.avisos.some(a=>a.includes('R$')&&a.includes('2.500'))).toBe(true);expect(r.sugestoes.every(s=>['tarefa','projeto'].includes(s.operacao.tipo))).toBe(true);
  });
  it('mais de uma tarefa ou documento exige seleção; recusa preserva registros e conflitos não são escolhidos',()=>{
    const ctx={...contexto,tarefas:[...contexto.tarefas,{id:4,nome:'Vistoria inicial A',status:'pendente'}],documentos:[...contexto.documentos,{...contexto.documentos[0],id:5}]};
    const r=interpretarAtualizacao('Fiz a vistoria inicial hoje e já emiti a ART.',ctx,'2026-10-14');expect(r.sugestoes.filter(s=>s.candidatos?.length===2).every(s=>!s.selecionada&&'id'in s.operacao&&s.operacao.id===0)).toBe(true);
    expect(interpretarAtualizacao('Cliente não vai fazer agora.',ctx,'2026-10-14').sugestoes.map(s=>s.operacao)).toEqual([{tipo:'projeto',dados:{fase_comercial:'perdida'}}]);
    const conflitos=interpretarAtualizacao('Cliente aprovou.\nCliente não aprovou.\nValor R$ 500,00 e R$ 700,00.',ctx,'2026-10-14');expect(conflitos.sugestoes.filter(s=>s.conflito).every(s=>!s.selecionada&&Object.keys(s.operacao.dados).length===0)).toBe(true);
  });
  it('não inventa agendamento quando há duas datas/horários e não declara ART não emitida como emitida',()=>{
    const r=interpretarAtualizacao('Vistoria 15/10/2026 ou 16/10/2026 às 09h ou 14h. Não emiti a ART.',contexto,'2026-10-14');expect(r.sugestoes).toEqual([]);expect(r.avisos.some(a=>a.includes('ambíguos'))).toBe(true);
  });
});

describe('revisão, confirmação e checklist no DOM',()=>{
  it('plano hierárquico permite editar, reordenar, mover, remover e acrescentar sem persistir',async()=>{
    vi.stubGlobal('fetch',vi.fn());const user=userEvent.setup();
    function Plano(){const [r,setR]=useState(consolidarTrabalho([{nome:'Texto',texto:textoYara}]).rascunho);return <PlanoExecucaoEditor r={r} alterar={setR}/>;}
    render(<Plano/>);const etapa=screen.getAllByLabelText('Etapa',{exact:true})[0];fireEvent.change(etapa,{target:{value:'Inspeção revisada'}});fireEvent.change(screen.getAllByLabelText('Ordem')[0],{target:{value:'3'}});
    await user.selectOptions(screen.getAllByLabelText('Etapa relacionada')[0],'');expect(screen.queryByText('↳ Tarefa: Vistoria inicial')).toBeNull();await user.click(screen.getAllByRole('button',{name:'Remover etapa'})[0]);await user.click(screen.getByRole('button',{name:'+ Adicionar etapa'}));expect(screen.getAllByLabelText('Etapa',{exact:true})).toHaveLength(4);await user.click(screen.getAllByRole('button',{name:'Remover documento esperado'})[0]);await user.click(screen.getByRole('button',{name:'+ Adicionar documento esperado'}));expect(screen.getAllByLabelText('Documento esperado',{exact:true})).toHaveLength(2);expect(fetch).not.toHaveBeenCalled();
  });
  it('proposta pode ser ponto de partida e continuar na revisão sem salvar',async()=>{
    vi.stubGlobal('fetch',vi.fn());const user=userEvent.setup();render(<MemoryRouter><NovoTrabalhoInteligenteModal onClose={vi.fn()}/></MemoryRouter>);
    await user.upload(screen.getByLabelText('Propostas e documentos'),new File(['Cliente: Ana Silva\nServiço: Consultoria\nValor: R$ 500,00'],'proposta.txt',{type:'text/plain'}));await waitFor(()=>expect((screen.getByLabelText('Propostas e documentos') as HTMLInputElement).disabled).toBe(false));await user.click(screen.getByRole('button',{name:'Analisar e organizar →'}));expect(await screen.findByLabelText('Fase comercial')).toBeTruthy();expect((screen.getByLabelText('Fase comercial') as HTMLSelectElement).value).toBe('aguardando_retorno');expect((screen.getByLabelText('Status operacional') as HTMLSelectElement).value).toBe('prospeccao');expect(fetch).not.toHaveBeenCalled();
  });
  it('Assistente analisa sem escrita e confirmação envia somente a alteração selecionada e editada',async()=>{
    const mock=vi.fn(async(url:string,init?:RequestInit)=>resposta(init?.method==='POST'?{aplicadas:[0]}:url.endsWith('/tarefas')?{tarefas:contexto.tarefas}:url.endsWith('/documentos')?{documentos:contexto.documentos}:{projeto:{fase_comercial:'aguardando_retorno'}}));vi.stubGlobal('fetch',mock);const user=userEvent.setup(),salvo=vi.fn();render(<AssistenteVoia projetoId={9} onSaved={salvo}/>);await user.click(screen.getByText('Assistente VOIA'));fireEvent.change(screen.getByLabelText('Atualização'),{target:{value:'Cliente aprovou a proposta. Fechou por R$ 5.000, vai pagar 50% de entrada.'}});await user.click(screen.getByRole('button',{name:'Analisar mudanças'}));expect(await screen.findByText('Revisar alterações sugeridas')).toBeTruthy();expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);await user.click(screen.getByLabelText('Atualizar valor contratado (centavos)'));await user.selectOptions(screen.getByLabelText('Fase comercial'),'preparacao');await user.click(screen.getByRole('button',{name:'Confirmar atualizações'}));await waitFor(()=>expect(salvo).toHaveBeenCalled());const [,init]=mock.mock.calls.find(([,init])=>init?.method==='POST')!;expect(JSON.parse(init!.body as string)).toEqual({confirmado:true,operacoes:[{tipo:'projeto',dados:{fase_comercial:'preparacao'}}]});expect(screen.getByRole('status').textContent).toContain('Atualizações confirmadas');
  });
  it('ambiguidade na revisão só aplica após escolher a tarefa e não cria duplicata',async()=>{
    const tarefas=[{id:1,nome:'Vistoria inicial',status:'pendente'},{id:4,nome:'Vistoria inicial B',status:'pendente'}];const mock=vi.fn(async(url:string,init?:RequestInit)=>resposta(init?.method==='POST'?{aplicadas:[0]}:url.endsWith('/tarefas')?{tarefas}:url.endsWith('/documentos')?{documentos:[]}:{projeto:{}}));vi.stubGlobal('fetch',mock);const user=userEvent.setup();render(<AssistenteVoia projetoId={9} onSaved={vi.fn()}/>);await user.click(screen.getByText('Assistente VOIA'));fireEvent.change(screen.getByLabelText('Atualização'),{target:{value:'Fiz a vistoria inicial hoje.'}});await user.click(screen.getByRole('button',{name:'Analisar mudanças'}));const select=await screen.findByLabelText('Mais de um registro corresponde. Escolha:');expect((screen.getByRole('button',{name:'Confirmar atualizações'}) as HTMLButtonElement).disabled).toBe(true);await user.selectOptions(select,'4');await user.click(screen.getByRole('button',{name:'Confirmar atualizações'}));await screen.findByRole('status');const init=mock.mock.calls.find(([,init])=>init?.method==='POST')![1]!;expect(JSON.parse(init.body as string).operacoes).toEqual([{tipo:'tarefa',id:4,dados:{status:'concluida'}}]);
  });
  it('falha parcial é mostrada e a continuação envia somente as alterações restantes',async()=>{
    let tentativas=0;
    const mock=vi.fn(async(url:string,init?:RequestInit)=>{
      if(init?.method==='POST'){tentativas++;return resposta(tentativas===1?{error:'Falha ao salvar valor',aplicadas:[0]}:{aplicadas:[0]},tentativas===1?409:200);}
      return resposta(url.endsWith('/tarefas')?{tarefas:[]}:url.endsWith('/documentos')?{documentos:[]}:{projeto:{fase_comercial:'aguardando_retorno'}});
    });vi.stubGlobal('fetch',mock);const user=userEvent.setup();render(<AssistenteVoia projetoId={9} onSaved={vi.fn()}/>);
    await user.click(screen.getByText('Assistente VOIA'));fireEvent.change(screen.getByLabelText('Atualização'),{target:{value:'Cliente aprovou a proposta. Fechou por R$ 5.000.'}});await user.click(screen.getByRole('button',{name:'Analisar mudanças'}));await screen.findByText('Revisar alterações sugeridas');await user.click(screen.getByRole('button',{name:'Confirmar atualizações'}));expect((await screen.findByRole('alert')).textContent).toContain('Falha ao salvar valor');expect(screen.queryByLabelText('Fase comercial')).toBeNull();await user.click(screen.getByRole('button',{name:'Continuar atualizações'}));await screen.findByRole('status');const posts=mock.mock.calls.filter(([,init])=>init?.method==='POST');expect(JSON.parse(posts[1][1]!.body as string).operacoes).toEqual([{tipo:'projeto',dados:{valor_contratado:500000}}]);
  });
  it('ART emitida sem arquivo mostra upload; upload é associado ao mesmo registro pela revisão de anexos',async()=>{
    const mock=vi.fn(async(url:string,init?:RequestInit)=>resposta(init?.method==='POST'?{}:url.endsWith('/tarefas')?{tarefas:[]}:url.endsWith('/documentos')?{documentos:[{id:3,nome:'ART',categoria:'art_rrt',estado_documental:'emitido',possui_arquivo:0}]}:{projeto:{}}));vi.stubGlobal('fetch',mock);const user=userEvent.setup();render(<AssistenteVoia projetoId={9} onSaved={vi.fn()}/>);await user.click(screen.getByText('Assistente VOIA'));await user.upload(screen.getByLabelText('Propostas e documentos'),new File(['ART'],'art.txt',{type:'text/plain'}));await waitFor(()=>expect((screen.getByLabelText('Propostas e documentos') as HTMLInputElement).disabled).toBe(false));await user.click(screen.getByRole('button',{name:'Analisar mudanças'}));await user.selectOptions(await screen.findByLabelText('Associar arquivo'),'3');expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);await user.click(screen.getByRole('button',{name:'Confirmar atualizações'}));await screen.findByRole('status');expect(mock.mock.calls.filter(([,init])=>init?.method==='POST').map(([url])=>url)).toEqual(['/api/projetos/9/documentos/3/arquivo']);
  });
  it('checklist diferencia Emitido de arquivo e permite adicionar esperado, dispensar e revisar upload',async()=>{
    const doc={id:3,nome:'ART',categoria:'art_rrt',esperado:1,estado_documental:'emitido',possui_arquivo:0,visivel_cliente:0,visivel_parceiro:0,criado_em:'2026-10-14',etapa_id:null};const mock=vi.fn(async(url:string)=>resposta(url.endsWith('/etapas')?{etapas:[]}:{documentos:[doc]}));vi.stubGlobal('fetch',mock);vi.spyOn(window,'confirm').mockReturnValue(true);const user=userEvent.setup();render(auth(<DocumentosPanel projetoId={9} podeEditar podeExcluir/>));expect(await screen.findByText('ART')).toBeTruthy();expect(screen.getByText('Arquivo: Pendente de upload')).toBeTruthy();await user.click(screen.getByLabelText('Ações de ART'));await user.click(screen.getByRole('button',{name:'Marcar como não aplicável'}));expect(mock.mock.calls.some(([url])=>url.endsWith('/documentos/3'))).toBe(true);await user.click(screen.getByRole('button',{name:'Fazer upload'}));expect(await screen.findByText('Arquivo não anexado.')).toBeTruthy();expect((screen.getByLabelText('Estado documental') as HTMLSelectElement).value).toBe('emitido');
  });
  it('cronograma mostra tarefas com data e sem data e usa a etapa existente',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>resposta(url.endsWith('/etapas')?{etapas:[{id:1,nome:'Inspeção',status:'pendente',tarefas_total:2,tarefas_concluidas:0}]}:{tarefas:[{id:1,nome:'Vistoria inicial',etapa_id:1,prazo:'2026-10-15',responsavel_nome:'Bruna',descricao:'Horário: 09:00.'},{id:2,nome:'Vistoria final',etapa_id:null,prazo:null,responsavel_nome:null}]})));render(<CronogramaPanel projetoId={9}/>);expect(await screen.findByText(/Vistoria inicial/)).toBeTruthy();expect(screen.getByRole('list',{name:'Atividades a agendar'})).toBeTruthy();expect(screen.getByText('Horário: 09:00.')).toBeTruthy();
  });
});

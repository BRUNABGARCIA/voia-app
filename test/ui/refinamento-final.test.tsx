import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssistenteVoia from '../../src/react-app/components/AssistenteVoia';
import CronogramaPanel from '../../src/react-app/components/CronogramaPanel';
import EtapasPanel from '../../src/react-app/components/EtapasPanel';
import { interpretarAtualizacao } from '../../src/shared/assistente-voia';
import { ordenarAtividades } from '../../src/react-app/lib/cronograma-projeto';

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('Etapas mantém tarefas sem etapa e não oferece cronograma interno',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.endsWith('/etapas')?{etapas:[],progresso:0,totalEtapas:0,etapasConcluidas:0,totalTarefas:3,tarefasConcluidas:0,baseadoEm:'tarefas'}:{tarefas:contexto.tarefas.map(t=>({...t,etapa_id:null}))}))));render(<EtapasPanel projetoId={4} podeEditar={false} podeExcluir={false} onProgressoChange={vi.fn()}/>);await screen.findByText('Vistoria inicial');expect(screen.getByText('Tarefas sem etapa')).toBeTruthy();expect(screen.queryByRole('button',{name:'Cronograma'})).toBeNull();expect(screen.queryByRole('button',{name:'Lista'})).toBeNull();
});
const contexto={tarefas:[{id:1,nome:'Vistoria inicial',status:'pendente',prazo:'2026-10-15',descricao:'Horário: 09:00.'},{id:2,nome:'Emissão da ART',status:'pendente',prazo:'2026-10-15'},{id:3,nome:'Vistoria final',status:'pendente',prazo:null}],documentos:[{id:4,nome:'ART',categoria:'art_rrt',estado_documental:'pendente_emissao' as const,possui_arquivo:0}]};
it.each(['Vou emitir a ART.','Vou fazer a ART.','Preciso emitir a ART.'])('intenção não conclui nem duplica: %s',texto=>{
  const r=interpretarAtualizacao(texto,contexto,'2026-10-14');expect(r.sugestoes).toEqual([]);expect(r.semAlteracoes.join()).toContain('continua pendente');
});
it.each(['Emiti a ART.','ART emitida.','Já fiz a ART.'])('emissão sugere os registros existentes sem inventar arquivo: %s',texto=>{
  const r=interpretarAtualizacao(texto,contexto,'2026-10-14');expect(r.sugestoes.map(s=>s.operacao)).toEqual([{tipo:'documento',id:4,dados:{estado_documental:'emitido'}},{tipo:'tarefa',id:2,dados:{status:'concluida'}}]);expect(contexto.documentos[0].possui_arquivo).toBe(0);
});
it.each(['Fiz a vistoria inicial.','Vistoria inicial realizada.'])('conclusão preserva prazo quando não informado: %s',texto=>{
  expect(interpretarAtualizacao(texto,contexto,'2026-10-14').sugestoes.map(s=>s.operacao)).toEqual([{tipo:'tarefa',id:1,dados:{status:'concluida'}}]);
});
it('vistoria futura apenas agenda a tarefa existente; final sem data fica discreta',()=>{
  const r=interpretarAtualizacao('Vou fazer a vistoria inicial amanhã. Vistoria final ainda será agendada.',contexto,'2026-10-14');expect(r.sugestoes.map(s=>s.operacao)).toEqual([{tipo:'tarefa',id:1,dados:{prazo:'2026-10-15'}}]);expect(r.semAlteracoes).toContain('Vistoria final — permanece a agendar.');
});
it('intenção de ART na mesma frase não esconde vistoria realizada',()=>{
  const r=interpretarAtualizacao('Fiz a vistoria inicial e vou emitir a ART.',contexto,'2026-10-14');expect(r.sugestoes.map(s=>s.operacao)).toEqual([{tipo:'tarefa',id:1,dados:{status:'concluida'}}]);
});
it('data explícita divergente também exige escolha e não é enviada silenciosamente',()=>{
  const r=interpretarAtualizacao('Vistoria inicial 16/10/2026.',contexto,'2026-10-14');expect(r.sugestoes[0].conflitoData).toMatchObject({cadastrada:'2026-10-15',informada:'2026-10-16',decisao:null});expect(r.sugestoes[0].operacao.dados).not.toHaveProperty('prazo');
});
it.each(['manter','alterar'])('Yara: análise sem escrita e conflito exige decisão %s',async(decisao)=>{
  vi.spyOn(Date.prototype,'getFullYear').mockReturnValue(2026);vi.spyOn(Date.prototype,'getMonth').mockReturnValue(9);vi.spyOn(Date.prototype,'getDate').mockReturnValue(14);
  const mock=vi.fn(async(url:string,init?:RequestInit)=>new Response(JSON.stringify(init?.method?{aplicadas:[0]}:url.endsWith('/tarefas')?{tarefas:contexto.tarefas}:url.endsWith('/documentos')?{documentos:contexto.documentos}:{projeto:{fase_comercial:null}})));vi.stubGlobal('fetch',mock);
  const user=userEvent.setup();render(<AssistenteVoia projetoId={4} onSaved={vi.fn()}/>);await user.click(screen.getByText('Assistente VOIA'));fireEvent.change(screen.getByLabelText('Atualização'),{target:{value:'Fiz a vistoria inicial hoje às 9h. Já realizei o levantamento e vou emitir a ART agora. A vistoria final ainda não tem data.'}});await user.click(screen.getByRole('button',{name:'Analisar mudanças'}));await screen.findByText('Data diferente da cadastrada');
  expect(screen.getByText(/hoje \(14\/10\/2026\).*15\/10\/2026 às 09:00/)).toBeTruthy();expect((screen.getByRole('button',{name:'Confirmar atualizações'}) as HTMLButtonElement).disabled).toBe(true);expect(mock.mock.calls.every(([,init])=>!init?.method)).toBe(true);expect(screen.queryByText('Concluir tarefa de emissão de ART')).toBeNull();
  await user.click(screen.getByRole('button',{name:decisao==='manter'?'Manter 15/10/2026':'Alterar para 14/10/2026'}));await user.click(screen.getByRole('button',{name:'Confirmar atualizações'}));await screen.findByRole('status');const posts=mock.mock.calls.filter(([,init])=>init?.method);expect(posts).toHaveLength(1);expect(JSON.parse(posts[0][1]!.body as string).operacoes).toEqual([{tipo:'tarefa',id:1,dados:decisao==='manter'?{status:'concluida'}:{status:'concluida',prazo:'2026-10-14'}}]);expect(posts[0][0]).toBe('/api/projetos/4/assistente/confirmar');
});
it('ordena por dia e horário; sem data fica no fim sem alterar entradas',()=>{
  const tarefas=[{nome:'Final',prazo:null},{nome:'ART',prazo:'2026-10-15',descricao:'Horário: 15:00.'},{nome:'Inicial',prazo:'2026-10-15',descricao:'Horário: 09:00.'},{nome:'Follow-up',prazo:'2026-10-30'}];expect(ordenarAtividades(tarefas).map(t=>t.nome)).toEqual(['Inicial','ART','Follow-up','Final']);expect(tarefas[0].nome).toBe('Final');
});
it('cronograma mantém etapas existentes e coloca a agendar depois das datas',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.endsWith('/etapas')?{etapas:[]}:{tarefas:contexto.tarefas}))));render(<CronogramaPanel projetoId={4}/>);const datadas=await screen.findByRole('list',{name:'Atividades com data'}),semData=screen.getByRole('list',{name:'Atividades a agendar'});expect(within(datadas).getByText('Vistoria inicial')).toBeTruthy();expect(within(semData).getByText('Vistoria final')).toBeTruthy();expect(datadas.compareDocumentPosition(semData)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

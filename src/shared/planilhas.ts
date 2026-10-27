import { z } from 'zod';

export const STATUS_LEVANTAMENTO = {
  FECHADO: 'Fechado', QPE: 'Quantificado — pendente de especificação',
  CPQ: 'Confirmado — pendente de quantificação', CPP: 'Confirmado — pendente de projeto/locação',
  PC: 'Pendente de campo', VT: 'Serviço identificado para validação técnica', NC: 'Não contratado',
} as const;
export const ETAPAS_REFORMA = [
  ['01','Pintura'],['02','Civil / calçadas / muros'],['03','Forro / gesso'],['04','Cobertura / rufos / marquises'],
  ['05','Instalações elétricas'],['06','Telecomunicações'],['07','Hidráulica / metais'],['08','Esquadrias / serralheria / ferragens'],
  ['09','Marcenaria'],['10','Acabamentos'],['11','Limpeza'],['12','Climatização'],
] as const;
const texto = (n = 2000) => z.string().max(n);
export const referenciaOrigemSchema=z.object({fonte:z.enum(['biblioteca','base']),base_id:z.number().int().positive().nullable(),item_id:z.number().int().positive(),codigo:texto(100),descricao:texto(5000),unidade:texto(30),competencia:texto(30),uf:texto(50),versao:texto(100),origem:texto(1000),preco_centavos:z.number().int().min(0).max(1e11).nullable(),tipo:texto(30),classificacao:texto(200),base_nome:texto(200).optional(),regime:texto(100).optional(),data_referencia:texto(30).optional()}).strict();
export const grupoSchema = z.object({ codigo: z.string().regex(/^\d{2}$/), nome: texto(150).min(1) }).strict();
export const itemPlanilhaSchema = z.object({
  id: z.string().uuid(), codigo: z.string().regex(/^\d{2}\.\d{2,6}$/).or(z.literal('')), grupo: z.string().regex(/^\d{2}$/),
  biblioteca_id: z.number().int().positive().nullable(), servico: texto(300), categoria: texto(150), subcategoria: texto(150),
  descricao: texto(5000), escopo: texto(8000), pavimento: texto(150), ambiente: texto(150), unidade: texto(30),
  quantidade: z.number().finite().min(0).max(1e9).nullable(), memoria: texto(8000), fonte: texto(), observacoes: texto(8000),
  pendencias: texto(5000), status: z.enum(['FECHADO','QPE','CPQ','CPP','PC','VT','NC']).nullable(),
  valor_unit_centavos: z.number().int().min(0).max(1e11).nullable(), fornecedor: texto(200),
  referencia_preco: z.object({ origem: texto(150), codigo: texto(100), competencia: texto(50), uf: texto(50), tipo: texto(100), referencia: texto(1000) }).nullable(),
  referencia_origem:referenciaOrigemSchema.nullable().optional(),
}).strict();
export const planilhaConteudoSchema = z.object({
  nome: texto(200).min(1), descricao: texto(), tipo: z.enum(['livre','reforma']),
  status: z.enum(['rascunho','em_revisao','aprovada','arquivada']),
  somente_mao_de_obra: z.boolean().nullable(), grupos: z.array(grupoSchema).max(99), itens: z.array(itemPlanilhaSchema).max(2000),
}).strict().superRefine((v,c)=>{
  const grupos=new Set(v.grupos.map(g=>g.codigo)),ids=new Set<string>(),codigos=new Set<string>();
  if(grupos.size!==v.grupos.length)c.addIssue({code:'custom',message:'Grupos duplicados'});
  for(const i of v.itens){
    if(!grupos.has(i.grupo)||ids.has(i.id)||(i.codigo&&(!i.codigo.startsWith(i.grupo+'.')||codigos.has(i.codigo))))c.addIssue({code:'custom',message:'Grupo, ID ou código de item inválido/duplicado'});
    ids.add(i.id);if(i.codigo)codigos.add(i.codigo);
    if(i.quantidade!==null&&i.valor_unit_centavos!==null&&i.quantidade*i.valor_unit_centavos>Number.MAX_SAFE_INTEGER)c.addIssue({code:'custom',message:'Total fora do limite numérico'});
  }
});
export type ItemPlanilha=z.infer<typeof itemPlanilhaSchema>;
export type GrupoPlanilha=z.infer<typeof grupoSchema>;
export type ConteudoPlanilha=z.infer<typeof planilhaConteudoSchema>;
export type Planilha=ConteudoPlanilha&{id:number;obra_id:number;versao:number;criada_em:string;atualizada_em:string};
export type ServicoBiblioteca={id:number;codigo:string;nome:string;grupo:string;categoria:string;subcategoria:string;unidade:string;descricao:string;escopo:string;tags:string;observacoes:string;origem:string;ativo:number};
export function novoItem(grupo='01',servico?:ServicoBiblioteca):ItemPlanilha{
  return {id:crypto.randomUUID(),codigo:'',grupo:servico?.grupo??grupo,biblioteca_id:servico?.id??null,servico:servico?.nome??'',categoria:servico?.categoria??'',subcategoria:servico?.subcategoria??'',descricao:servico?.descricao??'',escopo:servico?.escopo??'',pavimento:'',ambiente:'',unidade:servico?.unidade??'',quantidade:null,memoria:'',fonte:servico?.origem??'',observacoes:servico?.observacoes??'',pendencias:'',status:null,valor_unit_centavos:null,fornecedor:'',referencia_preco:null};
}
export function totalItem(i:ItemPlanilha):number|null{return i.quantidade===null||i.valor_unit_centavos===null?null:Math.round(i.quantidade*i.valor_unit_centavos);}
export function totaisItens(itens:ItemPlanilha[]){return {parcial_centavos:itens.reduce((s,i)=>s+(totalItem(i)??0),0),sem_preco:itens.filter(i=>i.valor_unit_centavos===null).length,sem_quantidade:itens.filter(i=>i.quantidade===null).length,cotados:itens.filter(i=>totalItem(i)!==null).length};}
export function normalizarBusca(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
/** Plain numeric entry only. Memory is never evaluated or used as a formula. */
export function numeroCelula(s:string):number|null{
  if(!s.trim())return null;
  const limpo=s.trim().replace(/\s/g,'');
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(limpo)&&!/^\d+(?:\.\d+)?$/.test(limpo))throw new Error('Informe um número válido, sem fórmulas.');
  const n=Number(limpo.includes(',')?limpo.replace(/\./g,'').replace(',','.'):limpo);
  if(!Number.isFinite(n)||n<0||n>1e9)throw new Error('Número fora do limite permitido.');return n;
}

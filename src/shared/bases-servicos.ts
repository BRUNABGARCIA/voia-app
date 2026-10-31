import { z } from 'zod';
import { sicroItemSchema,chaveCustoSicro,type ReferenciaSicro } from './sicro';
import { normalizarBusca, novoItem, type ItemPlanilha } from './planilhas';

export const TIPOS_BASE=['VOIA','SINAPI','SICRO','SBC','PROPRIA','IMPORTADA','OUTRA'] as const;
export const REGIMES_REFERENCIA=['nao_desonerado','desonerado'] as const;
export type RegimeReferencia=typeof REGIMES_REFERENCIA[number];
export const precosRegimesSchema={preco_nao_desonerado_centavos:z.number().int().positive().max(1e11).nullable().optional(),preco_desonerado_centavos:z.number().int().positive().max(1e11).nullable().optional()};
export function selecionarRegime(item:ItemPlanilha,regime:RegimeReferencia|null):ItemPlanilha{
 const ref=item.referencia_origem;if(!ref)return item;
 return {...item,referencia_origem:{...ref,regime_escolhido:regime,preco_referencia_centavos:regime===null?null:regime==='desonerado'?ref.preco_desonerado_centavos??null:ref.preco_nao_desonerado_centavos??null}};
}
export function referenciaTecnica(ref:NonNullable<ItemPlanilha['referencia_origem']>){const {regime_escolhido,preco_referencia_centavos,custo_sicro_escolhido,...origem}=ref;void regime_escolhido;void preco_referencia_centavos;void custo_sicro_escolhido;return origem;}
export function regimeValido(ref:NonNullable<ItemPlanilha['referencia_origem']>){
 if(ref.sicro)return ref.custo_sicro_escolhido==null||ref.sicro.custos.some(c=>c.selecionavel&&chaveCustoSicro(c)===ref.custo_sicro_escolhido);
 if(ref.regime_escolhido===undefined&&ref.preco_referencia_centavos===undefined)return true;
 const esperado=ref.regime_escolhido==='desonerado'?ref.preco_desonerado_centavos??null:ref.regime_escolhido==='nao_desonerado'?ref.preco_nao_desonerado_centavos??null:null;
 return ref.preco_referencia_centavos===esperado;
}
export const baseSchema=z.object({nome:z.string().trim().min(1).max(200),tipo:z.enum(TIPOS_BASE),descricao:z.string().max(2000).default(''),origem:z.string().trim().min(1).max(1000),competencia:z.string().max(30).default(''),uf:z.string().trim().max(50).transform(v=>v.toUpperCase()).default(''),data_referencia:z.string().max(30).default(''),versao:z.string().trim().min(1).max(100),regime:z.string().max(100).default(''),observacoes:z.string().max(3000).default('')}).strict();
export const baseItemSchema=z.object({sicro:sicroItemSchema.optional(),codigo:z.string().trim().min(1).max(100),descricao:z.string().trim().min(1).max(5000),unidade:z.string().trim().min(1).max(30),preco_centavos:z.number().int().min(0).max(1e11).nullable(),...precosRegimesSchema,metadados:z.record(z.string().max(100),z.union([z.string().max(2000),z.number().finite(),z.null()])).refine(v=>JSON.stringify(v).length<=12000).optional(),tipo:z.enum(['servico','composicao','insumo']),classificacao:z.string().max(200).default(''),grupo:z.string().regex(/^\d{2}$/).or(z.literal('')).default(''),categoria:z.string().max(150).default(''),subcategoria:z.string().max(150).default(''),tags:z.string().max(500).default(''),observacoes:z.string().max(3000).default('')}).strict().superRefine((v,c)=>{if(Object.values(v).some(t=>typeof t==='string'&&/\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2[\u20ac\u2020]|\uFFFD/.test(t)))c.addIssue({code:'custom',message:'Texto com possível encoding corrompido.'});});
export type BaseReferencia=z.infer<typeof baseSchema>&{id:number;ativa:number;itens_total:number;criada_em:string;atualizada_em:string};
export type BaseItem=z.infer<typeof baseItemSchema>;
export type ResultadoCatalogo={fonte:'biblioteca'|'base';id:number;base_id:number|null;base_nome:string;tipo_base:string;codigo:string;descricao:string;unidade:string;grupo:string;categoria:string;subcategoria:string;tags:string;escopo:string;observacoes:string;competencia:string;uf:string;versao:string;origem:string;preco_centavos:number|null;tipo:string;classificacao:string;regime?:string;data_referencia?:string;preco_nao_desonerado_centavos?:number|null;preco_desonerado_centavos?:number|null;metadados?:string|null;sicro?:ReferenciaSicro};
export const chaveItem=(i:{codigo:string;tipo:string;classificacao:string})=>JSON.stringify([i.codigo,i.tipo,i.classificacao]);
export const buscaItem=(i:BaseItem)=>normalizarBusca([i.codigo,i.descricao,i.categoria,i.subcategoria,i.tags].join(' '));
export function dividirLotes(itens:BaseItem[]){const lotes:BaseItem[][]=[];let atual:BaseItem[]=[],bytes=20;for(const i of itens){const tamanho=new TextEncoder().encode(JSON.stringify(i)).length+1;if(tamanho>700000)throw Error('Item excede o limite de lote.');if(atual.length&&(atual.length>=200||bytes+tamanho>700000)){lotes.push(atual);atual=[];bytes=20;}atual.push(i);bytes+=tamanho;}if(atual.length)lotes.push(atual);return lotes;}
export function itemDoCatalogo(r:ResultadoCatalogo,grupo:string):ItemPlanilha{
  const i=novoItem(r.grupo||grupo);
  return {...i,biblioteca_id:r.fonte==='biblioteca'?r.id:null,servico:r.descricao.slice(0,300),descricao:r.fonte==='base'?r.descricao:'',escopo:r.escopo,unidade:r.unidade,categoria:r.categoria,subcategoria:r.subcategoria,observacoes:r.observacoes,fonte:r.base_nome,referencia_origem:{...(r.sicro?{sicro:r.sicro,custo_sicro_escolhido:r.sicro.subtipo==='equipamento'?null:(r.sicro.custos.filter(c=>c.selecionavel).length===1?chaveCustoSicro(r.sicro.custos.find(c=>c.selecionavel)!):null)}:{}),fonte:r.fonte,base_id:r.base_id,item_id:r.id,codigo:r.codigo,descricao:r.descricao,unidade:r.unidade,competencia:r.competencia,uf:r.uf,versao:r.versao,origem:r.origem,preco_centavos:r.preco_centavos,tipo:r.tipo,classificacao:r.classificacao,base_nome:r.base_nome,regime:r.regime??'',data_referencia:r.data_referencia??'',...((r.tipo_base==='SINAPI'&&r.preco_centavos===null)||r.preco_nao_desonerado_centavos!=null||r.preco_desonerado_centavos!=null?{preco_nao_desonerado_centavos:r.preco_nao_desonerado_centavos??null,preco_desonerado_centavos:r.preco_desonerado_centavos??null,regime_escolhido:null,preco_referencia_centavos:null}:{}),...(r.metadados?{metadados:r.metadados}:{}),...(r.fonte==='base'?{tipo_base:r.tipo_base as typeof TIPOS_BASE[number]}:{})}};
}
export function substituirReferenciaSbc(item:ItemPlanilha,r:ResultadoCatalogo):ItemPlanilha{
 if(item.referencia_origem?.tipo_base!=='SBC'||r.tipo_base!=='SBC')throw Error('Reseleção disponível somente entre referências SBC.');
 const novo=itemDoCatalogo(r,item.grupo);
 return {...item,servico:novo.servico,descricao:novo.descricao,unidade:novo.unidade,fonte:novo.fonte,biblioteca_id:null,referencia_origem:novo.referencia_origem};
}
/** Import format is chosen explicitly; ambiguous separators never choose the convention silently. */
export function precoImportado(v:string|number,formato:'br'|'decimal'):number|null{
  if(typeof v==='number'){if(!Number.isFinite(v)||v<0||v>1e9)throw Error('Preço fora do limite');if(Math.abs(v*100-Math.round(v*100))>0.00001)throw Error('Preço com mais de duas casas decimais; confirme um valor em centavos antes de importar.');return Math.round(v*100);}
  const s=v.trim().replace(/^R\$\s*/,'');if(!s||s==='—'||s==='-')return null;
  const valido=formato==='br'?/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/:/^\d+(?:\.\d{1,2})?$/;
  if(!valido.test(s))throw Error('Preço incompatível com o formato numérico selecionado');
  const n=Number(formato==='br'?s.replace(/\./g,'').replace(',','.'):s);if(n>1e9)throw Error('Preço fora do limite');return Math.round(n*100);
}

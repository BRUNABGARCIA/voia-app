import type {ItemPlanilha} from './planilhas';
import {centavosSicro,chaveCustoSicro} from './sicro';

/** Exact non-negative decimal rational, including JS scientific notation for quantities. */
function racional(v:number){
 if(!Number.isFinite(v)||v<0)throw Error('Número inválido.');
 const [mantissa,expo='0']=String(v).split('e'),[a,b='']=mantissa.split('.');const escala=b.length-Number(expo);
 return escala<0?[BigInt(a+b)*10n**BigInt(-escala),1n]:[BigInt(a+b),10n**BigInt(escala)];
}
function arredondar(n:bigint,d:bigint){const v=(n+d/2n)/d;if(v>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Orçamento fora do limite numérico.');return Number(v);}
function decimal(n:bigint,escala:number){const s=n.toString().padStart(escala+1,'0');return s.slice(0,-escala)+'.'+s.slice(-escala);}
export function percentualValido(v:number|null|undefined,max:number){return v==null||(Number.isFinite(v)&&v>=0&&v<=max&&Math.abs(v*100-Math.round(v*100))<1e-8);}
export function calcularItemOrcamento(i:ItemPlanilha){
 if(!percentualValido(i.bdi_percentual,1000)||!percentualValido(i.desconto_percentual,100))throw Error('Percentual inválido: BDI de 0 a 1000%; desconto de 0 a 100%; até duas casas decimais.');
 const pendente=i.bdi_percentual==null||i.desconto_percentual==null;
 if(i.valor_unit_centavos===null)return {com_bdi_centavos:null,final_centavos:null,final_decimal:null,total_centavos:null,percentuais_pendentes:pendente};
 if(!Number.isSafeInteger(i.valor_unit_centavos)||i.valor_unit_centavos<0||i.valor_unit_centavos>1e11)throw Error('Preço adotado inválido.');
 const base=BigInt(i.valor_unit_centavos),bdi=BigInt(Math.round((i.bdi_percentual??0)*100)),desc=BigInt(Math.round((i.desconto_percentual??0)*100));
 const com=base*(10000n+bdi),final=com*(10000n-desc),den=100000000n;
 const qtd=i.quantidade===null?null:racional(i.quantidade);
 return {com_bdi_centavos:arredondar(com,10000n),final_centavos:arredondar(final,den),final_decimal:decimal(final,10),total_centavos:qtd?arredondar(final*qtd[0],den*qtd[1]):null,percentuais_pendentes:pendente};
}
export function resumirOrcamento(itens:ItemPlanilha[]){
 const calculos=itens.map(calcularItemOrcamento),validos=calculos.filter(c=>c.total_centavos!==null),total=validos.reduce((s,c)=>s+BigInt(c.total_centavos!),0n);if(total>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Total do orçamento fora do limite numérico.');
 return {total_centavos:validos.length?Number(total):null,itens:itens.length,com_preco:itens.filter(i=>i.valor_unit_centavos!==null).length,sem_preco:itens.filter(i=>i.valor_unit_centavos===null).length,sem_quantidade:itens.filter(i=>i.quantidade===null).length,percentuais_pendentes:calculos.filter(c=>c.percentuais_pendentes).length,completo:!!itens.length&&validos.length===itens.length&&calculos.every(c=>!c.percentuais_pendentes)};
}
export function calcularOrcamento(itens:ItemPlanilha[]){return {politica:'voia-item-v1',...resumirOrcamento(itens),linhas:itens.map(i=>({id:i.id,...calcularItemOrcamento(i)}))};}
export function precoReferenciaCentavos(ref:ItemPlanilha['referencia_origem']){
 if(!ref)return null;if(ref.sicro){const c=ref.sicro.custos.find(c=>c.selecionavel&&chaveCustoSicro(c)===ref.custo_sicro_escolhido);return c?centavosSicro(c.valor):null;}
 if(ref.tipo_base==='SINAPI')return ref.regime_escolhido==='desonerado'?ref.preco_desonerado_centavos??null:ref.regime_escolhido==='nao_desonerado'?ref.preco_nao_desonerado_centavos??null:null;
 return ref.preco_centavos;
}
export function adotarReferencia(i:ItemPlanilha):ItemPlanilha{
 const preco=precoReferenciaCentavos(i.referencia_origem);if(preco===null)throw Error('Escolha uma referência com preço e regime/custo confirmado.');
 return {...i,valor_unit_centavos:preco,preco_adotado_origem:'referencia',preco_adotado_referencia:structuredClone(i.referencia_origem!)};
}
export function precoManual(i:ItemPlanilha,centavos:number|null):ItemPlanilha{return {...i,valor_unit_centavos:centavos,preco_adotado_origem:centavos===null?null:'manual',preco_adotado_referencia:null};}
export function rotuloOrigemAdotado(i:ItemPlanilha){return i.valor_unit_centavos===null?'Sem preço':i.preco_adotado_origem==='referencia'?'Referência':i.preco_adotado_origem==='manual'?'Manual':'Legado · origem não registrada';}

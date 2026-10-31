import type {ResultadoCatalogo,RegimeReferencia} from '../../shared/bases-servicos';
import {formatarDecimalSicro} from '../../shared/sicro';
const dinheiro=(n:number|null|undefined)=>n==null?'Sem preço de referência':(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function precoSugestao(r:ResultadoCatalogo,regime?:RegimeReferencia|null){
 if(r.sicro){if(r.sicro.subtipo==='equipamento')return 'Produtivo / improdutivo · escolher custo e edição';const cs=r.sicro.custos.filter(c=>c.selecionavel);if(cs.length===1)return cs[0].valor===null?'Sem preço de referência':formatarDecimalSicro(cs[0].valor);return 'Custos por edição · escolher no detalhe';}
 if(r.tipo_base==='SINAPI'&&r.preco_centavos===null){if(regime)return `${regime==='desonerado'?'D':'ND'}: ${dinheiro(regime==='desonerado'?r.preco_desonerado_centavos:r.preco_nao_desonerado_centavos)}`;return `ND: ${dinheiro(r.preco_nao_desonerado_centavos)} · D: ${dinheiro(r.preco_desonerado_centavos)} · escolher regime`;}
 return dinheiro(r.preco_centavos);
}

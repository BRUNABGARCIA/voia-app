import type {ItemPlanilha} from '../../shared/planilhas';
import {precoReferenciaCentavos} from '../../shared/orcamento';
import {chaveCustoSicro,formatarDecimalSicro} from '../../shared/sicro';
export const COLUNAS_ORCAMENTO=[['servico','Serviço'],['unidade','Un.'],['quantidade','Qtd.'],['valor_unit_centavos','Preço adotado'],['bdi_percentual','BDI %'],['desconto_percentual','Desconto %']] as const;
export type CampoOrcamento=typeof COLUNAS_ORCAMENTO[number][0];
export const brl=(n:number|null)=>n===null?'—':(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function referenciaExibida(i:ItemPlanilha){const ref=i.referencia_origem;if(ref?.sicro){const c=ref.sicro.custos.find(c=>c.selecionavel&&chaveCustoSicro(c)===ref.custo_sicro_escolhido);return c?formatarDecimalSicro(c.valor):'Escolher custo/edição';}if(ref?.tipo_base==='SINAPI'&&!ref.regime_escolhido)return 'Escolher regime';return precoReferenciaCentavos(ref)===null?'Sem preço':brl(precoReferenciaCentavos(ref));}

import {z} from 'zod';
import {servicoCompleto,type Planilha} from './planilhas';

const texto=(max:number)=>z.string().trim().max(max);
export const condicoesPadrao='Quantidades referenciais conforme levantamento/projeto. Confira o escopo antes da contratação. Preencha valor unitário e total; indique itens não contemplados, prazo de execução, validade da proposta e condições de pagamento aplicáveis.';
export const dadosSolicitacaoSchema=z.object({
 titulo:texto(200).min(1),escopo:texto(500),prazo:z.union([z.literal(''),z.iso.date()]),
 destinatario:texto(200),contato:texto(200),telefone:texto(60),email:z.union([z.literal(''),z.email().max(254)]),
 observacoes:texto(8000),condicoes:texto(8000),incluir_cliente:z.boolean(),
}).strict();
export const pedidoSolicitacaoSchema=z.object({
 chave:z.uuid(),versao:z.number().int().positive(),dados:dadosSolicitacaoSchema,
 itens:z.array(z.object({id:z.uuid(),escopo:texto(8000),observacao:texto(8000)}).strict()).min(1).max(2000),
 aceitar_pendencias:z.boolean(),
}).strict().refine(p=>new Set(p.itens.map(i=>i.id)).size===p.itens.length,'Itens repetidos');
export const itemExternoSchema=z.object({codigo:z.string(),servico:z.string(),escopo:z.string(),observacao:z.string(),unidade:z.string(),quantidade:z.number().finite().nonnegative().nullable(),pavimento:z.string(),ambiente:z.string(),etapa:z.string()}).strict();
export const documentoExternoSchema=z.object({
 titulo:z.string(),escopo:z.string(),prazo:z.string(),destinatario:z.string(),contato:z.string(),telefone:z.string(),email:z.string(),observacoes:z.string(),condicoes:z.string(),
 obra:z.string(),projeto:z.string(),cliente:z.string(),endereco:z.string(),itens:z.array(itemExternoSchema).min(1),
}).strict();
export const solicitacaoPublicaSchema=z.object({numero:z.string(),emitida_em:z.string(),documento:documentoExternoSchema}).strict();
export type PedidoSolicitacao=z.infer<typeof pedidoSolicitacaoSchema>;
export type DadosSolicitacao=z.infer<typeof dadosSolicitacaoSchema>;
export type DocumentoExterno=z.infer<typeof documentoExternoSchema>;
export type SolicitacaoPublica=z.infer<typeof solicitacaoPublicaSchema>;
export type RegistroSolicitacao={id:number;status:'emitida'|'cancelada';publicacao:SolicitacaoPublica;motivo_cancelamento:string|null};
export const dadosIniciais=():DadosSolicitacao=>({titulo:'Solicitação de proposta',escopo:'',prazo:'',destinatario:'',contato:'',telefone:'',email:'',observacoes:'',condicoes:condicoesPadrao,incluir_cliente:false});
export function reconstruirDocumento(p:Planilha,pedido:PedidoSolicitacao,obra:{obra:string;projeto:string;cliente:string;endereco:string|null}):DocumentoExterno{
 const edicoes=new Map(pedido.itens.map(i=>[i.id,i]));
 const itens=p.itens.filter(i=>edicoes.has(i.id));
 if(itens.length!==edicoes.size)throw Error('Item fora da planilha ou removido. Faça uma nova revisão.');
 // Whitelist only. Never spread source items, reference objects or internal notes.
 return documentoExternoSchema.parse({titulo:pedido.dados.titulo,escopo:pedido.dados.escopo,prazo:pedido.dados.prazo,destinatario:pedido.dados.destinatario,contato:pedido.dados.contato,telefone:pedido.dados.telefone,email:pedido.dados.email,observacoes:pedido.dados.observacoes,condicoes:pedido.dados.condicoes,obra:obra.obra,projeto:obra.projeto,cliente:pedido.dados.incluir_cliente?obra.cliente:'',endereco:obra.endereco??'',itens:itens.map(i=>({codigo:i.codigo,servico:servicoCompleto(i),escopo:edicoes.get(i.id)!.escopo,observacao:edicoes.get(i.id)!.observacao,unidade:i.unidade.trim(),quantidade:i.quantidade,pavimento:i.pavimento.trim(),ambiente:i.ambiente.trim(),etapa:p.grupos.find(g=>g.codigo===i.grupo)?.nome??''}))});
}
export const temPendencias=(d:DocumentoExterno)=>d.itens.some(i=>i.quantidade===null||!i.unidade.trim());
export const textoServico=(i:DocumentoExterno['itens'][number])=>[i.servico,i.escopo,i.observacao].filter(Boolean).join('\n');
export const dataExterna=(iso:string)=>iso?iso.split('-').reverse().join('/'):'';
export function gruposExternos(d:DocumentoExterno){
 const grupos=new Map<string,{rotulo:string;itens:DocumentoExterno['itens']}>();
 for(const i of d.itens){const partes=i.pavimento||i.ambiente?[i.pavimento,i.ambiente]:[i.etapa];const key=JSON.stringify(partes);if(!grupos.has(key))grupos.set(key,{rotulo:partes.filter(Boolean).join(' / '),itens:[]});grupos.get(key)!.itens.push(i);}
 const pisos=new Map<string,number>();for(const [key] of grupos){const partes=JSON.parse(key) as string[];const piso=partes.length===2?'local:'+partes[0]:'etapa:'+partes[0];if(!pisos.has(piso))pisos.set(piso,pisos.size);}
 return [...grupos.entries()].sort(([a],[b])=>{const pa=JSON.parse(a) as string[],pb=JSON.parse(b) as string[];return pisos.get((pa.length===2?'local:':'etapa:')+pa[0])!-pisos.get((pb.length===2?'local:':'etapa:')+pb[0])!;}).map(([,g])=>g);
}

import { z } from 'zod';
export const NOME_SBC='SBC · Cuiabá/MT · 09/2026 · Relatório importado';
export const VERSAO_SBC='pdfs-5431a82b-71a0cf4f';
export const FONTES_SBC={
 composicao:{nome:'Informativo SBC _ O melhor banco de composições analíticas COMPOSIÇÕES.pdf',sha256:'5431a82bf9cc76a98272e141e667600c2b3d3e37a10a408abab7a6ad28a32636'},
 insumo:{nome:'Informativo SBC _ O melhor banco de composições analíticas ISUMOS.pdf',sha256:'71a0cf4fc26db2f7786fda092952c96cc5e24a597b6cc5e323aa7f2eb6e414fa'},
} as const;
export const provenienciaSbcSchema=z.object({fonte:z.literal('SBC'),regiao:z.literal('CBA - Cuiabá - MT'),cidade:z.literal('Cuiabá'),uf:z.literal('MT'),atualizacao:z.literal('01/09/2026'),competencia:z.literal('09/2026'),natureza:z.literal('relatório importado'),documento:z.string().max(200),documento_sha256:z.string().regex(/^[a-f0-9]{64}$/),pagina:z.number().int().min(1).max(4),tipo:z.enum(['composicao','insumo']),preco_original:z.string().regex(/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/)}).strict();
export function centavosSbc(texto:string){if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(texto))throw Error('Preço SBC inválido.');const [i,f]=texto.replace(/\./g,'').split(',');const value=BigInt(i)*100n+BigInt(f);if(value>100000000000n)throw Error('Preço SBC excede limite.');return Number(value);}
export function itemSbcValido(i:{tipo:string;codigo:string;classificacao:string;preco_centavos:number|null;metadados?:unknown;sicro?:unknown;preco_nao_desonerado_centavos?:unknown;preco_desonerado_centavos?:unknown}){
 const p=provenienciaSbcSchema.safeParse(i.metadados);if(!p.success||i.tipo!==p.data.tipo||!/^\d+$/.test(i.codigo)||i.classificacao!==''||i.sicro||i.preco_nao_desonerado_centavos!==undefined||i.preco_desonerado_centavos!==undefined)return false;
 const fonte=FONTES_SBC[p.data.tipo];return p.data.documento===fonte.nome&&p.data.documento_sha256===fonte.sha256&&centavosSbc(p.data.preco_original)===i.preco_centavos;
}

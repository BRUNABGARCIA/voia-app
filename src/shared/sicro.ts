import { z } from 'zod';

// Decimal text is authoritative. Neither IEEE floats nor centavos represent all SICRO costs.
export const decimalSicroSchema=z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,30})?$/);
export const custoSicroSchema=z.object({
 tipo:z.string().min(1).max(100),rotulo:z.string().min(1).max(150),valor:decimalSicroSchema.nullable(),
 unidade:z.string().min(1).max(30),edicao:z.string().max(100),selecionavel:z.boolean(),
 arquivo:z.string().min(1).max(200),sha256:z.string().regex(/^[a-f0-9]{64}$/),aba:z.string().min(1).max(100),
 linhas:z.array(z.number().int().positive()).min(1).max(100),coluna:z.string().max(4),
}).strict();
export const referenciaSicroSchema=z.object({subtipo:z.enum(['composicao','material','equipamento','mao_de_obra']),custos:z.array(custoSicroSchema).min(1).max(40)}).strict();
export const sicroItemSchema=referenciaSicroSchema.extend({memorias:z.array(z.object({arquivo:z.string().max(200),sha256:z.string().regex(/^[a-f0-9]{64}$/),aba:z.string().max(100),linha:z.number().int().positive(),dados:z.string().max(250000)}).strict()).max(6)}).strict();
export type CustoSicro=z.infer<typeof custoSicroSchema>;
export type ReferenciaSicro=z.infer<typeof referenciaSicroSchema>;
export const chaveCustoSicro=(c:CustoSicro)=>JSON.stringify([c.tipo,c.edicao]);
export function formatarDecimalSicro(valor:string|null){if(valor===null)return 'Sem preço';const [inteiro,fracao='']=valor.split('.');return 'R$ '+inteiro.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+fracao.padEnd(2,'0');}
/** Explicit adoption only: integer arithmetic, half-up to centavos. */
export function centavosSicro(valor:string|null):number|null{if(valor===null)return null;decimalSicroSchema.parse(valor);const [i,f='']=valor.split('.');const n=BigInt(i)*100n+BigInt(f.padEnd(2,'0').slice(0,2))+(Number(f[2]??0)>=5?1n:0n);if(n>100000000000n)throw Error('Preço adotado fora do limite.');return Number(n);}

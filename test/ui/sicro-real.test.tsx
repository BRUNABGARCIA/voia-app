import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {importarSicro} from '../../src/react-app/lib/importar-sicro';

it.skipIf(!process.env.VOIA_SICRO_DIR)('pacote oficial SICRO é normalizado somente em memória, sem perda de zeros, ausências ou edições',async()=>{
 const dir=process.env.VOIA_SICRO_DIR!;const r=await importarSicro(readdirSync(dir).filter(n=>n.endsWith('.xlsx')).map(nome=>({nome,bytes:new Uint8Array(readFileSync(join(dir,nome)))})));
 expect(r.itens).toHaveLength(9017);expect(new Set(r.itens.map(i=>i.codigo)).size).toBe(9017);expect(r.repeticoes).toBe(42);
 expect(r.itens.filter(i=>i.sicro?.subtipo==='composicao')).toHaveLength(6619);
 expect(r.itens.filter(i=>i.sicro?.subtipo==='material'&&i.sicro.custos[0].valor===null)).toHaveLength(68);
 expect(r.itens.filter(i=>i.sicro?.subtipo==='composicao'&&Number(i.sicro.custos[0].valor)===0).map(i=>i.codigo)).toEqual(['0307730','1110000','4900001','4915801']);
 const eq=r.itens.find(i=>i.codigo==='A9335')!;expect(eq.sicro?.custos).toHaveLength(18);expect(eq.sicro?.custos.every(c=>c.linhas.length===2)).toBe(true);
 expect(r.itens.find(i=>i.codigo==='E9001')?.sicro?.custos.filter(c=>c.selecionavel).map(c=>c.valor)).toEqual(['19.4563','11.7933','19.4563','11.7933']);
 expect(r.itens.reduce((n,i)=>n+i.sicro!.custos.length,0)).toBe(18495);
},180000);

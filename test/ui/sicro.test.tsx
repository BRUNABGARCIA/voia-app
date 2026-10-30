import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import CustosSicro from '../../src/react-app/components/CustosSicro';
import {lerSicro} from '../../src/react-app/lib/importar-sicro';
import {zipSync,strToU8} from 'fflate';
afterEach(cleanup);
const custo=(tipo:string,valor:string|null)=>({tipo,rotulo:tipo,valor,unidade:'h',edicao:'publicada',selecionavel:true,arquivo:'fixture.xlsx',sha256:'a'.repeat(64),aba:'Sheet1',linhas:[2],coluna:'J'});
it('equipamento mostra custos separados, precisão, zero e escolha explícita',()=>{const fn=vi.fn();render(<CustosSicro referencia={{subtipo:'equipamento',custos:[custo('produtivo','19.4563'),custo('improdutivo','0')]}} onEscolher={fn}/>);expect(screen.getByText('R$ 19,4563')).toBeTruthy();expect(screen.getByText('R$ 0,00')).toBeTruthy();const select=screen.getByLabelText('Custo de referência SICRO') as HTMLSelectElement;expect(select.value).toBe('');expect(fn).not.toHaveBeenCalled();fireEvent.change(select,{target:{value:'["improdutivo","publicada"]'}});expect(fn).toHaveBeenCalledWith('["improdutivo","publicada"]');});
it('material sem preço não aparece como zero',()=>{render(<CustosSicro referencia={{subtipo:'material',custos:[custo('preco_unitario',null)]}}/>);expect(screen.getByText('Sem preço')).toBeTruthy();expect(screen.queryByText('R$ 0,00')).toBeNull();});
function xlsx(cells:string){return {nome:'fixture.xlsx',bytes:zipSync({'xl/workbook.xml':strToU8('<workbook><sheets><sheet name="Sheet1"/></sheets></workbook>'),'xl/worksheets/sheet1.xml':strToU8('<worksheet><sheetData><row r="1">'+cells+'</row></sheetData></worksheet>')})};}
it('leitor preserva zero, precisão lexical e células vazias/omitidas sem deslocar',async()=>{const r=await lerSicro(xlsx('<c r="A1"><v>0</v></c><c r="B1"/><c r="D1"><v>19.456300000000001</v></c>'));expect(r.linhas[0][0]).toBe('0');expect(r.linhas[0][1]).toBeNull();expect(r.linhas[0][2]).toBeUndefined();expect(r.linhas[0][3]).toBe('19.456300000000001');});
it('leitor não executa fórmulas',async()=>{await expect(lerSicro(xlsx('<c r="A1"><f>1+1</f><v>2</v></c>'))).rejects.toThrow('Fórmula');});

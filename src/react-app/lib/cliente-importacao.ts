import type {ManifestoBase,ArquivoBase,resumoBase} from '../../shared/importacao-assistida';
import type {BaseItem} from '../../shared/bases-servicos';
export type AnaliseBase={manifesto:ManifestoBase;resumo:ReturnType<typeof resumoBase>;amostra:BaseItem[];avisos?:string[]}|{ufs:string[];competencia:string};
export function clienteImportacao(){
 const worker=new Worker(new URL('./analisar-base.worker.ts',import.meta.url),{type:'module'});let seq=0;const pending=new Map<number,{resolve:(x:unknown)=>void;reject:(e:Error)=>void;progress?:(s:string)=>void;timer:ReturnType<typeof setTimeout>}>();
 function cancel(){worker.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Análise interrompida. Nenhum dado foi gravado.'));}pending.clear();}
 worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;if(e.data.progresso){p.progress?.(e.data.progresso);return;}clearTimeout(p.timer);pending.delete(e.data.id);if(e.data.error)p.reject(Error(e.data.error));else p.resolve(e.data.result);};worker.onerror=()=>cancel();
 function request<T>(data:object,progress?:(s:string)=>void,transfer:Transferable[]=[]){return new Promise<T>((resolve,reject)=>{const id=++seq;pending.set(id,{resolve:x=>resolve(x as T),reject,progress,timer:setTimeout(()=>{cancel();reject(Error('A análise excedeu cinco minutos. Tente arquivos menores.'));},300000)});worker.postMessage({id,...data},transfer);});}
 return {analisar:(files:ArquivoBase[],uf:string|undefined,p:(s:string)=>void)=>request<AnaliseBase>({acao:'analisar',files,uf},p,files.map(f=>f.bytes.buffer as ArrayBuffer)),lote:(indice:number)=>request<BaseItem[]>({acao:'lote',indice}),cancel};
}

export async function catalogoApi<T>(path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T>{
 const r=await fetch('/api/catalogo-servicos'+path,{method,credentials:'same-origin',signal,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const d=await r.json();if(!r.ok)throw Error(d.error??'Operação não concluída.');return d as T;
}

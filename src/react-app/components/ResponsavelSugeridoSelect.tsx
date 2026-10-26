import { useRef, useState } from 'react';

export default function ResponsavelSugeridoSelect({valor,nome,alterar}:{valor:number|null|undefined;nome?:string|null;alterar:(id:number|null)=>void}) {
  const [usuarios,setUsuarios]=useState<{id:number;nome:string}[]>([]),[erro,setErro]=useState<string|null>(null);const carregando=useRef(false);
  async function carregar(){if(carregando.current||usuarios.length)return;carregando.current=true;setErro(null);try{const r=await fetch('/api/usuarios/opcoes',{credentials:'same-origin'});if(!r.ok)throw new Error();const d=await r.json();setUsuarios(d.usuarios);}catch{setErro('Não foi possível carregar os responsáveis.');}finally{carregando.current=false;}}
  return <label className="text-sm">Responsável<select className="ml-2 rounded-lg border p-2" value={valor||''} onFocus={carregar} onChange={e=>alterar(e.target.value?Number(e.target.value):null)}><option value="">Sem responsável</option>{valor&&!usuarios.some(u=>u.id===valor)&&<option value={valor}>{nome||'Responsável selecionado'}</option>}{usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select>{erro&&<span role="alert" className="block text-xs text-red-700">{erro}</span>}</label>;
}

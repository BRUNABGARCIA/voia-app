import { useContext, useState } from 'react';
import { AuthContext } from '../contexts/auth-context';
import { incorporarModelo, type ModeloPlano } from '../lib/plano-trabalho';
import type { Rascunho } from '../lib/novo-trabalho';

export default function ModeloServicoSugerido({r,alterar}:{r:Rascunho;alterar:(r:Rascunho)=>void}) {
  const auth=useContext(AuthContext),[tipos,setTipos]=useState<{id:number;nome:string}[]|null>(null),[erro,setErro]=useState<string|null>(null),[ocupado,setOcupado]=useState(false);
  if(auth?.user?.perfil!=='administrador')return null;
  async function carregar(){setOcupado(true);setErro(null);try{const res=await fetch('/api/projetos/tipos-servico',{credentials:'same-origin'});if(!res.ok)throw new Error();const d=await res.json();setTipos(d.tiposServico);}catch{setErro('Não foi possível carregar os tipos de serviço.');}finally{setOcupado(false);}}
  async function aplicar(id:string){if(!id)return;setOcupado(true);setErro(null);try{const res=await fetch(`/api/tipos-servico/${id}/modelo`,{credentials:'same-origin'});if(!res.ok)throw new Error();const d=await res.json() as {etapasModelo:ModeloPlano[]};alterar(incorporarModelo(r,Number(id),d.etapasModelo));}catch{setErro('Não foi possível ler o modelo autorizado deste serviço.');}finally{setOcupado(false);}}
  return <div className="space-y-2 text-sm"><p>Se houver um modelo de processo configurado, você pode acrescentá-lo como sugestão e revisar suas etapas. Prazos relativos e responsáveis padrão não serão presumidos.</p>{tipos?<label>Modelo de serviço<select className="ml-2 rounded border p-2" value="" disabled={ocupado} onChange={e=>aplicar(e.target.value)}><option value="">Escolha para revisar</option>{tipos.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>:<button type="button" disabled={ocupado} onClick={carregar}>Consultar modelos de serviço existentes</button>}{erro&&<p role="alert" className="text-red-700">{erro}</p>}</div>;
}

import { provenienciaSbcSchema } from '../../shared/sbc';
export default function ProvenienciaSbc({metadados}:{metadados?:string|null}){
 let raw:unknown;try{raw=JSON.parse(metadados??'null');}catch{return null;}const p=provenienciaSbcSchema.safeParse(raw);if(!p.success)return null;const m=p.data;
 return <div className="sicro-custos"><small>Relatório importado · {m.regiao} · atualização {m.atualizacao}</small><small>{m.documento} · página {m.pagina}</small><small>SHA-256: {m.documento_sha256}</small><small>O conjunto importado não comprova a completude do catálogo SBC.</small></div>;
}

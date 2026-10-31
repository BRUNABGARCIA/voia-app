import {DOMParser as XmlParser} from '@xmldom/xmldom';
import {analisarBase} from './analisar-base';
import type {BaseItem} from '../../shared/bases-servicos';
// Cloudflare Workers have no browser DOM. Parsing stays in this dedicated browser
// worker; XML is inert and the existing source readers reject DTDs and formulas.
Object.defineProperty(self,'DOMParser',{value:class extends XmlParser{constructor(){super({onError:(_level,message)=>{throw Error(message);}})}}});
let lotes:BaseItem[][]=[];
self.onmessage=async(e:MessageEvent)=>{const {id,acao,files,uf,indice}=e.data;try{if(acao==='lote'){self.postMessage({id,result:lotes[indice]});return;}lotes=[];const r=await analisarBase(files,uf,s=>self.postMessage({id,progresso:s}));if(r.lotes){lotes=r.lotes;const {lotes:_,...preview}=r;void _;self.postMessage({id,result:preview});}else self.postMessage({id,result:r});}catch(err){self.postMessage({id,error:(err as Error).message});}};

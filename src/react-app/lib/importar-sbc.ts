import { baseItemSchema,type BaseItem } from '../../shared/bases-servicos';
import { FONTES_SBC,centavosSbc } from '../../shared/sbc';
type TextoPdf={str:string;x:number;y:number};
export type PaginaSbc={pagina:number;textos:TextoPdf[]};
const sha=async(b:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b as BufferSource))).map(v=>v.toString(16).padStart(2,'0')).join('');
/** Layout-specific extraction. Numeric descriptions never join the code column. */
export function extrairPaginasSbc(paginas:PaginaSbc[],tipo:'composicao'|'insumo',contexto?:{regiao:string;cidade:string;uf:string;atualizacao:string;competencia:string;documento:string;sha256:string}):BaseItem[]{
 if(!contexto&&paginas.length!==4)throw Error('SBC auditado exige quatro páginas PDF.');
 const first=paginas[0].textos.map(t=>t.str).join(' ');if(!first.includes(tipo==='composicao'?'Composições':'Insumos')||!first.includes(contexto?.regiao??'CBA - Cuiabá - MT')||!first.includes(contexto?.atualizacao??'01/09/2026'))throw Error('Identidade/região/atualização SBC não conferem.');
 const bounds=tipo==='composicao'?[90,126,417,453,520]:[90,121,437,466,520];const fonte=FONTES_SBC[tipo],itens:BaseItem[]=[];let totalImpresso=0;const declared=[...paginas.flatMap(p=>p.textos.map(t=>t.str)).join(' ').matchAll(new RegExp('Listados\\s+(\\d+)\\s+'+(tipo==='composicao'?'composições':'insumos'),'g'))];const esperado=contexto?Number(declared[0]?.[1]):200;if(!esperado||declared.length!==1)throw Error('Contagem impressa SBC ausente ou ambígua.');
 for(const p of paginas){
  const anchors=p.textos.filter(t=>t.x>=bounds[0]&&t.x<bounds[1]&&/^\d+$/.test(t.str)).sort((a,b)=>b.y-a.y);
  totalImpresso+=p.textos.filter(t=>t.str.includes(`Listados ${esperado} ${tipo==='composicao'?'composições':'insumos'}`)).length;
  for(let n=0;n<anchors.length;n++){
   const a=anchors[n],top=n?(anchors[n-1].y+a.y)/2:a.y+10,bottom=n+1<anchors.length?(a.y+anchors[n+1].y)/2:a.y-10;
   const cells=bounds.slice(0,-1).map((x,k)=>{const lines=new Map<number,TextoPdf[]>();for(const t of p.textos.filter(t=>t.x>=x&&t.x<bounds[k+1]&&t.y<=top&&t.y>bottom)){const y=Math.round(t.y*10)/10;lines.set(y,[...(lines.get(y)??[]),t]);}return [...lines.entries()].sort((a,b)=>b[0]-a[0]).map(([,v])=>v.sort((a,b)=>a.x-b.x).map(t=>t.str).join('').trim()).join('\n');});
   const [codigo,descricao,unidade,preco]=cells;if(codigo!==a.str||!descricao||!unidade||/\uFFFD/.test(cells.join('')))throw Error('Registro SBC incompleto ou ambíguo.');
   itens.push(baseItemSchema.parse({codigo,descricao,unidade,preco_centavos:centavosSbc(preco),tipo,metadados:{fonte:'SBC',regiao:contexto?.regiao??'CBA - Cuiabá - MT',cidade:contexto?.cidade??'Cuiabá',uf:contexto?.uf??'MT',atualizacao:contexto?.atualizacao??'01/09/2026',competencia:contexto?.competencia??'09/2026',natureza:'relatório importado',documento:contexto?.documento??fonte.nome,documento_sha256:contexto?.sha256??fonte.sha256,pagina:p.pagina,tipo,preco_original:preco}}));
  }
 }
 if(totalImpresso!==1||itens.length!==esperado||new Set(itens.map(i=>i.codigo)).size!==esperado)throw Error('Contagem/identidade SBC divergente: esperado 200 por relatório.');return itens;
}
export async function importarSbc(arquivos:{nome:string;bytes:Uint8Array}[],mensal=false){
 if(arquivos.length!==2)throw Error('Selecione exatamente os dois PDFs SBC auditados.');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const {default:workerUrl}=await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
 const itens:BaseItem[]=[];const manifest=[];let contextoAnterior='';
 for(const tipo of ['composicao','insumo'] as const){const fonte=FONTES_SBC[tipo],files=mensal?[arquivos[['composicao','insumo'].indexOf(tipo)]]:arquivos.filter(f=>f.nome===fonte.nome);if(files.length!==1||files[0].bytes.length>5*1024*1024)throw Error('Arquivo SBC ausente, repetido ou maior que 5 MiB.');const digest=await sha(files[0].bytes);if(!mensal&&digest!==fonte.sha256)throw Error('SHA-256 não corresponde ao PDF SBC auditado.');
  const native=typeof Worker!=='undefined'?new Worker(workerUrl,{type:'module'}):undefined;const worker=native?pdfjs.PDFWorker.create({port:native}):undefined;const task=pdfjs.getDocument({data:files[0].bytes.slice(),worker,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,disableAutoFetch:true});
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{const paginas=await Promise.race([(async()=>{const doc=await task.promise;if(doc.numPages>100||(!mensal&&doc.numPages!==4))throw Error('Número de páginas SBC divergente.');const pages:PaginaSbc[]=[];for(let pagina=1;pagina<=doc.numPages;pagina++){const page=await doc.getPage(pagina),text=await page.getTextContent();pages.push({pagina,textos:text.items.flatMap(t=>'str'in t&&t.str.trim()?[{str:t.str,x:t.transform[4],y:t.transform[5]}]:[])});page.cleanup();}return pages;})(),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(Error('Extração SBC excedeu 30 segundos.')),30000);})]);const first=paginas[0].textos.map(t=>t.str).join(' '),region=/([A-Z]{3})\s*-\s*([^\d]+?)\s*-\s*([A-Z]{2})\b/.exec(first),date=/\b(\d{2}\/(?:0[1-9]|1[0-2])\/20\d{2})\b/.exec(first);if(mensal&&(!region||!date))throw Error('Região ou atualização SBC não identificada.');const ctx=mensal?{regiao:region![1]+' - '+region![2].trim()+' - '+region![3],cidade:region![2].trim(),uf:region![3],atualizacao:date![1],competencia:date![1].slice(3),documento:files[0].nome,sha256:digest}:undefined;const tipoReal=mensal?(first.includes('Composições')?'composicao':first.includes('Insumos')?'insumo':null):tipo;if(!tipoReal)throw Error('Tipo de relatório SBC não identificado.');const identity=ctx?JSON.stringify([ctx.regiao,ctx.atualizacao]):'';if(contextoAnterior&&contextoAnterior!==identity)throw Error('Os PDFs SBC têm regiões ou datas divergentes.');contextoAnterior=identity;itens.push(...extrairPaginasSbc(paginas,tipoReal,ctx));manifest.push({tipo:tipoReal,arquivo:files[0].nome,sha256:digest});}
  finally{clearTimeout(timeout);await task.destroy();worker?.destroy();native?.terminate();}
 }
 if(new Set(manifest.map(m=>m.tipo)).size!==2)throw Error('Forneça um relatório de composições e um de insumos.');
 return {itens,manifesto:manifest,arquivo_hash:await sha(new TextEncoder().encode(JSON.stringify(manifest)))};
}

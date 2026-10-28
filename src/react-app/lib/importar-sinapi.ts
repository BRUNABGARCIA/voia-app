import { Unzip, UnzipInflate } from 'fflate';
import { baseItemSchema, precoImportado, type BaseItem } from '../../shared/bases-servicos';
import { normalizarBusca } from '../../shared/planilhas';

const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function documento(s:string){if(/<!DOCTYPE|<!ENTITY|\uFFFD/.test(s))throw Error('XML SINAPI inválido.');const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('XML SINAPI malformado.');return d;}
/** Only selected ZIP entries are decompressed; unrelated analytical sheets are never parsed. */
async function partes(bytes:Uint8Array,permitidas:Set<string>){
 if(bytes.length>20*1024*1024)throw Error('XLSX deve ter até 20 MiB.');
 const resultado=new Map<string,string>(),vistos=new Set<string>();let total=0,erro:Error|null=null,entradas=0;
 const unzip=new Unzip(e=>{if(++entradas>300||e.name.includes('..')||e.name.startsWith('/')||/vbaProject|externalLinks/i.test(e.name)){erro=Error('Estrutura XLSX não permitida.');return;}if(!permitidas.has(e.name))return;if(vistos.has(e.name)){erro=Error('Parte XLSX duplicada.');return;}vistos.add(e.name);const chunks:Uint8Array[]=[];let tamanho=0;
 e.ondata=(falha,data,final)=>{if(falha){erro=falha;return;}total+=data.length;tamanho+=data.length;if(total>64*1024*1024||tamanho>30*1024*1024){erro=Error('Abas selecionadas excedem o limite seguro. Importe composições e insumos separadamente.');e.terminate();return;}chunks.push(data.slice());if(final){const all=new Uint8Array(tamanho);let n=0;for(const c of chunks){all.set(c,n);n+=c.length;}try{resultado.set(e.name,new TextDecoder('utf-8',{fatal:true}).decode(all));}catch{erro=Error('XML não está em UTF-8.');}}};e.start();});unzip.register(UnzipInflate);
 for(let n=0;n<bytes.length;n+=4096){unzip.push(bytes.subarray(n,n+4096),n+4096>=bytes.length);if(erro)throw erro;if(n%262144===0)await new Promise(r=>setTimeout(r,0));}if(erro)throw erro;for(const path of permitidas)if(vistos.has(path)&&!resultado.has(path))throw Error('XLSX incompleto.');return resultado;
}
export type EstruturaSinapi={abas:string[];paths:Record<string,string>};
export async function detectarSinapi(bytes:Uint8Array):Promise<EstruturaSinapi|null>{
 const p=await partes(bytes,new Set(['xl/workbook.xml','xl/_rels/workbook.xml.rels']));if(!p.get('xl/workbook.xml')||!p.get('xl/_rels/workbook.xml.rels'))throw Error('Workbook ausente.');const wb=documento(p.get('xl/workbook.xml')!),rels=documento(p.get('xl/_rels/workbook.xml.rels')!),map=new Map<string,string>();
 for(const r of Array.from(rels.getElementsByTagNameNS('*','Relationship'))){if(r.getAttribute('TargetMode')==='External')throw Error('Referência externa não permitida.');const t=r.getAttribute('Target')??'';if(t.includes('..'))throw Error('Caminho de aba inválido.');map.set(r.getAttribute('Id')??'',t.startsWith('/xl/')?t.slice(1):'xl/'+t);}
 const paths:Record<string,string>={};for(const s of Array.from(wb.getElementsByTagNameNS('*','sheet'))){const nome=s.getAttribute('name')??'',id=s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')??'';if(map.has(id))paths[nome]=map.get(id)!;}
 return ['CSD','CCD','ISD','ICD'].some(n=>paths[n])?{abas:Object.keys(paths),paths}:null;
}
type Valor={valor:string|number;formula:string|null};
export async function importarSinapi(bytes:Uint8Array,estrutura:EstruturaSinapi,uf:string,competencia:string,entidade:'composicao'|'insumo'){
 if(!/^[A-Z]{2}$/.test(uf)||!/^\d{2}\/20\d{2}$/.test(competencia))throw Error('Confirme UF e competência da base.');
 const nomes=entidade==='composicao'?['CSD','CCD']:['ISD','ICD'];if(!nomes.some(n=>estrutura.paths[n]))throw Error('Abas da entidade selecionada ausentes.');
 const selecionadas=nomes.filter(n=>estrutura.paths[n]),p=await partes(bytes,new Set([...selecionadas.map(n=>estrutura.paths[n]),'xl/sharedStrings.xml']));
 const sd=p.get('xl/sharedStrings.xml'),strings=sd?Array.from(documento(sd).getElementsByTagNameNS('*','si'),s=>Array.from(s.getElementsByTagNameNS('*','t'),t=>t.textContent??'').join('')):[];
 const itens=new Map<string,BaseItem>(),invalidos:{linha:number;erro:string}[]=[];
 for(const nome of selecionadas){const raw=p.get(estrutura.paths[nome]);if(!raw)throw Error(`Aba ${nome} ausente.`);if(/<!DOCTYPE|<!ENTITY|\uFFFD/.test(raw))throw Error('XML SINAPI inválido.');let coluna=-1,cabecalho=false,referencia=false,regime=false,linhas=0;const vistos=new Set<string>();let ultimaUf:Record<string,Valor>={};
  // Parse one row at a time and discard other UFs before DOM allocation.
  for(const match of raw.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)){if(++linhas>50050)throw Error('Aba excede 50 mil registros.');const r=match[0],numero=Number(r.match(/\br="(\d+)"/)?.[1]??linhas);
   const cells:Record<string,Valor>={};const fragmentos=Array.from(r.matchAll(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g),m=>m[0]).filter(c=>{const col=c.match(/\br="([A-Z]+)\d+"/)?.[1]??'';if(!col||col.length>2)throw Error('Endereço inválido.');if(!cabecalho)return true;return ['A','B','C','D','E',letraColuna(coluna),letraColuna(coluna+1)].includes(col);});
   const d=documento(`<row xmlns="${NS}">${fragmentos.join('')}</row>`);for(const c of Array.from(d.getElementsByTagNameNS('*','c'))){const col=c.getAttribute('r')?.match(/^[A-Z]+/)?.[0];if(!col)continue;const t=c.getAttribute('t'),v=c.getElementsByTagNameNS('*','v')[0]?.textContent??'',formula=c.getElementsByTagNameNS('*','f')[0]?.textContent??null;if(t==='e')throw Error('Célula com erro na fonte.');const valor=t==='s'?strings[Number(v)]??'':t==='inlineStr'?Array.from(c.getElementsByTagNameNS('*','t'),t=>t.textContent??'').join(''):v!==''&&(!t||t==='n')?Number(v):v;cells[col]={valor,formula};}
   const vals=Object.values(cells).map(c=>String(c.valor)),titulo=normalizarBusca(vals.join(' '));
   if(!cabecalho){if(vals.includes(competencia))referencia=true;if(titulo.includes('relatorio')&&(entidade==='composicao'?titulo.includes('composico'):titulo.includes('insumos'))&&(nome.endsWith('SD')?titulo.includes('sem desoneracao'):titulo.includes('com desoneracao')))regime=true;
    if(Object.values(cells).some(c=>normalizarBusca(String(c.valor)).replace(/\s+/g,' ').includes(entidade==='composicao'?'codigo da composicao':'codigo do insumo'))){const ufrow=entidade==='insumo'?cells:ultimaUf;const col=Object.entries(ufrow).filter(([,v])=>v.valor===uf);if(col.length!==1)throw Error(`UF ${uf} ausente ou ambígua em ${nome}.`);coluna=indiceColuna(col[0][0]);cabecalho=true;if(!referencia||!regime)throw Error(`Competência ou regime de ${nome} não confere com a base.`);}else if(vals.includes(uf)){ultimaUf=cells;}continue;
   }
   if(!cells.B||String(cells.B.valor).trim()==='')continue;
   try{const b=cells.B;let codigo=String(b.valor).trim();if(b.formula){const m=b.formula.match(/^HYPERLINK\("#"&CELL\("address",OFFSET\([^,]+,MATCH\((\d+),[^,]+,0\)-1,3\)\),(\d+)\)$/i);if(!m||m[1]!==m[2]||(String(b.valor)!==m[1]&&b.valor!==0))throw Error('Fórmula de código não reconhecida ou cache divergente.');codigo=m[1];}if(!/^\d+$/.test(codigo))throw Error('Código SINAPI inválido.');codigo=String(Number(codigo));if(vistos.has(codigo))throw Error('Código repetido na mesma aba.');vistos.add(codigo);
    const price=cells[letraColuna(coluna)];if(price?.formula)throw Error('Preço contém fórmula; não executado.');const parsed=precoImportado(price?.valor??'','br'),preco=parsed===0?null:parsed;
    const desc=String(cells.C?.valor??'').trim(),un=String(cells.D?.valor??'').trim();if(cells.C?.formula||cells.D?.formula)throw Error('Descrição/unidade com fórmula.');
    const anterior=itens.get(codigo);if(anterior&&(anterior.descricao!==desc||anterior.unidade!==un))throw Error('Descrição/unidade conflitante entre regimes.');
    const campo=nome.endsWith('SD')?'preco_nao_desonerado_centavos':'preco_desonerado_centavos';const meta=anterior?.metadados??{};
    const item=baseItemSchema.parse({...anterior,codigo,descricao:desc,unidade:un,tipo:entidade,preco_centavos:null,preco_nao_desonerado_centavos:anterior?.preco_nao_desonerado_centavos??null,preco_desonerado_centavos:anterior?.preco_desonerado_centavos??null,[campo]:preco,metadados:{...meta,[`${nome}_classificacao`]:String(cells.A?.valor??''),[`${nome}_origem_preco`]:entidade==='insumo'?String(cells.E?.valor??''):'',...entidade==='composicao'?{[`${nome}_percentual_AS`]:cells[letraColuna(coluna+1)]?.valor??null}:{},[`${nome}_linha`]:numero,[`${nome}_preco_original`]:price?.valor??null}});itens.set(codigo,item);
   }catch(e){invalidos.push({linha:numero,erro:`${nome}: ${(e as Error).message}`});}if(linhas%500===0)await new Promise(r=>setTimeout(r,0));
  }if(!cabecalho)throw Error(`Cabeçalho oficial não reconhecido em ${nome}.`);ultimaUf={};
 }
 return {itens:[...itens.values()],invalidos};
}
function indiceColuna(s:string){let n=0;for(const c of s)n=n*26+c.charCodeAt(0)-64;return n-1;}
function letraColuna(n:number):string{return n<26?String.fromCharCode(65+n):letraColuna(Math.floor(n/26)-1)+letraColuna(n%26);}

import { Unzip, UnzipInflate } from 'fflate';
import { baseItemSchema, chaveItem, precoImportado, type BaseItem } from '../../shared/bases-servicos';
export type CelulaBase={valor:string|number;formula:boolean};
export type AbaImportacao={nome:string;linhas:CelulaBase[][]};
const vazio=():CelulaBase=>({valor:'',formula:false});
function xml(bytes:Uint8Array){const s=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(/<!DOCTYPE|<!ENTITY|\uFFFD/.test(s))throw Error('XML inválido ou com declarações externas.');const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('XML malformado.');return d;}
export async function lerXlsxBase(bytes:Uint8Array):Promise<AbaImportacao[]>{
 if(!bytes.length||bytes.length>20*1024*1024)throw Error('XLSX deve ter até 20 MiB.');
 const partes=new Map<string,Uint8Array[]>(),finais=new Set<string>();let total=0,erro:Error|null=null,entradas=0;
 const unzip=new Unzip(e=>{
   if(++entradas>300||e.name.includes('..')||e.name.startsWith('/')||/vbaProject|externalLinks/i.test(e.name)){erro=Error('Estrutura XLSX não permitida.');return;}
   if(!/^xl\/(?:worksheets\/sheet\d+\.xml|sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels)$/.test(e.name))return;
   if(partes.has(e.name)){erro=Error('Parte XLSX duplicada.');return;}if((e.originalSize??0)>30*1024*1024){erro=Error('Parte XLSX excede 30 MiB.');return;}
   partes.set(e.name,[]);let tamanho=0;
   e.ondata=(falha,data,final)=>{if(falha){erro=falha;return;}tamanho+=data.length;total+=data.length;if(total>60*1024*1024||tamanho>30*1024*1024){erro=Error('XLSX descompactado excede o limite.');e.terminate();return;}partes.get(e.name)!.push(data.slice());if(final)finais.add(e.name);};e.start();
 });unzip.register(UnzipInflate);
 for(let n=0;n<bytes.length;n+=1024){unzip.push(bytes.subarray(n,n+1024),n+1024>=bytes.length);if(erro)throw erro;if(n%65536===0)await new Promise(r=>setTimeout(r,0));}
 const docs=new Map<string,Document>();for(const [nome,chunks] of partes){if(!finais.has(nome))throw Error('XLSX incompleto.');const b=new Uint8Array(chunks.reduce((s,c)=>s+c.length,0));let n=0;for(const c of chunks){b.set(c,n);n+=c.length;}docs.set(nome,xml(b));}
 const wb=docs.get('xl/workbook.xml'),rels=docs.get('xl/_rels/workbook.xml.rels');if(!wb||!rels)throw Error('Workbook XLSX ausente.');
 const relmap=new Map<string,string>();for(const r of Array.from(rels.getElementsByTagNameNS('*','Relationship'))){if(r.getAttribute('TargetMode')==='External')throw Error('Referência externa não permitida.');const target=r.getAttribute('Target')??'';relmap.set(r.getAttribute('Id')??'',target.startsWith('/xl/')?target.slice(1):'xl/'+target);}
 const strings=Array.from(docs.get('xl/sharedStrings.xml')?.getElementsByTagNameNS('*','si')??[],s=>Array.from(s.getElementsByTagNameNS('*','t'),t=>t.textContent??'').join(''));
 let celulas=0;const abas:AbaImportacao[]=[];
 for(const sheet of Array.from(wb.getElementsByTagNameNS('*','sheet'))){const path=relmap.get(sheet.getAttribute('r:id')??sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')??'');const d=path?docs.get(path):null;if(!d)continue;const linhas:CelulaBase[][]=[];
   for(const row of Array.from(d.getElementsByTagNameNS('*','row'))){const linha:CelulaBase[]=[];
    for(const c of Array.from(row.getElementsByTagNameNS('*','c'))){if(++celulas>600000)throw Error('XLSX excede 600 mil células.');const ref=c.getAttribute('r')??'';const letras=ref.match(/^[A-Z]+/)?.[0];if(!letras)throw Error('Endereço de célula inválido.');let col=0;for(const l of letras)col=col*26+l.charCodeAt(0)-64;if(col>64)throw Error('Aba possui mais de 64 colunas.');const tipo=c.getAttribute('t'),v=c.getElementsByTagNameNS('*','v')[0]?.textContent??'',f=c.getElementsByTagNameNS('*','f').length>0;
     let valor:string|number=tipo==='s'?(strings[Number(v)]??''):tipo==='inlineStr'?Array.from(c.getElementsByTagNameNS('*','t'),t=>t.textContent??'').join(''):v;
     if((!tipo||tipo==='n')&&v!==''&&Number.isFinite(Number(v)))valor=Number(v);if(tipo==='e')throw Error('XLSX contém célula com erro.');while(linha.length<col)linha.push(vazio());linha[col-1]={valor,formula:f};
    }linhas.push(linha);if(linhas.length>50010)throw Error('Aba excede 50 mil linhas.');
   }abas.push({nome:sheet.getAttribute('name')??path!,linhas});await new Promise(r=>setTimeout(r,0));
 }if(!abas.length)throw Error('Nenhuma aba tabular encontrada.');return abas;
}
export const CAMPOS_IMPORTACAO=['codigo','descricao','unidade','preco','preco_nao_desonerado','preco_desonerado','tipo','classificacao','grupo','categoria','subcategoria','tags','observacoes'] as const;
export type Mapeamento=Record<Exclude<typeof CAMPOS_IMPORTACAO[number],'preco_nao_desonerado'|'preco_desonerado'>,number>&Partial<Record<'preco_nao_desonerado'|'preco_desonerado',number>>;
export function mapearBase(aba:AbaImportacao,cabecalho:number,map:Mapeamento,formato:'br'|'decimal',tipoPadrao:BaseItem['tipo'],sinapi=false){
 const itens:BaseItem[]=[],invalidos:{linha:number;erro:string}[]=[],vistos=new Set<string>();
 aba.linhas.slice(cabecalho+1).forEach((row,n)=>{if(!row.some(c=>String(c.valor).trim()))return;try{
   const ler=(campo:typeof CAMPOS_IMPORTACAO[number])=>{const c=row[map[campo]??-1];if(c?.formula)throw Error('Campo mapeado contém fórmula; forneça valores conferidos.');return c?.valor??'';};
   const texto=(c:typeof CAMPOS_IMPORTACAO[number])=>String(ler(c)).trim();
   const tipo=texto('tipo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')||tipoPadrao;
   const i=baseItemSchema.parse({codigo:texto('codigo'),descricao:texto('descricao'),unidade:texto('unidade'),preco_centavos:sinapi?null:precoImportado(ler('preco'),formato),...(sinapi||(map.preco_nao_desonerado??-1)>=0||(map.preco_desonerado??-1)>=0?{preco_nao_desonerado_centavos:precoImportado(ler('preco_nao_desonerado'),formato)||null,preco_desonerado_centavos:precoImportado(ler('preco_desonerado'),formato)||null}:{}),tipo,classificacao:texto('classificacao'),grupo:texto('grupo'),categoria:texto('categoria'),subcategoria:texto('subcategoria'),tags:texto('tags'),observacoes:texto('observacoes')});
   if(Object.values(i).some(v=>typeof v==='string'&&/\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2[\u20ac\u2020]|\uFFFD/.test(v)))throw Error('Texto com possível mojibake; revise a fonte.');
   const key=chaveItem(i);if(vistos.has(key))throw Error('Identidade repetida no arquivo (código + tipo + classificação).');vistos.add(key);itens.push(i);
 }catch(e){invalidos.push({linha:cabecalho+n+2,erro:e instanceof Error?e.message:'Linha inválida'});}});
 return {itens,invalidos};
}

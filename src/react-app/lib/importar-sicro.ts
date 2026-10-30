import { unzipSync } from 'fflate';
import { baseItemSchema,type BaseItem } from '../../shared/bases-servicos';
import type { CustoSicro } from '../../shared/sicro';

type Fonte={nome:string;sha256:string;aba:string;linhas:(string|null)[][]};
export type ArquivoSicro={nome:string;bytes:Uint8Array};
const hash=async(b:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b as BufferSource))).map(v=>v.toString(16).padStart(2,'0')).join('');
function documento(s:string){if(/<!DOCTYPE|<!ENTITY|\uFFFD/.test(s))throw Error('XML não permitido.');const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('XML inválido.');return d;}
function texto(s:string){if(!/[&<]/.test(s))return s;return documento('<v>'+s+'</v>').documentElement.textContent??'';}
// Preserve numeric lexical values, including published zero and trailing precision.
export async function lerSicro(arquivo:ArquivoSicro):Promise<Fonte>{
 if(arquivo.bytes.length>20*1024*1024)throw Error('XLSX SICRO excede 20 MiB.');let size=0,entries=0;
 // Official workbooks contain stale externalLink parts. They are never inflated,
 // followed or evaluated; actual worksheet formulas are still rejected below.
 const partes=unzipSync(arquivo.bytes,{filter:f=>{if(++entries>300||f.name.includes('..')||/vbaProject/i.test(f.name))throw Error('Estrutura XLSX não permitida.');const relevant=/^xl\/(?:sharedStrings.xml|workbook.xml|worksheets\/sheet1.xml)$/.test(f.name);if(relevant&&(f.originalSize>150*1024*1024||(size+=f.originalSize)>180*1024*1024))throw Error('XLSX expandido excede limite SICRO.');return relevant;}});
 const decode=(name:string)=>{if(!partes[name])throw Error('Parte XLSX ausente: '+name);return new TextDecoder('utf8',{fatal:true}).decode(partes[name]);};
 const strings=partes['xl/sharedStrings.xml']?Array.from(documento(decode('xl/sharedStrings.xml')).getElementsByTagNameNS('*','si'),s=>Array.from(s.getElementsByTagNameNS('*','t'),v=>v.textContent??'').join('')):[];
 const wb=documento(decode('xl/workbook.xml'));const aba=wb.getElementsByTagNameNS('*','sheet')[0]?.getAttribute('name');if(!aba)throw Error('Aba SICRO ausente.');
 const xml=decode('xl/worksheets/sheet1.xml');if(/<!DOCTYPE|<!ENTITY|\uFFFD/.test(xml))throw Error('XML não permitido.');const linhas:(string|null)[][]=[];let total=0;
 for(const row of xml.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)){
  if(++total>220000)throw Error('Relatório SICRO excede limite de linhas.');const linha:(string|null)[]=[];
  for(const m of row[0].matchAll(/<c\b[^>]*?\/>|<c\b[^>]*>[\s\S]*?<\/c>/g)){
   const c=m[0],ref=/\br="([A-Z]+)(\d+)"/.exec(c);if(!ref)throw Error('Endereço de célula ausente.');let col=0;for(const l of ref[1])col=col*26+l.charCodeAt(0)-64;if(col>64||linha[col-1]!==undefined)throw Error('Coluna SICRO inválida.');
   if(/<f(?:\s|>)/.test(c)||/\bt="e"/.test(c))throw Error('Fórmula/erro não permitido no relatório SICRO.');const v=/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(c)?.[1];let value:string|null=null;
   if(/\bt="s"/.test(c)){if(v===undefined||!/^\d+$/.test(v)||strings[Number(v)]===undefined)throw Error('String compartilhada inválida.');value=strings[Number(v)];}
   else if(/\bt="inlineStr"/.test(c))value=Array.from(c.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g),v=>texto(v[1])).join('');
   else if(v!==undefined)value=texto(v);linha[col-1]=value;
  }
  const numero=Number(/^<row\b[^>]*\br="(\d+)"/.exec(row[0])?.[1]);if(!Number.isInteger(numero)||numero<1||numero>220000||numero<=linhas.length)throw Error('Linha SICRO inválida.');while(linhas.length<numero-1)linhas.push([]);linhas.push(linha);if(total%5000===0)await new Promise(r=>setTimeout(r,0));
 }
 return {nome:arquivo.nome,sha256:await hash(arquivo.bytes),aba,linhas};
}
const nomes=[
 'Relatório Sintético de Composições de Custos','Relatório Sintético de Materiais',
 'Relatório Sintético de Equipamentos','Relatório Sintético de Equipamentos - com desoneração',
 'Relatório Sintético de Mão de Obra','Relatório Sintético de Mão de Obra - com desoneração',
 'Relatório Analítico de Composições de Custos','Relatório Analítico de Mão de Obra','Relatório Analítico de Mão de Obra - com desoneração',
 'Relatório Analítico de Encargos Sociais e Trabalhistas','Relatório Analítico de Encargos Sociais e Trabalhistas - com desoneração',
 'Relatório Sintético de Origem de Preços do SICRO',
];
const codigo=(v:string|null|undefined)=>typeof v==='string'&&/^(?:\d{7}|[A-Z]\d{4})$/.test(v);
function custo(f:Fonte,row:(string|null)[],n:number,col:number,tipo:string,rotulo:string,unidade:string,edicao:string,selecionavel:boolean):CustoSicro{
 const raw=row[col];if(raw!==null&&raw!==undefined&&raw!=='-'&&!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw))throw Error(`Custo inválido ${f.nome}:${n}:${col+1}`);
 return {tipo,rotulo,unidade,edicao,selecionavel,valor:raw==null||raw==='-'?null:raw,arquivo:f.nome,sha256:f.sha256,aba:f.aba,linhas:[n],coluna:String.fromCharCode(65+col)};
}
export async function importarSicro(arquivos:ArquivoSicro[]){
 const fontes=new Map<string,Fonte>();for(const nome of nomes){const filename='MT 07-2026 '+nome+'.xlsx',matches=arquivos.filter(f=>f.nome===filename);if(matches.length!==1)throw Error('Forneça exatamente um arquivo '+filename);fontes.set(nome,await lerSicro(matches[0]));}
 const get=(n:string)=>fontes.get(n)!;const itens=new Map<string,BaseItem>();let repeticoes=0;
 for(const nome of nomes.slice(0,6)){
  const f=get(nome),equip=nome.includes('Equipamentos'),material=nome.includes('Materiais'),composicao=nome.includes('Composições');const subtipo=composicao?'composicao':equip?'equipamento':material?'material':'mao_de_obra';const edicao=nome.includes('com desoneração')?'com desoneração':subtipo==='mao_de_obra'?'sem desoneração':equip?'edição sem sufixo':'publicada';
  if(f.linhas[0]?.[0]!=='Código'||!f.linhas[0]?.[1]?.startsWith('Descrição'))throw Error('Cabeçalho SICRO inesperado: '+f.nome);
  const vistos=new Map<string,{row:(string|null)[];custos:CustoSicro[]}>();
  for(let n=1;n<f.linhas.length;n++){
   const row=f.linhas[n];if(!codigo(row[0])){if(row[0]&&row[0]!=='Código')throw Error('Código SICRO não reconhecido: '+row[0]);continue;}const code=row[0]!;
   const cs=equip?[
    custo(f,row,n+1,2,'valor_aquisicao','Valor de aquisição','R$',edicao,false),
    ...['Depreciação','Oportunidade de Capital','Seguros e Impostos','Manutenção','Operação','Mão de Obra de Operação'].map((rotulo,k)=>custo(f,row,n+1,k+3,['depreciacao','capital','seguros_impostos','manutencao','operacao','mao_obra_operacao'][k],rotulo,'h',edicao,false)),
    custo(f,row,n+1,9,'produtivo','Custo produtivo','h',edicao,true),custo(f,row,n+1,10,'improdutivo','Custo improdutivo','h',edicao,true),
   ]:[custo(f,row,n+1,3,composicao?'total_publicado':material?'preco_unitario':'custo_total_mao_obra',composicao?'Total publicado':material?'Preço unitário':'Custo total de mão de obra',row[2]??'',edicao,true)];
   const anterior=vistos.get(code);if(anterior){if(JSON.stringify(row)!==JSON.stringify(anterior.row))throw Error('Repetição conflitante: '+code);anterior.custos.forEach(c=>c.linhas.push(n+1));repeticoes++;continue;}vistos.set(code,{row,custos:cs});
   const old=itens.get(code);if(old){if(old.descricao!==row[1]?.trim()||old.unidade!==(equip?'h':row[2]?.trim()))throw Error('Edições incompatíveis: '+code);old.sicro!.custos.push(...cs);}
   else itens.set(code,baseItemSchema.parse({codigo:code,descricao:row[1],unidade:equip?'h':row[2],tipo:composicao?'composicao':'insumo',classificacao:subtipo,preco_centavos:null,categoria:subtipo,sicro:{subtipo,custos:cs,memorias:[]}}));
   vistos.set(code,{row,custos:itens.get(code)!.sicro!.custos.filter(c=>c.edicao===edicao)});
   itens.get(code)!.sicro!.memorias.push({arquivo:f.nome,sha256:f.sha256,aba:f.aba,linha:n+1,dados:JSON.stringify([f.linhas[0],row])});
  }
 }
 const memoria=(f:Fonte,code:string,start:number,rows:(string|null)[][])=>{const item=itens.get(code);if(!item)throw Error('Memória sem item: '+code);item.sicro!.memorias.push({arquivo:f.nome,sha256:f.sha256,aba:f.aba,linha:start+1,dados:JSON.stringify(rows)});};
 const analitico=get(nomes[6]);let start=-1,code='',blocos=0;
 for(let n=0;n<=analitico.linhas.length;n++){
  const row=analitico.linhas[n];if(n===analitico.linhas.length||row?.[0]==='SISTEMA DE CUSTOS REFERENCIAIS DE OBRAS - SICRO'){
   if(start>=0){const rows=analitico.linhas.slice(start,n),total=rows.find(r=>r.includes('Custo unitário direto total'))?.[8];if(total!==itens.get(code)?.sicro?.custos[0].valor)throw Error('Total analítico divergente: '+code);memoria(analitico,code,start,rows);blocos++;}
   if(row){if(row[3]!=='Mato Grosso'||analitico.linhas[n+1]?.[3]!=='Julho/2026')throw Error('Localidade/competência SICRO divergente.');start=n;code=analitico.linhas[n+2]?.[0]??'';}
  }
 }
 if(blocos!==[...itens.values()].filter(i=>i.tipo==='composicao').length)throw Error('Blocos analíticos incompletos.');
 for(const nome of nomes.slice(7,9)){const f=get(nome);let inicio=-1,c='';for(let n=0;n<=f.linhas.length;n++){const r=f.linhas[n];if(n===f.linhas.length||r?.[0]==='Código'){if(inicio>=0)memoria(f,c,inicio,f.linhas.slice(inicio,n));if(r){inicio=n;c=f.linhas[n+1]?.[0]??'';}}}}
 for(const nome of nomes.slice(9,11)){const f=get(nome);for(let n=2;n<f.linhas.length;n++){const r=f.linhas[n];if(codigo(r[0]))memoria(f,r[0]!,n,[f.linhas[0],f.linhas[1],r]);}}
 const origem=get(nomes[11]);if(!origem.linhas.some(r=>r[29]==='MT'))throw Error('Coluna MT de origem não encontrada.');for(let n=0;n<origem.linhas.length;n++){const r=origem.linhas[n];if(codigo(r[0])){const i=itens.get(r[0]!);if(!i||i.tipo!=='insumo')throw Error('Origem sem insumo.');i.metadados={origem_MT:r[29]??null,arquivo_origem:origem.nome,sha256_origem:origem.sha256,aba_origem:origem.aba,linha_origem:n+1};}}
 const resultado=[...itens.values()].map(i=>baseItemSchema.parse(i));
 const manifesto=[...fontes.values()].map(f=>({arquivo:f.nome,sha256:f.sha256,aba:f.aba}));
 return {itens:resultado,repeticoes,manifesto,arquivo_hash:await hash(new TextEncoder().encode(JSON.stringify(manifesto))),competencia:'07/2026',uf:'MT'};
}

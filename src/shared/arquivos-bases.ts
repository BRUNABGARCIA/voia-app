/** Inspect ZIP directory without inflating untrusted data. The source readers
 * additionally bound actual inflated bytes and never execute embedded content. */
export function validarArquivoBase(bytes:Uint8Array,nome:string){
 if(!bytes.length||bytes.length>20*1024*1024)throw Error('Arquivo vazio ou maior que 20 MiB.');
 if(/\.pdf$/i.test(nome)){if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'||!new TextDecoder().decode(bytes.slice(-1024)).includes('%%EOF'))throw Error('PDF inválido ou truncado.');return;}
 if(!/\.(xlsx|zip)$/i.test(nome))throw Error('Formato não reconhecido.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(v.getUint32(p,true)===0x06054b50){end=p;break;}
 if(end<0||end+22+v.getUint16(end+20,true)!==bytes.length||v.getUint16(end+4,true)!==0||v.getUint16(end+6,true)!==0)throw Error('ZIP inválido, truncado ou multidisco.');
 const outer=/\.zip$/i.test(nome),count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true),size=v.getUint32(end+12,true);if(!count||count>(outer?64:300)||offset+size!==end)throw Error('Diretório ZIP inválido ou excede limite.');
 const names=new Set<string>();let p=offset,total=0;
 for(let n=0;n<count;n++){if(p+46>end||v.getUint32(p,true)!==0x02014b50)throw Error('Entrada ZIP inválida.');const nameSize=v.getUint16(p+28,true),length=46+nameSize+v.getUint16(p+30,true)+v.getUint16(p+32,true);if(p+length>end)throw Error('ZIP truncado.');const name=new TextDecoder('utf8',{fatal:true,ignoreBOM:false}).decode(bytes.subarray(p+46,p+46+nameSize));if(!name||name.includes('..')||(/[\\:]/.test(name)||[...name].some(c=>c.charCodeAt(0)<32))||name.startsWith('/')||names.has(name)||/vbaProject/i.test(name)||v.getUint16(p+8,true)&1||![0,8].includes(v.getUint16(p+10,true)))throw Error('Caminho, criptografia, macro ou compressão ZIP não permitida.');names.add(name);
  const original=v.getUint32(p+24,true);total+=original;if(original>(outer?20:180)*1024*1024||total>(outer?240:512)*1024*1024)throw Error('ZIP bomb: tamanho expandido excede limite.');if(outer&&!name.endsWith('/')&&!/\.(xlsx|pdf)$/i.test(name))throw Error('Arquivo inesperado no ZIP.');p+=length;
 }
 if(p!==end||(!outer&&(!names.has('xl/workbook.xml')||!names.has('xl/_rels/workbook.xml.rels'))))throw Error('XLSX sem estrutura obrigatória.');
}

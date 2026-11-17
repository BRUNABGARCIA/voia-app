import {PDFDocument,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {dataExterna,solicitacaoPublicaSchema,gruposExternos,textoServico,type SolicitacaoPublica} from '../../shared/solicitacoes-proposta';

export async function gerarSolicitacaoPdf(input:SolicitacaoPublica,fontBytes:Uint8Array){
 const s=solicitacaoPublicaSchema.parse(input),d=s.documento,pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(fontBytes,{subset:true});
 pdf.setTitle('Solicitação de proposta · '+s.numero);pdf.setAuthor('VOIA Engenharia');pdf.setCreator('VOIA Engenharia');pdf.setProducer('VOIA Engenharia');
 pdf.setCreationDate(new Date(s.emitida_em));pdf.setModificationDate(new Date(s.emitida_em));
 const supported=new Set(font.getCharacterSet());
 const clean=(v:string)=>v.replace(/\t/g,' ').split('').filter(c=>c.charCodeAt(0)>=32||'\n\r'.includes(c)).join('');
 function wrap(value:string,width:number,size=8.5):string[]{
  const result:string[]=[];
  for(const paragraph of clean(value).split('\n')){
   for(const char of paragraph)if(!supported.has(char.codePointAt(0)!))throw Error(`Caractere não suportado no PDF: ${char}. Revise o texto externo.`);
   let line='';for(const word of paragraph.split(/\s+/)){if(!word)continue;
    const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)<=width){line=next;continue;}
    if(line){result.push(line);line='';}
    for(const char of word){if(line&&font.widthOfTextAtSize(line+char,size)>width){result.push(line);line='';}line+=char;}
   }result.push(line);
  }
  return result;
 }
 let page!:PDFPage,y=0;const left=36,width=523,bottom=48,cols=[40,265,30,40,78,70];
 const ink=rgb(.13,.14,.12),gold=rgb(.94,.82,.43),rule=rgb(.84,.85,.81);
 const draw=(text:string,x:number,yy:number,size=8.5,f:PDFFont=font)=>page.drawText(text,{x,y:yy,size,font:f,color:ink});
 function newPage(){page=pdf.addPage([595,842]);page.drawRectangle({x:36,y:784,width:523,height:28,color:rgb(.1,.1,.09)});page.drawText('VOIA',{x:46,y:792,size:15,font,color:gold});page.drawText('SOLICITAÇÃO DE PROPOSTA',{x:119,y:794,size:10,font,color:rgb(1,1,1)});draw(s.numero,36,768);y=746;}
 function paragraph(text:string,size=9){for(const line of wrap(text,width,size)){if(y<bottom+18)newPage();draw(line,left,y,size);y-=size+5;}y-=5;}
 function tableHeader(){if(y<bottom+60)newPage();const labels=['CÓD.','SERVIÇO E ESCOPO','UN.','QTD.','VALOR UNIT. (R$)','TOTAL (R$)'];page.drawRectangle({x:left,y:y-30,width,height:30,color:gold});let x=left;labels.forEach((label,n)=>{wrap(label,cols[n]-8,7).forEach((line,k)=>draw(line,x+4,y-11-k*10,7));x+=cols[n];});y-=34;}
 newPage();paragraph(d.titulo,12);paragraph(`Obra: ${d.obra}\nProjeto: ${d.projeto}`);
 paragraph(`Emissão: ${new Date(s.emitida_em).toLocaleDateString('pt-BR',{timeZone:'America/Cuiaba'})}`);
 for(const [label,value] of [['Cliente',d.cliente],['Local',d.endereco],['Escopo',d.escopo],['Prazo para envio',dataExterna(d.prazo)],['Destinatário',d.destinatario],['Contato',d.contato],['Telefone',d.telefone],['E-mail',d.email]])if(value)paragraph(`${label}: ${value}`);
 tableHeader();
 for(const g of gruposExternos(d)){
  if(g.rotulo){const lines=wrap(g.rotulo,width-8);if(y<bottom+lines.length*12+60){newPage();tableHeader();}for(const line of lines){if(y<bottom+36){newPage();tableHeader();}draw(line,left+4,y-10);y-=14;}y-=5;}
  for(const item of g.itens){
   const values=[item.codigo,textoServico(item),item.unidade,item.quantidade===null?'':item.quantidade.toLocaleString('pt-BR',{maximumFractionDigits:20}),'',''];
   const lines=values.map((v,n)=>wrap(v,cols[n]-8));let offset=0;const count=Math.max(...lines.map(l=>l.length));
   while(offset<count){if(y<bottom+28){newPage();tableHeader();}const take=Math.min(count-offset,Math.floor((y-bottom-12)/12));let x=left;lines.forEach((ls,n)=>{ls.slice(offset,offset+take).forEach((l,k)=>draw(l,x+4,y-12-k*12));x+=cols[n];});y-=take*12+10;page.drawLine({start:{x:left,y},end:{x:left+width,y},thickness:.4,color:rule});offset+=take;}
  }
  if(y<bottom+28){newPage();tableHeader();}draw('Subtotal para preenchimento: ____________________',left+4,y-13);y-=34;
 }
 paragraph('Condições para cotação',10);paragraph(d.condicoes);if(d.observacoes){paragraph('Observações externas',10);paragraph(d.observacoes);}
 paragraph('Observações do prestador:');paragraph('________________________________________________________________________________');
 const pages=pdf.getPages();pages.forEach((p,n)=>{p.drawText(`VOIA Engenharia · ${s.numero} · ${n+1}/${pages.length}`,{x:left,y:24,size:8,font,color:ink});});
 return pdf.save();
}

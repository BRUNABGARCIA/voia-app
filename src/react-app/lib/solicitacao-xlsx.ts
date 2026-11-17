import {zipSync,strToU8} from 'fflate';
import {dataExterna,solicitacaoPublicaSchema,gruposExternos,textoServico,type SolicitacaoPublica} from '../../shared/solicitacoes-proposta';
const xml=(v:string)=>v.split('').filter(c=>c.charCodeAt(0)>=32||'\n\r\t'.includes(c)).join('').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
type Cell=string|number|null|{formula:string};
/** External-only workbook. No internal worksheet or provenance is accepted here. */
export function gerarSolicitacaoXlsx(input:SolicitacaoPublica){
 const s=solicitacaoPublicaSchema.parse(input),d=s.documento;
 const rows:{cells:Cell[];style:number;height?:number;merge?:boolean}[]=[];
 const add=(cells:Cell[],style=0,merge=false,height?:number)=>rows.push({cells,style,merge,height});
 const texto=(text:string,style=0)=>{for(const line of text.split('\n')){const chunks=line.match(/[\s\S]{1,120}/g)??[''];for(const part of chunks)add([part],style,true,Math.max(22,Math.ceil(part.length/100)*14+8));}};
 texto('VOIA ENGENHARIA · SOLICITAÇÃO DE PROPOSTA',1);texto(`${s.numero} · ${new Date(s.emitida_em).toLocaleDateString('pt-BR',{timeZone:'America/Cuiaba'})}`);
 texto(d.titulo,1);texto(`Obra: ${d.obra}`);texto(`Projeto: ${d.projeto}`);
 for(const [label,value] of [['Cliente',d.cliente],['Local',d.endereco],['Escopo',d.escopo],['Prazo para envio',dataExterna(d.prazo)],['Destinatário',d.destinatario],['Contato',d.contato],['Telefone',d.telefone],['E-mail',d.email]])if(value)texto(`${label}: ${value}`);
 add(['CÓD.','SERVIÇO E ESCOPO','UN.','QTD.','VALOR UNIT. (R$)','TOTAL (R$)'],1,false,34);const header=rows.length;
 for(const g of gruposExternos(d)){
  if(g.rotulo)texto(g.rotulo,1);
  for(const i of g.itens){
   // Excel has a 409pt row-height ceiling: continue long descriptions in visible rows.
   const pieces:string[]=[];let remaining=textoServico(i);
   while(remaining.length){let end=Math.min(500,remaining.length),breaks=0;for(let n=0;n<end;n++)if(remaining[n]==='\n'&&++breaks===10){end=n+1;break;}
    if(end<remaining.length&&remaining[end-1]!=='\n'){const space=remaining.lastIndexOf(' ',end);if(space>0)end=space+1;}
    pieces.push(remaining.slice(0,end));remaining=remaining.slice(end);
   }if(!pieces.length)pieces.push('');
   pieces.forEach((part,n)=>{const row=rows.length+1;add([n===0?i.codigo:'',part,n===0?i.unidade:'',n===0?i.quantidade:null,null,n===0?{formula:`IF(AND(ISNUMBER(D${row}),ISNUMBER(E${row})),ROUND(D${row}*E${row},2),"")`}:null],0,false,Math.max(28,Math.min(400,(part.split('\n').reduce((n,l)=>n+Math.max(1,Math.ceil(l.length/52)),0))*14+12)));});
  }
  add(['Subtotal para preenchimento',null,null,null,null,null],2,true,24);
 }
 texto('Condições para cotação',1);texto(d.condicoes);texto('Observações externas',1);texto(d.observacoes||'');texto('Observações do prestador:');texto('');texto('VOIA Engenharia');
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',files:Record<string,Uint8Array>={};const put=(p:string,v:string)=>files[p]=strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+v);
 put('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
 put('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 put('xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="SOLICITAÇÃO DE PROPOSTA" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'SOLICITAÇÃO DE PROPOSTA'!$${header}:$${header}</definedName></definedNames><calcPr fullCalcOnLoad="1"/></workbook>`);
 put('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
 put('xl/styles.xml',`<styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$ &quot;#,##0.00"/></numFmts><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3E6B7"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5">${[0,1,2,3,4].map(n=>`<xf fontId="${n===1?1:0}" fillId="${n===1?2:0}" borderId="0" numFmtId="${n===4?49:n===3?164:0}" xfId="0" applyNumberFormat="1"><alignment vertical="top" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
 const merges=rows.flatMap((r,n)=>r.merge?[`<mergeCell ref="A${n+1}:${r.style===2?'E':'F'}${n+1}"/>`]:[]);
 put('xl/worksheets/sheet1.xml',`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${header}" topLeftCell="A${header+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${[12,64,9,12,20,20].map((w,n)=>`<col min="${n+1}" max="${n+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r,n)=>`<row r="${n+1}" ht="${r.height??24}" customHeight="1">${r.cells.map((v,c)=>{const ref=String.fromCharCode(65+c)+(n+1),style=r.style===1?1:c===0&&typeof v==='string'&&/^\d{2}\.\d+$/.test(v)?4:c>=4?3:0;if(v===null)return `<c r="${ref}" s="${style}"/>`;if(typeof v==='object')return `<c r="${ref}" s="3" t="str"><f>${xml(v.formula)}</f><v></v></c>`;return typeof v==='number'?`<c r="${ref}" s="${style}"><v>${v}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData><mergeCells count="${merges.length}">${merges.join('')}</mergeCells><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`);
 return zipSync(files,{level:6});
}

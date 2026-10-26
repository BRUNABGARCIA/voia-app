import fs from 'node:fs';
import path from 'node:path';

const arquivos=[];
function percorrer(diretorio) {
  if(!fs.existsSync(diretorio))return;
  for(const entrada of fs.readdirSync(diretorio,{withFileTypes:true})) {
    const arquivo=path.join(diretorio,entrada.name);
    if(entrada.isDirectory())percorrer(arquivo);
    else if(/\.(?:tsx?|css|sql|json|md|html|svg|mjs)$/.test(arquivo))arquivos.push(arquivo);
  }
}
for(const dir of ['src','test','migrations','docs','scripts'])percorrer(dir);
for(const entrada of fs.readdirSync('.',{withFileTypes:true}))if(entrada.isFile()&&/\.(?:tsx?|json|html|mjs)$/.test(entrada.name))arquivos.push(entrada.name);
const invalidos=[],ocorrencias=[];
for(const arquivo of arquivos) {
  let texto;
  try {texto=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(arquivo));}
  catch {invalidos.push(arquivo);continue;}
  texto.split(/\r?\n/).forEach((linha,i)=>{
    // Detecta padrões de UTF-8 interpretado como Latin-1/Windows-1252;
    // não confunde letras maiúsculas portuguesas válidas com corrupção.
    if(/\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2[\u20AC\u2020\u2021\u0153\u201C\u201D\u2122\u00A6]|\uFFFD/.test(linha))ocorrencias.push({arquivo,linha:i+1});
  });
}
console.log(JSON.stringify({arquivosVerificados:arquivos.length,utf8Invalido:invalidos,mojibake:ocorrencias},null,2));
if(invalidos.length||ocorrencias.length)process.exitCode=1;

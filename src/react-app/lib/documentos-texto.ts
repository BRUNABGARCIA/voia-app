import { Unzip, UnzipInflate } from 'fflate';
import { EXTENSOES_DOCUMENTO, TAMANHO_MAXIMO_BYTES } from '../../shared/documentos';

export type AnaliseAnexo = { status: 'analisado' | 'anexado' | 'falhou'; texto: string; motivo?: string };
export const LIMITE_TEXTO = 200_000;
export const LIMITE_XML_DOCX = 5 * 1024 * 1024;
export const LIMITE_PAGINAS_PDF = 200;

export async function lerArquivo(file: File): Promise<ArrayBuffer> {
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(new Error('Falha ao ler arquivo.')); reader.readAsArrayBuffer(file); });
}

export async function adicionarArquivos(atuais: File[], novos: File[]) {
  const arquivos = [...atuais]; const erros: string[] = [];
  for (const file of novos) {
    const extensao = file.name.split('.').pop()?.toLowerCase() || '';
    if (!EXTENSOES_DOCUMENTO.includes(extensao) || file.size === 0 || file.size > TAMANHO_MAXIMO_BYTES) {
      erros.push(`${file.name}: formato não permitido, arquivo vazio ou acima de 20 MiB.`); continue;
    }
    let repetido = false;
    for (const existente of arquivos.filter(a => a.name === file.name && a.size === file.size && a.type === file.type)) {
      const a = new Uint8Array(await lerArquivo(existente)); const b = new Uint8Array(await lerArquivo(file));
      if (a.every((byte, i) => byte === b[i])) { repetido = true; break; }
    }
    if (!repetido) arquivos.push(file);
  }
  return { arquivos, erros };
}

function conferirTexto(texto: string) {
  if (!texto.trim()) throw new Error('Não foi encontrado texto extraível; pode ser um documento digitalizado.');
  if (texto.length > LIMITE_TEXTO) throw new Error('Texto excede 200 mil caracteres para análise local.');
  return texto.trim();
}

export function extrairDocx(bytes: Uint8Array): string {
  // Extrai somente o XML principal, sem executar macros, carregar links ou renderizar HTML.
  const partes: Uint8Array[] = []; let tamanho = 0; let encontrado = false; let completo = false; let erro: Error | null = null;
  const unzip = new Unzip(entrada => {
    if (entrada.name !== 'word/document.xml') return;
    if (encontrado) { erro = new Error('DOCX contém XML principal duplicado.'); return; }
    encontrado = true;
    if ((entrada.originalSize || 0) > LIMITE_XML_DOCX) { erro = new Error('XML do DOCX excede 5 MiB para análise local.'); return; }
    entrada.ondata = (falha, data, final) => {
      if (falha) { erro = falha; return; }
      tamanho += data.length;
      // Mede bytes realmente emitidos, inclusive em ZIP com tamanho adulterado.
      if (tamanho > LIMITE_XML_DOCX) { erro = new Error('XML do DOCX excede 5 MiB para análise local.'); entrada.terminate(); return; }
      partes.push(data.slice()); completo = final;
    };
    entrada.start();
  });
  unzip.register(UnzipInflate);
  // Chunks pequenos evitam uma alocação descomprimida gigante antes do limite.
  for (let inicio = 0; inicio < bytes.length; inicio += 1024) {
    unzip.push(bytes.subarray(inicio, inicio + 1024), inicio + 1024 >= bytes.length);
    if (erro) throw erro;
  }
  if (!encontrado || !completo) throw new Error('DOCX inválido ou XML principal indisponível.');
  const xml = new Uint8Array(tamanho); let posicao = 0;
  for (const parte of partes) { xml.set(parte, posicao); posicao += parte.length; }
  const fonte = new TextDecoder('utf-8', { fatal: true }).decode(xml);
  if (/<!DOCTYPE|<!ENTITY/i.test(fonte)) throw new Error('XML com declarações externas não é analisado.');
  let elementos = 0;
  for (let inicio = fonte.indexOf('<'); inicio !== -1; inicio = fonte.indexOf('<', inicio + 1)) {
    if (++elementos > 50_000) throw new Error('DOCX excede 50 mil marcações XML para análise local.');
  }
  const doc = new DOMParser().parseFromString(fonte, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML do DOCX inválido.');
  const texto = Array.from(doc.getElementsByTagNameNS('*', 'p'), p => Array.from(p.getElementsByTagNameNS('*', 't'), t => t.textContent || '').join('')).join('\n');
  return conferirTexto(texto);
}

export async function extrairPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const nativo = typeof Worker !== 'undefined' ? new Worker(workerUrl, { type: 'module' }) : undefined;
  const worker = nativo ? pdfjs.PDFWorker.create({ port: nativo }) : undefined;
  const task = pdfjs.getDocument({ data: bytes, worker, useSystemFonts: false, disableFontFace: true, stopAtErrors: true, disableAutoFetch: true });
  let expirou = false;
  let limite: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, reject) => { limite = setTimeout(() => { expirou = true; worker?.destroy(); nativo?.terminate(); reject(new Error('Análise do PDF excedeu 15 segundos.')); }, 15_000); });
  const leitura = async () => {
    const doc = await task.promise;
    if (doc.numPages > LIMITE_PAGINAS_PDF) throw new Error('PDF excede 200 páginas para análise local.');
    let texto = '';
    for (let pagina = 1; pagina <= doc.numPages; pagina++) {
      const page = await doc.getPage(pagina); const content = await page.getTextContent();
      texto += content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('') + '\n';
      page.cleanup();
      if (texto.length > LIMITE_TEXTO) throw new Error('Texto excede 200 mil caracteres para análise local.');
    }
    return conferirTexto(texto);
  };
  try { return await Promise.race([leitura(), prazo]); }
  finally {
    clearTimeout(limite);
    if (expirou) void task.destroy().catch(() => {});
    else await task.destroy();
    worker?.destroy(); nativo?.terminate();
  }
}

export async function analisarAnexo(file: File): Promise<AnaliseAnexo> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['pdf', 'docx', 'txt'].includes(ext || '')) return { status: 'anexado', texto: '', motivo: 'Este formato será apenas anexado; não há OCR nesta rodada.' };
  try {
    if (file.size > TAMANHO_MAXIMO_BYTES) throw new Error('Arquivo acima de 20 MiB.');
    const bytes = new Uint8Array(await lerArquivo(file));
    const texto = ext === 'docx' ? extrairDocx(bytes) : ext === 'pdf' ? await extrairPdf(bytes) : conferirTexto(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (texto.includes('\0')) throw new Error('Conteúdo binário não é texto analisável.');
    return { status: 'analisado', texto };
  } catch (e) { return { status: 'falhou', texto: '', motivo: `${e instanceof Error ? e.message : 'Falha de extração.'} Este arquivo será anexado ao projeto, mas seu conteúdo não pôde ser analisado.` }; }
}

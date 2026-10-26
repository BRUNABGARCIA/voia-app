import { afterEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { adicionarArquivos, analisarAnexo, extrairDocx, extrairPdf, LIMITE_XML_DOCX } from '../../src/react-app/lib/documentos-texto';
import { consolidarTrabalho, resolverCampo } from '../../src/react-app/lib/consolidar-trabalho';

afterEach(() => vi.unstubAllGlobals());
function pdfTextual(texto: string) {
  const stream = `BT /F1 12 Tf 50 750 Td (${texto}) Tj ET`;
  const objetos = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets: number[] = [0];
  objetos.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const inicio = pdf.length; pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicio}\n%%EOF`;
  return strToU8(pdf);
}

describe('extração local e consolidação', () => {
  it('analisa TXT UTF-8 e DOCX reais, preservando linhas e sem executar conteúdo', async () => {
    expect(await analisarAnexo(new File(['Cliente: Lincoln e Nayara\nValor: R$ 800,00'], 'proposta.txt', { type: 'text/plain' }))).toMatchObject({ status: 'analisado', texto: 'Cliente: Lincoln e Nayara\nValor: R$ 800,00' });
    const bytes = zipSync({ 'word/document.xml': strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Endereço completo: Rua A, 15</w:t></w:r></w:p><w:p><w:r><w:t>Forma de pagamento: PIX</w:t></w:r></w:p></w:body></w:document>') });
    expect(extrairDocx(bytes)).toBe('Endereço completo: Rua A, 15\nForma de pagamento: PIX');
    expect(await analisarAnexo(new File([bytes as BlobPart], 'termo.docx'))).toMatchObject({ status: 'analisado' });
  });
  it('extrai texto de um PDF com o parser PDF.js real', async () => {
    // O ambiente DOM de teste não implementa Worker. O mesmo worker PDF.js é
    // carregado localmente como fallback, sem substituir o parser por um mock.
    vi.stubGlobal('pdfjsWorker', await import('pdfjs-dist/legacy/build/pdf.worker.mjs'));
    const texto = await extrairPdf(pdfTextual('Cliente: Lincoln e Nayara'));
    expect(texto).toContain('Cliente: Lincoln e Nayara');
  });
  it('falhas de extração e imagens continuam anexáveis', async () => {
    expect(await analisarAnexo(new File(['imagem'], 'foto.jpg'))).toMatchObject({ status: 'anexado', texto: '' });
    const quebrado = new File([zipSync({ 'conteudo.xml': strToU8('XML principal indisponível') }) as BlobPart], 'termo.docx');
    expect(await analisarAnexo(quebrado)).toMatchObject({ status: 'falhou', texto: '' });
    expect((await adicionarArquivos([], [quebrado])).arquivos).toEqual([quebrado]);
  });
  it('limita XML descomprimido e recusa entidades externas', () => {
    const grande = zipSync({ 'word/document.xml': new Uint8Array(LIMITE_XML_DOCX + 1) });
    expect(() => extrairDocx(grande)).toThrow('5 MiB');
    const adulterado = grande.slice(); new DataView(adulterado.buffer).setUint32(22, 1, true);
    expect(() => extrairDocx(adulterado)).toThrow('5 MiB');
    const entidades = zipSync({ 'word/document.xml': strToU8('<!DOCTYPE w:document [<!ENTITY x SYSTEM "https://example.test">]><w:document/>') });
    expect(() => extrairDocx(entidades)).toThrow('externas');
  });
  it('consolida proposta, termo e WhatsApp sem inventar dados ausentes', () => {
    const r = consolidarTrabalho([
      { nome: 'proposta.txt', texto: 'Cliente: Lincoln e Nayara\nServiço: Consultoria técnica\nValor: R$ 800,00' },
      { nome: 'termo.docx', texto: 'Endereço completo: Rua A, 15\nForma de pagamento: PIX\nLocal: Condomínio dos Campos' },
      { nome: 'WhatsApp', texto: '[12:00, 14/10/2026] Vistoria amanhã às 09h\nCliente aprovou a proposta' },
    ]);
    expect(r.conflitos).toEqual([]);
    expect(r.rascunho.cliente).toMatchObject({ nome: 'Lincoln e Nayara', endereco: 'Rua A, 15', cidade: '', estado: '', whatsapp: '', origem: 'WhatsApp' });
    expect(r.rascunho.projeto).toMatchObject({ descricao: 'Consultoria técnica', valor: 'R$ 800,00', pagamento: 'PIX', local: 'Condomínio dos Campos', status: 'planejamento', fase_comercial: 'aprovada' });
    expect(r.rascunho.acoes[0]).toMatchObject({ prazo: '2026-10-15', hora: '09:00' });
    expect(r.rascunho.acoes[0].descricao).toContain('referência');
  });
  it('combina a data da vistoria com follow-ups indicados em outra fonte, sem confundir prazo comercial', () => {
    const r = consolidarTrabalho([{ nome: 'Agendamento', texto: 'Vistoria inicial: 15/10/2026 às 09:00' }, { nome: 'WhatsApp', texto: 'Perguntar depois de 15 dias e depois de 30 dias sobre andamento.' }]);
    expect(r.rascunho.acoes.map(a => a.prazo)).toEqual(['2026-10-15', '2026-10-30', '2026-11-14']);
    const comercial = consolidarTrabalho([{ nome: 'Proposta', texto: 'Vistoria inicial: 15/10/2026\nPrazo: 15 dias\nForma de pagamento: em 30 dias' }]);
    expect(comercial.rascunho.acoes).toHaveLength(1);
  });
  it('expõe conflito de prazo com suas fontes e não escolhe um valor', () => {
    const revisao = consolidarTrabalho([{ nome: 'Proposta', texto: 'Prazo: 20 dias' }, { nome: 'WhatsApp', texto: 'Prazo: 25 dias' }]);
    expect(revisao.rascunho.projeto.prazoInformado).toBe('');
    expect(revisao.conflitos[0]).toMatchObject({ campo: 'projeto.prazoInformado', resolvido: false, opcoes: [{ valor: '20 dias', fontes: ['Proposta'] }, { valor: '25 dias', fontes: ['WhatsApp'] }] });
    expect(resolverCampo(revisao.rascunho, 'projeto.prazoInformado', '25 dias').projeto.prazoInformado).toBe('25 dias');
  });
  it('também expõe valores repetidos e divergentes dentro de uma fonte', () => {
    const r = consolidarTrabalho([{ nome: 'Proposta revisada', texto: 'Valor: R$ 800,00\nValor: R$ 950,00' }]);
    expect(r.rascunho.projeto.valor).toBe('');
    expect(r.conflitos[0].opcoes).toEqual([{ valor: 'R$ 800,00', fontes: ['Proposta revisada (linha 1)'] }, { valor: 'R$ 950,00', fontes: ['Proposta revisada (linha 2)'] }]);
  });
  it('deduplica apenas arquivos exatos, aceita o mesmo nome com conteúdo diferente e aplica o limite real', async () => {
    const a = new File(['a'], 'termo.txt'); const igual = new File(['a'], 'termo.txt'); const diferente = new File(['b'], 'termo.txt');
    expect((await adicionarArquivos([a], [igual, diferente])).arquivos).toEqual([a, diferente]);
    const grande = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'grande.pdf');
    expect((await adicionarArquivos([], [grande])).erros).toHaveLength(1);
  });
});

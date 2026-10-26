import type { AnaliseAnexo } from '../lib/documentos-texto';
import { EXTENSOES_DOCUMENTO } from '../../shared/documentos';
import { formatarTamanhoArquivo } from '../lib/projeto-tipos';

export default function AnexosTrabalho({ arquivos, analises, disabled, selecionar, remover }: {
  arquivos: File[]; analises: Map<File, AnaliseAnexo>; disabled: boolean;
  selecionar: (files: File[]) => Promise<void>; remover: (file: File) => void;
}) {
  return <section className="rounded-2xl border border-neutral-200 p-4"><label className="block text-sm font-semibold">Propostas e documentos<input aria-label="Propostas e documentos" type="file" multiple disabled={disabled} accept={EXTENSOES_DOCUMENTO.map(e => `.${e}`).join(',')} onChange={e => { const files = Array.from(e.currentTarget.files || []); e.currentTarget.value = ''; void selecionar(files); }} className="mt-3 block w-full text-sm" /></label><p className="mt-2 text-sm font-medium">{arquivos.length} {arquivos.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}</p><p className="mt-1 text-xs text-neutral-500">Adicione arquivos em várias seleções. Até 20 MiB por arquivo; sem limite fixo de quantidade. PDF textual, DOCX e TXT são analisados localmente.</p><ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">{arquivos.map((file, i) => {
    const a = analises.get(file);
    return <li key={i} className="rounded-lg bg-neutral-50 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-medium">{file.name}</p><p className="text-xs text-neutral-500">{file.name.split('.').pop()?.toUpperCase()} · {file.type || 'Tipo não informado'} · {formatarTamanhoArquivo(file.size)}</p></div><button disabled={disabled} aria-label={`Remover ${file.name}`} onClick={() => remover(file)} className="shrink-0 text-xs text-red-700">Remover</button></div><p className="mt-2 text-xs">{!a ? '○ Aguardando análise' : a.status === 'analisado' ? '✓ Conteúdo analisado' : a.status === 'falhou' ? '! Não foi possível analisar' : '○ Será apenas anexado'}</p>{a?.motivo && <p className="mt-1 text-xs text-neutral-500">{a.motivo}</p>}</li>;
  })}</ul></section>;
}

export function horarioDaDescricao(descricao?: string | null): string {
  return descricao?.match(/Horário:\s*([01]\d|2[0-3]):([0-5]\d)/i)?.slice(1).join(':') || '';
}

export function ordenarAtividades<T extends { prazo: string | null; descricao?: string | null; nome: string }>(atividades: T[]): T[] {
  return [...atividades].sort((a,b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || horarioDaDescricao(a.descricao).localeCompare(horarioDaDescricao(b.descricao)) || a.nome.localeCompare(b.nome,'pt-BR'));
}

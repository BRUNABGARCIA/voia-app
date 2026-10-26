function campoRotulado(observacoes: string | null, rotulo: RegExp) {
  // Reconhece somente linhas rotuladas explicitamente pelo cadastro. Não
  // infere locais a partir de frases livres nem escolhe valores conflitantes.
  const valores = [...new Set((observacoes || '').split(/\r?\n/).flatMap(linha => {
    const match = linha.match(rotulo);
    return match?.[1]?.trim() ? [match[1].trim()] : [];
  }))];
  return valores.length === 1 ? valores[0] : '';
}

export function localProjeto(projeto: { observacoes: string | null; logradouro: string | null; numero: string | null; bairro: string | null }) {
  return {
    local: campoRotulado(projeto.observacoes, /^Local(?:\/Condomínio)?[ \t]*:[ \t]*(.+)$/i),
    endereco: [projeto.logradouro, projeto.numero, projeto.bairro].filter(Boolean).join(', ') || campoRotulado(projeto.observacoes, /^Endereço completo[ \t]*:[ \t]*(.+)$/i),
  };
}

// Frase do dia: curta, profissional, a mesma para todo mundo durante o
// mesmo dia — seleção determinística por dia do ano (sem IA externa, sem
// aleatoriedade, sem persistência; audite a Rodada 03 para o porquê de
// "Meu foco de hoje" ser diferente disso e exigir persistência real).
const FRASES_DO_DIA = [
	"Grandes projetos avançam uma entrega bem feita por vez.",
	"Clareza no escopo hoje evita retrabalho amanhã.",
	"Um prazo cumprido vale mais que dez prometidos.",
	"Organização é a forma mais silenciosa de excelência.",
	"O detalhe que você cuida hoje é a confiança que você constrói depois.",
	"Progresso real é medido em etapas concluídas, não em promessas.",
	"Comunicação clara resolve mais problemas do que esforço extra.",
	"Cada tarefa concluída é um compromisso cumprido com alguém.",
	"Qualidade é o que sobra quando a pressa não decide por você.",
	"Planejamento bom não evita imprevisto — prepara você para ele.",
	"O trabalho bem documentado hoje poupa uma pergunta difícil depois.",
	"Consistência vence intensidade no longo prazo.",
	"Um problema identificado a tempo custa menos que um resolvido tarde.",
	"Foco é escolher o que importa antes que o dia escolha por você.",
	"A confiança de um cliente se constrói entrega após entrega.",
	"Simplicidade bem executada supera complexidade mal entregue.",
	"O que é medido com cuidado é entregue com qualidade.",
	"Hoje é um bom dia para deixar algo mais simples do que encontrou.",
	"Responsabilidade é terminar o que começou, mesmo sem ninguém perguntar.",
	"Um dia de boas decisões pequenas vale mais que um grande gesto isolado.",
] as const;

export function fraseDoDia(agora: Date = new Date()): string {
	const inicioDoAno = new Date(agora.getFullYear(), 0, 0).getTime();
	const diaDoAno = Math.floor((agora.getTime() - inicioDoAno) / (24 * 60 * 60 * 1000));
	return FRASES_DO_DIA[diaDoAno % FRASES_DO_DIA.length];
}

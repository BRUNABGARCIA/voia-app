/**
 * Armazenamento real de arquivos de documentos do projeto (Cloudflare R2,
 * binding "DOCUMENTOS_BUCKET" em wrangler.json). Bucket privado — nunca é
 * exposto por URL pública; todo acesso passa pelas rotas autenticadas do
 * Worker (ver src/worker/projetos/routes.ts e src/worker/portal/routes.ts),
 * que buscam o objeto pelo binding e servem os bytes através do próprio
 * Worker.
 *
 * Chave do objeto: "projetos/{projeto_id}/{uuid}-{nome_sanitizado}" — nunca
 * o nome original puro (evita colisão e path traversal) e sempre prefixada
 * pelo projeto (facilita auditoria/limpeza e já isola por projeto, embora
 * não por empresa — ver docs/FUTURO-SAAS.md).
 */

export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024; // 20 MB — ver README.

interface FormatoAceito {
	extensao: string;
	mimeTypesAceitos: string[];
	/** Assinatura de bytes (magic number) esperada no início do arquivo, quando existe uma confiável para o formato. */
	assinatura?: number[];
}

// Lista fechada de formatos comuns de engenharia pedida nesta rodada.
// DWG usa a assinatura ASCII "AC10" (versão do formato); DXF não tem uma
// assinatura binária confiável (pode ser texto ASCII ou binário conforme
// exportação do CAD), então para DXF só a extensão + MIME são checados.
const FORMATOS_ACEITOS: FormatoAceito[] = [
	{ extensao: "pdf", mimeTypesAceitos: ["application/pdf"], assinatura: [0x25, 0x50, 0x44, 0x46] },
	{ extensao: "dwg", mimeTypesAceitos: ["application/acad", "image/vnd.dwg", "application/octet-stream"], assinatura: [0x41, 0x43, 0x31, 0x30] },
	{ extensao: "dxf", mimeTypesAceitos: ["application/dxf", "image/vnd.dxf", "text/plain", "application/octet-stream"] },
	{ extensao: "doc", mimeTypesAceitos: ["application/msword"], assinatura: [0xd0, 0xcf, 0x11, 0xe0] },
	{
		extensao: "docx",
		mimeTypesAceitos: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
		assinatura: [0x50, 0x4b, 0x03, 0x04],
	},
	{ extensao: "xls", mimeTypesAceitos: ["application/vnd.ms-excel"], assinatura: [0xd0, 0xcf, 0x11, 0xe0] },
	{
		extensao: "xlsx",
		mimeTypesAceitos: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
		assinatura: [0x50, 0x4b, 0x03, 0x04],
	},
	{ extensao: "jpg", mimeTypesAceitos: ["image/jpeg"], assinatura: [0xff, 0xd8, 0xff] },
	{ extensao: "jpeg", mimeTypesAceitos: ["image/jpeg"], assinatura: [0xff, 0xd8, 0xff] },
	{ extensao: "png", mimeTypesAceitos: ["image/png"], assinatura: [0x89, 0x50, 0x4e, 0x47] },
	{ extensao: "zip", mimeTypesAceitos: ["application/zip", "application/x-zip-compressed"], assinatura: [0x50, 0x4b, 0x03, 0x04] },
];

export const EXTENSOES_ACEITAS = FORMATOS_ACEITOS.map((f) => f.extensao);

export interface ArquivoRecebido {
	nomeOriginal: string;
	mimeType: string;
	tamanho: number;
	bytes: ArrayBuffer;
}

export type ValidacaoArquivo = { ok: true } | { ok: false; erro: string };

/**
 * Valida extensão, tamanho e uma assinatura de bytes básica (quando o
 * formato tem uma confiável) — nunca confia só na extensão nem só no
 * Content-Type que o navegador informou, que podem ser forjados.
 */
export function validarArquivo(arquivo: ArquivoRecebido): ValidacaoArquivo {
	if (arquivo.tamanho <= 0) {
		return { ok: false, erro: "arquivo vazio" };
	}
	if (arquivo.tamanho > TAMANHO_MAXIMO_BYTES) {
		return { ok: false, erro: `arquivo excede o limite de ${TAMANHO_MAXIMO_BYTES / (1024 * 1024)} MB` };
	}

	const partes = arquivo.nomeOriginal.trim().toLowerCase().split(".");
	const extensao = partes.length > 1 ? partes[partes.length - 1] : "";
	const formato = FORMATOS_ACEITOS.find((f) => f.extensao === extensao);
	if (!formato) {
		return { ok: false, erro: `formato ".${extensao || "?"}" não permitido — aceitos: ${EXTENSOES_ACEITAS.join(", ").toUpperCase()}` };
	}

	if (arquivo.mimeType && !formato.mimeTypesAceitos.includes(arquivo.mimeType)) {
		return { ok: false, erro: "o tipo do arquivo não corresponde à extensão enviada" };
	}

	if (formato.assinatura) {
		const inicio = new Uint8Array(arquivo.bytes.slice(0, formato.assinatura.length));
		const confere = formato.assinatura.every((byte, i) => inicio[i] === byte);
		if (!confere) {
			return { ok: false, erro: "o conteúdo do arquivo não corresponde ao formato esperado" };
		}
	}

	return { ok: true };
}

function sanitizarNomeArquivo(nome: string): string {
	const semAcentos = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
	const seguro = semAcentos.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
	return seguro.slice(-150) || "arquivo";
}

export function gerarStorageKey(projetoId: number, nomeOriginal: string): string {
	const uuid = crypto.randomUUID();
	return `projetos/${projetoId}/${uuid}-${sanitizarNomeArquivo(nomeOriginal)}`;
}

export async function salvarArquivo(bucket: R2Bucket, storageKey: string, arquivo: ArquivoRecebido): Promise<void> {
	await bucket.put(storageKey, arquivo.bytes, {
		httpMetadata: { contentType: arquivo.mimeType || "application/octet-stream" },
	});
}

export async function lerArquivo(bucket: R2Bucket, storageKey: string): Promise<R2ObjectBody | null> {
	return bucket.get(storageKey);
}

/** Idempotente por natureza do R2 (delete de chave inexistente não é erro), mas protegido mesmo assim. */
export async function removerArquivo(bucket: R2Bucket, storageKey: string): Promise<void> {
	try {
		await bucket.delete(storageKey);
	} catch {
		// Objeto já ausente ou bucket indisponível — não bloqueia a operação
		// que chamou (ex.: exclusão do registro no banco já deve seguir).
	}
}

/** Cabeçalho seguro para o nome de download: sem CRLF/aspas (evita injeção de cabeçalho) e com fallback ASCII + UTF-8. */
export function contentDispositionAnexo(nomeArquivo: string): string {
	const semQuebraOuAspas = nomeArquivo.replace(/[\r\n"]/g, "");
	const somenteAscii = semQuebraOuAspas.replace(/[^\x20-\x7E]/g, "_");
	return `attachment; filename="${somenteAscii}"; filename*=UTF-8''${encodeURIComponent(semQuebraOuAspas)}`;
}

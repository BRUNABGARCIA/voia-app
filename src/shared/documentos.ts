// Limite de aplicação já adotado pelo upload autenticado (buffer em memória).
// Cada documento vai em uma requisição independente; não há limite de quantidade.
export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
export const EXTENSOES_DOCUMENTO = ['pdf', 'dwg', 'dxf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'zip', 'txt'];

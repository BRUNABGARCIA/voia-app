// "cloudflare:workers" é um módulo do runtime do Workers (workerd), sem
// pacote de tipos próprio instalado neste projeto — só o necessário para
// os testes (env) é declarado aqui.
declare module "cloudflare:workers" {
	export const env: Env;
}

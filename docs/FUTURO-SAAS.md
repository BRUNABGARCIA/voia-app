# Notas para uma futura versão comercial (multiempresa)

Este documento é só um mapa de pontos a revisitar **se e quando** este código virar base de um produto SaaS separado. **Nada aqui está implementado** — o VOIA App atual continua sendo uso interno da VOIA Engenharia, de uma empresa só, sem isolamento entre tenants.

## Componentes reaproveitáveis como estão
- Toda a camada de UI (componentes React, Tailwind/tema, modais, painéis de etapas/tarefas/documentos/andamento) não depende de "VOIA" no código — só na marca/conteúdo (`configuracoes_aparencia`, `branding`).
- A separação modelo (`tipo_servico_etapas_modelo`/`tipo_servico_modelo_tarefa`) → instância (`projeto_etapas`/`projeto_tarefas`) já é o padrão certo para um catálogo por empresa no futuro.
- Autenticação (`usuarios`/`sessoes`) e Portal do Cliente (`cliente_contatos`/`sessoes_portal`) já são duas trilhas de sessão completamente separadas — bom ponto de partida para isolar por empresa depois.

## Pontos que precisarão de `tenant_id`/organização
- `clientes`, `projetos`, `tipos_servico`, `usuarios`, `projeto_documentos` e as demais tabelas operacionais não têm coluna de empresa — hoje o catálogo (`tipos_servico`, biblioteca de 16 modelos) é global e único.
- Rotas administrativas (`/api/*`) não filtram por empresa em lugar nenhum — todo `requireAuth` autentica contra o mesmo `usuarios` global.
- Contadores de código de projeto (`contadores`, chave `projeto_{ano}`) são globais — precisariam ser por empresa.

## Autenticação que precisará evoluir
- `usuarios.perfil` é um enum fixo (administrador/gestor/colaborador/visualizador) sem conceito de "dono da empresa" nem convite entre organizações.
- Sessões (`sessoes`, cookie `voia_session`) não carregam contexto de empresa — precisariam resolver "usuário pertence a qual organização" no login.

## Storage que precisará isolamento
- O armazenamento de documentos (Cloudflare R2, binding `DOCUMENTOS_BUCKET`, migrations 0019/0020) já está implementado e funcional, mas o bucket é único para toda a instância e a chave do objeto é só `projetos/{projeto_id}/{uuid}-{nome}` — sem prefixo de empresa. Numa versão multiempresa, a chave precisará virar algo como `empresas/{empresa_id}/projetos/{projeto_id}/{uuid}-{nome}` (ou um bucket por empresa) para nunca haver colisão ou vazamento entre organizações.

## Configurações que precisarão ser por empresa
- `configuracoes_aparencia` (logo, cores, nome do sistema) hoje é uma linha única global — precisaria virar uma linha por empresa.
- O catálogo de Tipos de Serviço e a biblioteca de modelos de processo (hoje compartilhados por toda a instância) precisariam de um catálogo próprio por empresa, com opção de herdar um catálogo padrão inicial.

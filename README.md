# VOIA APP

VOIA é uma plataforma para gestão de projetos de engenharia, conectando
organizações/clientes (PF ou PJ), projetos e as equipes que os executam.

Este repositório já passou pela **Etapa A — Fundação** (banco de dados,
identidade visual, estrutura de pastas, health check) e pela **Etapa B —
Autenticação** (sessão server-side, login, App Shell), e está na
**Etapa C — Usuários, equipe e acessos** (tela administrativa para gerenciar
a equipe), validada localmente.

**Ainda não implementado** (propositalmente fora de escopo): CRM completo,
financeiro, Cloudflare R2, documentos, tarefas, etapas de projeto, IA VOIA /
VOIA Brain, dashboards definitivos e permissões granulares por módulo
(controle de acesso hoje é só por perfil).

## Stack

- [React 19](https://react.dev/) + [React Router 7](https://reactrouter.com/) — frontend
- [Vite 7](https://vite.dev/) — build/dev server
- [Tailwind CSS 4](https://tailwindcss.com/) — estilos, via `@tailwindcss/vite`
- [Hono](https://hono.dev/) — API rodando no Worker
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — runtime
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — banco de dados (SQLite)
- [Zod](https://zod.dev/) — validação de dados (preparado para as próximas etapas)
- TypeScript, ESLint

## Estrutura

```
migrations/            Migrations SQL do D1 (schema)
scripts/hash-password.mjs  Gera hash de senha para ativar usuários em dev (interativo)
seeds/                  Dados fictícios para desenvolvimento (nunca produção)
src/
  react-app/
    contexts/           AuthContext (estado do usuário autenticado)
    components/         RequireAuth, RequireAdmin (guardas de rota), EditarUsuarioModal
    layouts/AppShell.tsx  Sidebar (preta, identidade VOIA) + header + conteúdo
    pages/              Telas: Login, Home, EquipeAcessos, InfraCheck (/status)
    styles/theme.css    Tokens de identidade visual (cores, tipografia, raios, sombras)
    App.tsx             Rotas
    main.tsx            Bootstrap do React
  worker/
    auth/               Hash de senha, sessão, middleware e rotas de autenticação
    usuarios/            Rotas de gestão de equipe (/api/usuarios), só administrador
    index.ts            API (Hono) rodando no Worker: /api/health, /api/auth/*, /api/usuarios
wrangler.json           Configuração do Worker/D1 na Cloudflare
```

## Execução local

Instalar dependências:

```bash
npm install
```

Subir o ambiente de desenvolvimento (frontend + Worker/API):

```bash
npm run dev
```

Aplicação em [http://localhost:5173](http://localhost:5173). `/` exige login
(App Shell com uma home temporária), `/login` é a tela de entrada,
`/configuracoes/equipe` é a gestão de equipe (só para `administrador`), e
`/status` continua sendo a verificação de infraestrutura (frontend,
Worker/API, D1, migration) da Etapa A, pública.

## Cloudflare D1

O binding `DB` em `wrangler.json` aponta para o banco D1 `voia-db`, já
provisionado nesta conta Cloudflare, com `database_id` configurado em
`wrangler.json` (`d1_databases[0].database_id`). A migration
`0001_init_base.sql` já foi aplicada com sucesso no banco remoto.

Para desenvolvimento **local**, o Wrangler cria automaticamente um banco
SQLite local separado (não usa o banco remoto) ao aplicar as migrations:

```bash
npx wrangler d1 migrations apply voia-db --local
```

## Migrations

Migrations ficam em `migrations/`, aplicadas via nome sequencial:

- `0001_init_base.sql` — tabelas `usuarios`, `organizacoes`, `projetos`
  (com foreign keys e índices) e o usuário administrativo de
  desenvolvimento `admin@voia.local`. **Já aplicada no banco remoto
  `voia-db`. Imutável — não deve ser alterada.**
- `0002_auth.sql` — adiciona `usuarios.senha_hash` (nullable) e a tabela
  `sessoes` (sessão server-side). **Já aplicada no banco remoto `voia-db`.
  Imutável — não deve ser alterada.**
- `0003_equipe_permissoes.sql` — amplia (não substitui) o `CHECK` de
  `usuarios.perfil` para incluir `visualizador` (mantendo os valores já
  existentes) e adiciona `usuarios.ultimo_login_em`. Como SQLite não
  altera `CHECK` in-place, é feita via rebuild de tabela (mesmos IDs
  preservados, sem tocar em `sessoes`/`projetos`). **Aplicada apenas no
  banco local** até aqui; a aplicação no D1 remoto depende de autorização
  explícita.

```bash
# Local
npx wrangler d1 migrations apply voia-db --local

# Remoto (produção) — requer `wrangler login` e autorização explícita
npx wrangler d1 migrations apply voia-db --remote
```

## Seed de desenvolvimento

`seeds/dev_seed.sql` contém dados **fictícios** (usuários, organizações e
projetos de exemplo) para facilitar o desenvolvimento local. Nunca é
aplicado automaticamente — rode manualmente apenas contra o banco local:

```bash
npx wrangler d1 execute voia-db --local --file=./seeds/dev_seed.sql
```

## Autenticação

Sessão server-side com cookie `httpOnly` (não JWT). Endpoints:

- `POST /api/auth/login` — `{ email, senha }`; erro sempre genérico
  ("credenciais inválidas") para não indicar se o e-mail existe.
- `POST /api/auth/logout` — invalida a sessão no servidor (D1), não só o
  cookie no navegador.
- `GET /api/auth/me` — usuário autenticado atual, ou 401.

Senhas usam PBKDF2-HMAC-SHA256 (Web Crypto nativa do Worker, 100.000
iterações — limite do runtime do Cloudflare Workers —, salt individual
por usuário) — nunca texto puro, nunca
retornadas em nenhuma resposta. Sessão expira em 7 dias; o token só é
guardado com hash no D1 (nunca em texto puro).

No frontend, `RequireAuth` protege as rotas privadas (`/`, dentro do
App Shell) redirecionando para `/login` sem sessão — é só proteção de UX;
a autoridade real de acesso é o middleware do Worker
(`withSession`/`requireAuth`/`requireRole`).

### Ativar um usuário em desenvolvimento

`admin@voia.local` (criado na migration 0001) nasce **sem senha** — não
consegue logar até receber um hash. Nenhuma senha real é commitada em
código, migration, seed ou documentação. Para ativá-lo localmente:

```bash
node scripts/hash-password.mjs
```

O script pede e-mail e senha de forma interativa (senha oculta, nunca como
argumento de linha de comando) e imprime o `UPDATE` SQL pronto — execute-o
manualmente contra o D1 **local**:

```bash
npx wrangler d1 execute voia-db --local --command "UPDATE usuarios SET senha_hash = '...' WHERE email = '...';"
```

Aplicar no banco remoto (`--remote`) só com autorização explícita.

## Equipe e Acessos

Página em `/configuracoes/equipe`, restrita a `perfil = 'administrador'`.
Lista a equipe (nome, e-mail, perfil, status, último acesso) e permite
editar nome/e-mail/perfil/status através de `PATCH /api/usuarios/:id`.
Controle de acesso é só por **perfil** nesta etapa (`administrador`,
`gestor`, `colaborador`, `visualizador`) — sem tabela de permissões por
módulo, para não construir estrutura que ainda não tem módulo real para
proteger.

- `GET /api/usuarios` e `PATCH /api/usuarios/:id` exigem sessão válida
  **e** `perfil = 'administrador'` (`requireRole("administrador")`, já
  existente desde a Etapa B). `senha_hash` nunca é retornado.
- Um administrador não consegue desativar a própria conta nem trocar o
  próprio perfil para outro — validado no backend, não só escondido no
  frontend.
- Não há criação de usuário pela interface ainda (só edição de quem já
  existe) — fica para uma próxima etapa.

## Comandos principais

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Ambiente de desenvolvimento (Vite + Worker) |
| `npm run build` | Type-check + build de produção |
| `npm run lint` | ESLint |
| `npm run check` | Type-check + build + `wrangler deploy --dry-run` |
| `npm run cf-typegen` | Regera `worker-configuration.d.ts` a partir de `wrangler.json` |
| `npm run deploy` | Deploy no Cloudflare Workers (requer `wrangler login`) |

`worker-configuration.d.ts` é gerado automaticamente (via `predev`/`prebuild`,
que rodam `wrangler types`) e não é versionado — ele reflete os bindings de
`wrangler.json` (ex.: `Env.DB`) e ficaria desatualizado se fosse commitado.

## Health check

`GET /api/health` confirma, sem expor dados sensíveis:

- se a API está respondendo;
- se o binding D1 está configurado e a conexão funciona;
- se a migration inicial já foi aplicada (tabela `usuarios` existe).

## Estágio atual

- **Etapa A (fundação)**: concluída e em produção.
- **Etapa B (autenticação)**: concluída e em produção (login, sessão,
  logout, PBKDF2 a 100.000 iterações).
- **Etapa C (usuários, equipe e acessos)**: implementada e validada
  **localmente** (listar/editar equipe, autoproteção do admin, sidebar
  com identidade VOIA). Migration `0003_equipe_permissoes.sql` aplicada
  só no D1 local; deploy e migration remota pendentes de autorização.

CRM, financeiro, R2, documentos, tarefas, etapas, IA VOIA, dashboards
definitivos e permissões por módulo ficam para as próximas etapas.

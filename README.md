# VOIA APP

VOIA é uma plataforma para gestão de projetos de engenharia, conectando
organizações/clientes (PF ou PJ), projetos e as equipes que os executam.

Este repositório está na **Etapa A — Fundação**: a base técnica mínima
(banco de dados, identidade visual, estrutura de pastas e um endpoint de
health check) sobre a qual as próximas etapas serão construídas.

**Ainda não implementado nesta etapa** (propositalmente fora de escopo):
autenticação, CRM completo, financeiro, Cloudflare R2, documentos, tarefas,
etapas de projeto, IA VOIA / VOIA Brain e dashboards definitivos.

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
seeds/                  Dados fictícios para desenvolvimento (nunca produção)
src/
  react-app/
    pages/              Telas
    styles/theme.css    Tokens de identidade visual (cores, tipografia, raios, sombras)
    App.tsx             Rotas
    main.tsx            Bootstrap do React
  worker/
    index.ts            API (Hono) rodando no Worker, incl. GET /api/health
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

Aplicação em [http://localhost:5173](http://localhost:5173). A tela inicial é
uma verificação temporária de infraestrutura (frontend, Worker/API, D1,
migration), não o dashboard definitivo.

## Cloudflare D1

O binding `DB` em `wrangler.json` aponta para um banco D1 chamado `voia-db`.

**O `database_id` ainda não está preenchido** (`REPLACE_WITH_D1_DATABASE_ID`)
porque o banco real ainda não foi criado nesta conta Cloudflare. Para
provisionar:

```bash
npx wrangler d1 create voia-db
```

Copie o `database_id` retornado para `wrangler.json` (`d1_databases[0].database_id`).
Só depois disso `npm run deploy` e comandos com `--remote` funcionam.

Para desenvolvimento **local**, o Wrangler cria automaticamente um banco
SQLite local (não precisa do `database_id` real) ao aplicar as migrations:

```bash
npx wrangler d1 migrations apply voia-db --local
```

## Migrations

Migrations ficam em `migrations/`, aplicadas via nome sequencial:

- `0001_init_base.sql` — tabelas `usuarios`, `organizacoes`, `projetos`
  (com foreign keys e índices) e o usuário administrativo de
  desenvolvimento `admin@voia.local` (sem senha/autenticação nesta etapa).

```bash
# Local
npx wrangler d1 migrations apply voia-db --local

# Remoto (produção/preview) — requer database_id real e `wrangler login`
npx wrangler d1 migrations apply voia-db --remote
```

## Seed de desenvolvimento

`seeds/dev_seed.sql` contém dados **fictícios** (usuários, organizações e
projetos de exemplo) para facilitar o desenvolvimento local. Nunca é
aplicado automaticamente — rode manualmente apenas contra o banco local:

```bash
npx wrangler d1 execute voia-db --local --file=./seeds/dev_seed.sql
```

## Comandos principais

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Ambiente de desenvolvimento (Vite + Worker) |
| `npm run build` | Type-check + build de produção |
| `npm run lint` | ESLint |
| `npm run check` | Type-check + build + `wrangler deploy --dry-run` |
| `npm run cf-typegen` | Regera `worker-configuration.d.ts` a partir de `wrangler.json` |
| `npm run deploy` | Deploy no Cloudflare Workers (requer `wrangler login` e `database_id` real) |

## Health check

`GET /api/health` confirma, sem expor dados sensíveis:

- se a API está respondendo;
- se o binding D1 está configurado e a conexão funciona;
- se a migration inicial já foi aplicada (tabela `usuarios` existe).

## Estágio atual

Etapa A (fundação) concluída: banco de dados inicial, identidade visual,
estrutura de pastas, health check e tela temporária de verificação.
Autenticação, CRM, financeiro, R2, documentos, tarefas, etapas, IA VOIA e
dashboards definitivos ficam para as próximas etapas.

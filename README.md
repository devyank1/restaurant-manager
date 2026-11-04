# Cardápio Digital

## Como rodar

1. `pnpm install`
2. `pnpm db:up` (Postgres em `localhost:5433`, bancos `cardapio` e `cardapio_test`)
3. Copie `.env.example` para `apps/api/.env` e `apps/api/.env.test.example` para `apps/api/.env.test`
4. `pnpm --filter api exec prisma migrate dev && pnpm --filter api db:seed`
5. `pnpm --filter api start:dev` e abra `http://localhost:3000/health`

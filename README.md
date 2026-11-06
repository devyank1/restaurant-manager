# Cardápio Digital

## Como rodar

1. `pnpm install`
2. `pnpm db:up` (Postgres em `localhost:5433`, bancos `cardapio` e `cardapio_test`)
3. Copie `.env.example` para `apps/api/.env` e `apps/api/.env.test.example` para `apps/api/.env.test`
4. `pnpm --filter api exec prisma migrate dev && pnpm --filter api db:seed`
5. `pnpm --filter api start:dev` e abra `http://localhost:3000/health`

## Ver o cardápio no navegador ou no celular

1. Com o banco no ar e o seed rodado: `pnpm dev:api` em um terminal e `pnpm dev:cliente` em outro.
2. Pegue o token de uma mesa:
   `docker compose exec postgres psql -U cardapio -d cardapio -c 'select numero, token from "Mesa" order by numero'`
3. No computador: `http://localhost:5173/m/<token>`
4. No celular (mesma rede Wi-Fi): `http://<ip-do-computador>:5173/m/<token>` — o `pnpm dev:cliente` mostra o endereço "Network".

## Vídeos dos pratos

- Coloque os vídeos originais em `apps/cliente/videos-brutos/<slug>.mp4` (slugs: `mix-da-casa`, `pizza-margherita`, `parmegiana-da-casa`, `picanha-na-chapa`, `chopp-500ml`, `petit-gateau`).
- Rode `node apps/cliente/scripts/preparar-videos.mjs` (precisa do FFmpeg). Ele corta para vertical 720x1280, até 12 s, e gera o poster.
- Sem vídeos reais, `node apps/cliente/scripts/preparar-videos.mjs --placeholder` gera gradientes para a demo.

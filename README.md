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

## App da equipe (garçom e dono)

1. Com a API no ar: `pnpm dev:equipe` (porta **5174**) e abra `http://localhost:5174`.
2. Logins da demo (senha `demo1234`): `ana@demo.com` e `bruno@demo.com` (garçons), `dono@demo.com` (dono).
3. Ligue **Em turno** para receber chamados. Sem ninguém em turno, o chamado vai "para todos".
4. Abrir a mesa: encoste o celular (logado no app da equipe) na etiqueta. O cardápio percebe que é da equipe e abre a tela da mesa. Também dá para tocar no chamado ou em "Todas as mesas".
5. Sem celular à mão: `pnpm garcom chamados`, `pnpm garcom confirmar 7` etc. simulam o garçom pelo terminal.

## Tela da produção (cozinha e bar)

1. **Uma vez, no banco de dev:** `pnpm --filter api dev:etapa3`. Ele cria a Dani (`cozinha@demo.com` / `demo1234`) e põe as Bebidas no **Bar**, sem mexer no resto (o seed troca os tokens das mesas, então não use o seed no dev).
2. No tablet/TV, abra o app da equipe (`http://localhost:5174` ou o endereço do Tailscale) e entre com `cozinha@demo.com`. A cozinha cai direto na produção.
3. Escolha a estação no topo (Cozinha ou Bar; o aparelho lembra) e toque **Ativar som** para ouvir o bipe de pedido novo. A tela fica ligada enquanto estiver aberta.
4. Toque no item para avançar (Na fila → Preparando → Pronto) ou use **Começar** / **Pronto** no cartão. Cartão amarelo: esperando há 10 min; vermelho: 20 min. Cancelado aparece em vermelho até tocar **Ok**.
5. O dono vê a mesma tela pelo botão **Produção** no início.
6. Pela regra: a primeira rodada da mesa (e a de celular novo) passa pelo garçom; as seguintes vão direto para a produção, e o garçom pode cancelar nos primeiros 2 minutos. Quando a estação termina, o garçom recebe "Pronto" e toca **Entregar prontos**.

## Celular com HTTPS (Tailscale)

Notificação push, instalar como app e o botão "Ler etiqueta" (Web NFC) só funcionam em HTTPS.

1. **Uma vez, no admin do Tailscale:** DNS → ative *MagicDNS* e *HTTPS Certificates*.
2. Publique os dois apps na sua tailnet (deixe `pnpm dev:cliente` e `pnpm dev:equipe` rodando):
   ```
   tailscale serve --bg --https=443 http://localhost:5173
   tailscale serve --bg --https=8443 http://localhost:5174
   ```
3. Cliente: `https://<máquina>.<tailnet>.ts.net/m/<token>` · Equipe: `https://<máquina>.<tailnet>.ts.net:8443`.
   O cardápio já manda quem é da equipe para a porta 8443 quando o endereço é HTTPS.
4. Chaves do push: `pnpm --filter api vapid`, copie as três linhas `VAPID_*` para `apps/api/.env` e reinicie a API.
5. No celular, abra o app da equipe, faça login e toque em **Ativar notificações**. No iPhone, antes, use "Adicionar à Tela de Início" (push só funciona no app instalado).

Ícones do app (`apps/equipe/public/icone-*.png`), gerados com FFmpeg:
```
ffmpeg -f lavfi -i "color=c=0xff5a1f:s=512x512" -frames:v 1 -vf "drawtext=text='E':fontcolor=white:fontsize=307:x=(w-text_w)/2:y=(h-text_h)/2:fontfile='C\:/Windows/Fonts/arialbd.ttf'" apps/equipe/public/icone-512.png
```

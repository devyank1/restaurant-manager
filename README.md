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

## Conta e fechamento

1. **Uma vez, no banco de dev:** `pnpm --filter api dev:conta`. Liga os 10% (vem marcado) e o couvert de R$ 15,00 por pessoa (vem desmarcado). Não use o seed no dev.
2. No app da equipe, abra a mesa e toque **Fechar conta**. A tela mostra os itens, o **Serviço (10%)** e o **Couvert** (com o número de pessoas) e o total.
3. Escolha **Cartão**, **Pix** ou **Dinheiro** e toque **Fechar conta · R$ X**. O pagamento e a divisão são feitos na maquininha; o sistema só dá baixa.
4. A mesa fica livre e o garçom volta a contar como livre. O cliente vê **Conta fechada** com o **Avalie no Google** em destaque; **Voltar ao cardápio** abre uma conta nova (o primeiro pedido passa pelo garçom).
5. Se um pedido for confirmado enquanto a conta está aberta na tela, o app avisa "A conta mudou" e mostra o total novo. Pedido aguardando confirmação impede fechar.
6. Pelo terminal: `pnpm garcom fechar 7 pix`, `pnpm garcom fechar 7 cartao --couvert 2`, `pnpm garcom fechar 7 dinheiro --sem-servico`.

## Estoque (gerente)

1. **Uma vez, no banco de dev:** `pnpm --filter api dev:estoque`. Cria fornecedores, 7 itens (Ovos, Massa de pizza, Queijo muçarela, Calabresa, Bacon, Chopp Pilsen, Picanha) e as receitas da Pizza Margherita (P 70%, M 100%, G 150%), do Chopp 500ml e da Picanha na Chapa. Pode rodar de novo: não apaga nada e não mexe nas quantidades que você já contou. Não use o seed no dev.
2. Entre como dono em `http://localhost:5174` → botão **Estoque** no início (mostra quantos itens pedem atenção).
3. Pelo cardápio (`5173`), peça 2 pizzas G → em **Itens → Massa de pizza**, o histórico mostra uma venda de −900 g.
4. Entre como cozinha → **Avisar perda** no topo → Ovos, 30 un, Acidente. O dono recebe o aviso e vê em **Perdas de hoje**.
5. Dono → **Gerar lista de compras** → ajuste → **Salvar lista** → **Baixar planilha** (uma aba por fornecedor) e **Mandar no WhatsApp**.
6. Quando a compra chegar → **Chegou compra** no Estoque → confira as quantidades → **Confirmar chegada**.
7. Errou uma perda? Logo depois de avisar, **Desfazer** (vale para o seu último lançamento, por 10 minutos).

O sistema nunca marca prato como esgotado sozinho: quando um item acaba, o Estoque mostra os pratos que usam ele e o gerente decide (**Marcar como esgotado**, ou em **Receitas**).

## Painéis e metas

1. **Uma vez, no banco de dev:** `pnpm --filter api dev:paineis`. Define 12 min nas Pizzas, 5 min no Bar, meta da equipe de R$ 3.000/dia, meta padrão do garçom de R$ 800/dia e, na Cozinha, 85% no tempo e zero esquecidos. Só preenche o que está vazio (não desfaz o que você mudou pelo app) e não cria vendas: os números vêm do uso real. Rodar de novo imprime "nada a fazer".
2. Entre como dono em `http://localhost:5174`: o início é o painel da equipe (meta no topo, atalhos **Estoque**, **Metas** e **Tempo de preparo**, cartões da equipe e números da operação). **Hoje / Semana** troca o período.
3. Em outro navegador, entre como Ana e ligue **Em turno**: o cartão dela aparece no painel do dono, e ela vê o **Meu dia** acima dos chamados.
4. Peça pelo cardápio (`5173`) e a Ana confirma: o valor entra na barra dela e na da equipe. Na produção, o cartão fica amarelo depois do tempo esperado + 10% e vermelho no dobro.
5. Feche a conta: conta uma mesa atendida para a Ana.
6. Dono → **Metas** → baixe a meta da equipe para R$ 10 → **Salvar**. Na próxima venda, aparece "A equipe bateu a meta…" para todos (uma vez por dia).
7. Entre como cozinha → **Hoje** na produção: pedidos de hoje, % no tempo e os esquecidos (sem nomes). **Voltar** no topo volta à fila.

Abaixo da meta a barra fica cinza, nunca vermelha. Os avisos de cuidado ("X h em turno sem pausa", padrão 4 h em **Metas → Cuidado com a equipe**; "Pegou bem mais mesas que os colegas") aparecem em amarelo, só no cartão da pessoa.

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

## Produção (servidor marnessa)

- Imagens montadas no PC e enviadas por SSH (o disco do servidor está quase cheio; nada é compilado lá):
  ```
  docker build -f deploy/Dockerfile --target api -t cardapio-api .
  docker build -f deploy/Dockerfile --target web -t cardapio-web --build-arg VITE_EQUIPE_URL=https://cardapio-equipe.devyank.com .
  docker save cardapio-api cardapio-web | gzip -1 | ssh marnessa@100.105.122.90 "gunzip | docker load"
  ssh marnessa@100.105.122.90 "cd ~/cardapio && docker compose up -d"
  ```
- No servidor: `~/cardapio/docker-compose.yml` (cópia de `deploy/docker-compose.yml`) e `~/cardapio/.env` (segredos: `DB_SENHA`, `JWT_SEGREDO`, VAPID — só lá).
- A API aplica as migrations sozinha ao subir. Banco próprio (`cardapio-db-1`, volume `cardapio_dados`), separado do dev.
- O nginx escuta só em `127.0.0.1:8160`; o túnel da Cloudflare publica `cardapio.devyank.com` (cardápio) e `cardapio-equipe.devyank.com` (equipe), ambos para `http://localhost:8160`.

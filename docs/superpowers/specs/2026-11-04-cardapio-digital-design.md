# Cardápio Digital com Pedidos — Documento de Projeto

*04/11/2026. Versão para quem vai construir. A versão para não técnicos está em `first_preview.md`.*

Legenda: **[dono]** = decidido pelo dono do projeto. **[nossa decisão]** = escolha minha (Claude), que o dono do projeto pode revisar.

---

## 1. Intenção

Produto SaaS vendido por **mensalidade** a restaurantes [dono]. O cliente encosta o celular numa etiqueta NFC da mesa e abre um cardápio web moderno, com **vídeos dos pratos no estilo stories**. Por ele o cliente monta o pedido e chama o garçom. O garçom confirma pelo próprio celular, a cozinha recebe numa tela e tudo soma na conta da mesa.

**Por quê:** existem cardápios em formato de reels (referência em `images/`), mas são vitrines. O diferencial é cobrir o ciclo inteiro (pedido → garçom → cozinha → conta) e gerar dados para o dono. Isso justifica mensalidade e é mais difícil de copiar.

**Concorrente atual:** a Prozaria já usa um cardápio digital da Get In (menu.getin.app). A demo precisa mostrar claramente o que temos a mais: vídeos estilo stories e o fluxo de pedido completo.

**Contexto comercial:** os primeiros clientes serão prospectados do zero [dono]. O provável primeiro é o restaurante **Prozaria** (instagram.com/prozaria) [dono]. Por isso a primeira entrega útil é uma **demo que vende**: um restaurante de exemplo, bonito e funcionando de ponta a ponta, para mostrar ao dono do estabelecimento.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- O cardápio abre por aproximação, sem instalar app, e carrega rápido mesmo com Wi-Fi ruim.
- Os vídeos de prato rodam fluidos no estilo stories.
- O fluxo de pedido tem confirmação do garçom e evita trote.
- O garçom recebe o chamado mesmo com o celular no bolso.
- É multi-restaurante desde o primeiro dia.

**Não-objetivos (por agora)**
- Controle de estoque completo. Só um campo "esgotado" por prato [dono concordou].
- Integração de pagamento (maquininha/Pix integrados). O garçom vê o total e registra manualmente a forma de pagamento [nossa decisão].
- App nativo em loja. O painel do dono é web no computador [dono].
- Nome e marca do produto (ainda indefinidos [dono]). Usar nome provisório em configuração, fácil de trocar.

**Anti-objetivos (falhas mesmo que "funcione")**
- Exigir que o cliente baixe app ou faça cadastro para ver o cardápio.
- Vídeo travando, tela preta ou carregamento longo ao deslizar.
- O garçom perder um chamado.
- Valor da conta diferente do preço que o cliente viu.
- Um cliente conseguir ver ou mexer na conta de outra mesa.

## 3. Mesa física: etiquetas

- **Quatro cantos da mesa:** cantos alternados com Wi-Fi e cardápio, ou seja, 2 de cada em diagonal, para todos na mesa alcançarem [dono definiu os 4 cantos; a distribuição 2+2 é nossa interpretação].
- **Etiqueta Wi-Fi:** registro NDEF de Wi-Fi da rede de clientes, mais um **QR code `WIFI:` impresso** (o iPhone não lê Wi-Fi via NFC; a câmera do iPhone lê o QR) [dono + nossa decisão]. É estática, configurada fora do sistema. O sistema só gera o QR/arquivo para gravar.
- **Etiqueta Cardápio:** registro NDEF de URL `https://<dominio>/m/<token-da-mesa>`.
  - O token é **aleatório e não sequencial**, para impedir adivinhar outras mesas [nossa decisão].
  - É **a mesma etiqueta para cliente e garçom** [dono].
- O cardápio também mostra um botão "Conectar ao Wi-Fi" com nome da rede e senha para copiar, como alternativa.
- Portal cativo (Wi-Fi que abre o cardápio sozinho) fica como extra futuro, dependendo do roteador do restaurante.

## 4. Experiência do cliente (`/m/<token>`)

**Lista do cardápio**
- No topo: nome e logo do restaurante.
- Filtros por **categoria**, definidas por restaurante (ex.: Entradas, Lanches, Pratos, Bebidas, Sobremesas) [dono].
- Card do prato:
  - nome, descrição curta e preço;
  - com desconto: **preço promocional em destaque**, **preço original riscado** e o desconto (ex.: "-14%") [dono];
  - selo "Destaque" opcional, como na referência;
  - prato esgotado aparece apagado e não pode ser adicionado.

**Visualizador estilo stories** (ao tocar num prato)
- Vídeo vertical em tela cheia, com **barra de progresso no topo** [dono].
- Deslizar **para baixo/cima** passa para o próximo ou anterior prato, na ordem da categoria filtrada [dono]. A direção exata segue o padrão reels: deslizar para cima avança [nossa decisão].
- Botão voltar para a lista [dono].
- Rodapé com nome, preço (com regra de desconto) e descrição com "ler mais" [dono + referência].
- Botão "Adicionar ao pedido".
- Comportamento do vídeo [nossa decisão]:
  - inicia mudo (exigência de autoplay dos navegadores) e tem botão de som;
  - tocar pausa e retoma;
  - o vídeo repete em loop.
- **Pré-carrega o próximo vídeo** para não travar.
- Na v1, um vídeo por prato. A barra já é segmentada para aceitar vários clipes no futuro [nossa decisão].
- Prato sem vídeo: mostra foto/poster parado com a mesma interface.

**Pedido e chamado**
- **Carrinho compartilhado da mesa:** quem abrir o cardápio na mesma mesa vê e edita o mesmo carrinho, em tempo real [nossa decisão].
- "Enviar pedido" manda o carrinho como uma rodada.
- "Chamar atendente" funciona com ou sem pedido [dono].
- O cliente vê o status das rodadas (aguardando garçom, na cozinha, pronto, entregue) e o total parcial da conta.

**Avaliação**
- Botão "Avalie no Google", usando o link de avaliação configurado pelo restaurante [dono].
- O botão ganha destaque depois que a conta é fechada [nossa decisão].

## 5. Fluxo de pedido e regras

1. O cliente envia a rodada, gerando o evento `PedidoCriado`.
2. **Escolha do garçom** [dono]:
   - se a mesa já tem garçom responsável, vai para ele;
   - se não tem, vai para o garçom **em turno e livre** (sem mesa aberta sob sua responsabilidade);
   - se ninguém está livre, vai para quem **atendeu menos mesas no turno**;
   - em caso de empate, vai para quem está há mais tempo sem receber chamado [nossa decisão].
3. **Primeira rodada da mesa:** exige confirmação presencial [dono + nossa recomendação aceita].
   - O garçom recebe Push/WebSocket, vai à mesa e encosta o celular na etiqueta do cardápio.
   - Com sessão de equipe, a URL `/m/<token>` leva à **tela da mesa no app do garçom**, não ao cardápio.
   - Ali ele confirma, ou edita (remove e adiciona itens) e confirma.
   - A confirmação "abre a mesa" e torna esse garçom o responsável.
4. **Rodadas seguintes:** vão **direto para a cozinha** [dono aceitou].
   - O garçom responsável recebe um aviso e pode **cancelar nos primeiros N minutos**. Padrão: 2 min, configurável.
   - O pedido chega à cozinha na hora. Se for cancelado, a cozinha vê como cancelado [nossa decisão].
5. **Exceções configuráveis pelo dono:** rodadas acima de R$ X, ou com itens marcados como "exige confirmação", sempre pedem confirmação presencial.
6. A cozinha marca **em preparo** e depois **pronto**. O garçom responsável é avisado e marca **entregue**.
7. **Fechar a conta:** o garçom encosta na etiqueta e vê o total.
   - Registra a forma de pagamento (cartão, Pix, dinheiro) e fecha a conta.
   - A mesa é liberada e o garçom volta a contar como "livre".
8. **Preço congelado:** o item do pedido guarda o preço do momento em que foi pedido [nossa decisão, por causa do anti-objetivo de preço divergente].

Todos os passos geram eventos persistidos (`ChamadoCriado`, `PedidoCriado`, `PedidoConfirmado`, `PedidoCancelado`, `PedidoEmPreparo`, `PedidoPronto`, `PedidoEntregue`, `ContaFechada`). Eles alimentam o tempo real e os relatórios.

## 6. Equipe e dono

- **App do garçom** (PWA instalável):
  - login;
  - botão "em turno" liga e desliga;
  - lista de chamados e das suas mesas;
  - tela da mesa: confirmar e editar rodada, ver a conta, fechar a conta.
- **Tela da cozinha** (PWA, tablet/TV sempre aberto): fila de pedidos por ordem de chegada, com ações "em preparo" e "pronto".
- **Painel do dono** (web, computador):
  - CRUD de categorias, pratos (preço, preço promocional, destaque, esgotado, exige confirmação, ordem), mesas (gerar token/URL e QR), garçons e logins;
  - configurações: Wi-Fi, link Google, janela de cancelamento, limite de valor;
  - relatórios: mais vendidos, tempo médio de preparo, tempo de resposta e mesas por garçom.
- **Upload de vídeo pelo restaurante** [dono: o restaurante grava]:
  - o dono envia pelo celular ou computador o vídeo cru;
  - o sistema converte e comprime (vertical 720×1280, H.264, ~1–2 MB, poster JPG).
- **Perfis:** dono/gerente, garçom, cozinha. Um restaurante pode ter vários de cada.

## 7. Técnico — decidido com o dono

- **TypeScript** em tudo. Backend em **Node com NestJS** [dono aceitou].
- **PostgreSQL + Prisma.** Relacional, multi-tenant por `restaurante_id` em todas as tabelas de negócio [dono aceitou].
- **Monolito orientado a eventos:** eventos internos do NestJS. Redis pub/sub só quando houver mais de uma instância [dono aceitou].
- **Tempo real:** WebSocket para telas abertas (cozinha, garçom com app aberto, carrinho do cliente). **Web Push (VAPID)** para o garçom com app em segundo plano [dono aceitou].
- **Front:** React + Vite.
  - App `cliente`: leve.
  - App `equipe`: PWA com garçom, cozinha e painel do dono [dono aceitou].
- **Vídeo:** Cloudflare R2 + CDN. O banco guarda só as URLs. Conversão com FFmpeg num worker [dono aceitou].
- **Cliente anônimo:** sem login; identificado pelo token da mesa e um id de dispositivo em cookie [nossa decisão].
- **Forma de trabalho** [dono]: o código é feito por etapas. Ao fim de cada etapa paramos, o dono do projeto revisa o código e só então seguimos.

## 8. Etapas

| Etapa | Entrega | Demo mostra |
|---|---|---|
| 0 | Monorepo (pnpm), API NestJS, Postgres/Prisma via Docker Compose, seed de um restaurante de exemplo | — |
| 1 | Cardápio do cliente: lista, filtros, preço com desconto, stories com vídeo, botão Wi-Fi, avaliação Google, seleção de opções + observação e **carrinho local** (só no aparelho; "Realizar pedido" e "Chamar atendente" visíveis, ativos na Etapa 2). Vídeos da demo: Pexels comprimidos, servidos estáticos. Visual aprovado: `.superpowers/brainstorm/*/content/cardapio-v1.html` | Já dá para mostrar ao dono |
| 2 | Carrinho compartilhado, sessão de mesa, chamar garçom, app do garçom, escolha do garçom, repasse do chamado sem resposta, confirmação na mesa, Push | Garçom recebe e confirma |
| 3 | Telas de produção por estação (cozinha/bar), status por item, conta da mesa e fechamento, janela de cancelamento | **Demo completa de ponta a ponta** |
| 4 | Painel do dono: cadastros, upload e conversão de vídeo, configurações, relatórios, regenerar token; super-admin para criar restaurantes | Produto vendável |

Revisão do dono do projeto ao fim de cada etapa.

## 8.1 Decisões complementares (após revisão)

- **Acesso pela URL da mesa** [nossa decisão]. O token é estático, então quem guardou ou fotografou a URL não pode ganhar acesso à conta de outro grupo:
  - existe uma **sessão de mesa**, criada no primeiro acesso e encerrada no `ContaFechada`;
  - cada dispositivo **entra na sessão atual** ao abrir a URL;
  - carrinho, status e conta só aparecem para dispositivos da sessão atual. Quando a sessão fecha, os dispositivos antigos perdem o acesso;
  - a **primeira rodada de cada dispositivo novo** exige confirmação do garçom, mesmo com a mesa já aberta;
  - o dono pode **regenerar o token** de uma mesa no painel.
- **Garçom que não responde** [nossa decisão]:
  - sem confirmação de leitura em 60 s (configurável), o chamado passa para o próximo garçom pela mesma regra;
  - depois da segunda tentativa, avisa todos os garçons em turno e o gerente;
  - o chamado nunca some até alguém aceitar.
- **Estações** [nossa decisão]:
  - cada categoria tem uma estação (padrão "cozinha"; ex.: "bar");
  - a tela de produção filtra por estação;
  - o status é controlado por item e a rodada fica "pronta" quando todos os itens estão prontos.
- **Cadastro de restaurantes e cobrança** [nossa decisão]:
  - na v1, restaurantes novos são criados por um perfil **super-admin** (nós), via painel simples ou script;
  - a cobrança da mensalidade é feita fora do sistema (manual). Integração de cobrança fica fora do escopo.

- **Celular dos garçons** [dono]:
  - **Android é o padrão recomendado**, mas não é obrigatório;
  - no Android, o app do garçom lê a etiqueta por aproximação de dentro do próprio app (Web NFC);
  - no iPhone, o garçom abre a mesa por uma **lista de mesas no app** ou lendo um **QR da mesa** com a câmera do app [nossa decisão].
- **Conta da mesa** [dono]:
  - o preço dos itens é **imutável**; o garçom não altera valor de item;
  - na tela da conta, o garçom tem **dois checkboxes: "10% de serviço" e "Couvert"**, que somam ao total quando marcados;
  - cada restaurante habilita ou desabilita essas opções no painel e define o valor do couvert;
  - o couvert é **por pessoa**, e o garçom informa quantas pessoas [nossa decisão];
  - os 10% incidem só sobre os itens, não sobre o couvert [nossa decisão];
  - o padrão de cada checkbox (marcado ou não) é configurável [nossa decisão].
- **Pagamento e divisão** [dono]:
  - pagamento e divisão da conta são feitos **na maquininha**;
  - o sistema só mostra o total e o garçom **dá baixa** na conta (registra forma de pagamento e fecha). Não há divisão de conta dentro do sistema.

- **Variações e observações dos pratos** [dono: tamanhos e observações; o resto é nossa decisão]:
  - cada prato pode ter **grupos de opções**:
    - **escolha única** (ex.: Tamanho P/M/G), em que cada opção define o preço;
    - **múltipla escolha** (ex.: Adicionais), com preço extra por opção, mínimo e máximo configuráveis;
  - **pizza meio a meio:** o grupo "Sabores" permite até 2 sabores. O preço é **o do sabor mais caro**, que é o costume no Brasil, e o dono pode trocar para "média";
  - **campo de observações** em texto livre por item (ex.: "sem cebola"). Aparece para o cliente ao adicionar o item, para o garçom ao confirmar e para a cozinha;
  - o preço promocional vale sobre o preço base de cada opção de tamanho;
  - o item do pedido **congela o preço já com as opções escolhidas**;
  - no stories, "Adicionar ao pedido" abre a seleção de opções quando o prato tem opções.

## 9. Deixado para quem constrói

- Estrutura de pastas, nomes de módulos, biblioteca de UI e estilo visual (desde que limpo e moderno, na linha da referência).
- Modelo de dados detalhado e formato dos eventos.
- Estratégia de autenticação da equipe (sugestão: JWT em cookie httpOnly).
- Hospedagem e deploy (decidir antes da Etapa 4).
- Conteúdo da demo: enquanto não houver material da Prozaria, usar restaurante fictício com vídeos livres (ex.: Pexels). A marca do restaurante é configurável.

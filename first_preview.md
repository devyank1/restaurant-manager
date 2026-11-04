# Primeira Visão do Projeto — Cardápio Digital Inteligente

*Resumo das conversas até aqui (03/11/2026). Documento sem parte técnica.*

---

## 1. A ideia em uma frase

Um sistema que vamos **vender para restaurantes, bares e lanchonetes**. O cliente encosta o celular na mesa, abre um cardápio moderno com vídeos dos pratos, faz o pedido e chama o garçom, tudo sem baixar nenhum aplicativo.

## 2. De onde veio

Vimos num bar um cardápio digital no estilo "stories do Instagram": vídeo do prato rodando, barrinhas de progresso em cima, preço com desconto e selo de "destaque". A ideia é fazer algo nessa linha, **só que mais completo**: além de mostrar o cardápio, o sistema cuida do pedido, do garçom, da cozinha e da conta.

## 3. Como o cliente usa

1. **Encosta o celular na etiqueta da mesa (NFC).**
   - Primeiro o celular entra no **Wi-Fi de clientes** do restaurante.
   - Logo em seguida abre o **cardápio daquela mesa**.
   - *Observação:* o cardápio abre por aproximação em qualquer celular moderno. Já o Wi-Fi automático pela etiqueta não funciona no iPhone e varia entre modelos de Android. A solução para o Wi-Fi está em estudo (veja a seção 9).
2. **Vê o cardápio:**
   - nome do restaurante no topo;
   - categorias para filtrar (entradas, lanches, pratos, bebidas, sobremesas), que cada restaurante define do seu jeito;
   - cada prato com nome, descrição e preço. Quando tem desconto, aparece o **preço novo**, o **preço antigo riscado** e quanto está economizando.
3. **Toca num prato e vê o vídeo no estilo story:**
   - em vez de foto, um **vídeo especial do prato** em tela cheia;
   - barrinha de tempo em cima, como no Instagram;
   - deslizando, passa para o próximo prato;
   - botão de voltar;
   - embaixo, nome e preço do prato.
4. **Monta o pedido** adicionando os itens no carrinho da mesa.
5. **Botão "Chamar atendente"** a qualquer momento.
6. **No final, pode avaliar o restaurante no Google** direto pelo celular.

## 4. Como funciona o atendimento

### Quem é chamado
O sistema chama **o garçom que está livre** (sem mesa em atendimento). Se todos estiverem ocupados, chama **o que atendeu menos mesas** até aquele momento. Assim o trabalho fica bem dividido.

### O caminho do pedido

**Primeiro pedido da mesa:**
1. O cliente monta o pedido no celular e envia.
2. O garçom recebe um aviso no celular dele: *"Mesa 7 — pedido para confirmar"*.
3. O garçom vai até a mesa e encosta o celular dele na mesma etiqueta. Vê o pedido montado.
4. Confere com o cliente:
   - se estiver certo, confirma e o pedido vai para a cozinha;
   - se não estiver, tira ou adiciona itens ali mesmo e depois confirma.
5. A cozinha recebe numa tela, prepara e marca como pronto.
6. O garçom é avisado e entrega.

**Pedidos seguintes da mesma mesa:**
- Vão **direto para a cozinha**, sem o garçom precisar ir até a mesa.
- O garçom da mesa recebe um aviso (*"Mesa 7 pediu +2 chopes"*) e pode **cancelar nos primeiros 1 ou 2 minutos** se algo parecer estranho.
- O dono pode definir regras de segurança. Por exemplo, pedidos acima de certo valor ou certos itens (bebida alcoólica, prato caro) **sempre** precisam da confirmação do garçom.

### Por que esse meio-termo?
- **Evita trote e pedido errado**, que costumam acontecer no começo (criança mexendo no celular, mesa errada).
- **O garçom continua perto do cliente.** Muitos donos não querem perder esse contato.
- **O pedido chega certo na cozinha**, sem erro de anotação.
- **É mais rápido** para quem já está sentado e quer pedir mais.
- **Quem não gosta de celular** pode pedir do jeito tradicional, direto ao garçom.

### A conta
- Tudo o que é pedido **vai somando na conta da mesa** automaticamente.
- Na hora de fechar, o garçom encosta o celular na etiqueta e **vê o total na hora**.
- O pagamento é feito na **maquininha** (cartão por aproximação) ou por **Pix** no celular do cliente.

## 5. As partes do sistema

| Parte | Quem usa | Para quê |
|---|---|---|
| **Cardápio do cliente** | Cliente, no próprio celular | Ver pratos e vídeos, pedir, chamar o garçom, avaliar |
| **App do garçom** | Garçom, no celular dele | Receber chamados, confirmar pedidos, ver a conta da mesa |
| **Tela da cozinha** | Cozinheiros | Receber pedidos e marcar quando estão prontos |
| **Painel do dono** | Dono ou gerente, no computador | Cadastrar pratos, vídeos, preços, promoções, garçons e mesas, e ver relatórios |

**Nada disso precisa ser baixado em loja de aplicativos.** O cliente só encosta o celular e o cardápio abre. O garçom e a cozinha "instalam" o sistema na tela inicial com um toque.

## 6. Diferenciais para vender

- **Visual moderno**, com vídeos em vez de fotos. O prato "vende sozinho".
- **Vende mais.** Dá para destacar pratos, mostrar promoções e sugerir acompanhamentos ("Que tal uma batata?").
- **Atende mais mesas com a mesma equipe.**
- **Menos erros de pedido.**
- **Relatórios para o dono:** tempo médio de preparo, tempo de resposta dos garçons, quem atendeu mais, pratos mais vendidos.
- **Mais avaliações no Google**, o que traz novos clientes para o restaurante.

## 7. O que fica para depois

- **Controle de estoque completo** (ingredientes, baixa automática). É um produto grande por si só. No começo teremos apenas um botão **"item esgotado"** para o dono tirar um prato do cardápio na hora.
- **App de celular "de loja"** para o dono: só se algum cliente pedir. No início, o painel funciona pelo navegador do computador.

## 8. Como vamos começar

- **Vamos procurar os primeiros clientes do zero.**
- Por isso, a primeira entrega é uma **demonstração que vende**: um restaurante fictício, bonito, com vídeos de pratos, para abrir na frente do dono e ele sentir o produto na mão.
- Vamos construir **por etapas**, começando pelo que mais impressiona:
  1. Cardápio do cliente com os vídeos estilo story e o botão de chamar o garçom.
  2. App do garçom e o caminho completo do pedido.
  3. Tela da cozinha.
  4. Painel do dono e relatórios.
- Ao final de cada etapa, paramos para revisar antes de seguir.

## 9. Perguntas ainda em aberto

- Nome e marca do produto: ainda sem definição.
- Preço: será **mensalidade**. O valor e se ele varia pelo tamanho do restaurante ainda não foram decididos.
## 10. Já decidido

- **Cada mesa terá duas etiquetas de aproximação:**
  - **Etiqueta do Wi-Fi:** conecta o celular na rede de clientes. Como o iPhone não aceita Wi-Fi por aproximação, ela terá também um **QR code impresso**, que a câmera do iPhone lê para conectar.
  - **Etiqueta do cardápio:** abre o cardápio da mesa para o cliente. **É a mesma etiqueta que o garçom usa** para confirmar pedidos e ver a conta.
  - As duas ficam afastadas uma da outra, para o celular não ler a errada.

- **Os vídeos dos pratos são gravados pelo próprio restaurante.** O sistema precisa deixar o envio fácil, direto do celular.
- **Primeiro alvo: restaurantes.** O provável primeiro cliente é a Prozaria (instagram.com/prozaria).

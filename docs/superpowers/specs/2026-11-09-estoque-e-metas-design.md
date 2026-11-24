# Estoque, perdas, receitas, painéis e metas — Documento de projeto

Complementa `2026-11-04-cardapio-digital-design.md`, que fica como base. As etapas 0–3 estão prontas: cardápio, pedido, app do garçom, produção por estação, conta e fechamento.

Marcação usada neste documento:
- **[dono]**: decidido pelo dono do projeto nesta conversa.
- **[nossa decisão]**: escolha do Claude, que o dono pode revisar.

## 1. Intenção

O restaurante precisa saber **o que tem, o que está acabando e o que se perdeu**, sem planilha paralela e sem confusão. E precisa de números que ajudem a **planejar e cuidar da equipe**, não de números que virem cobrança.

O dono do projeto foi explícito sobre isso [dono]:

> "talvez não algo que gere um 'escravismo' pelo número, porque se o gerente começar a comparar 'esse vendeu mais que aquele' e começar a cobrar, e o garçom ficar com um possível burnout, pode prejudicar mais o ambiente."

Quem usa:
- **Gerente**: na v1 é o perfil `DONO`. O spec base trata "dono/gerente" como um perfil só. Ele cuida do estoque, das compras, das metas e lê os painéis.
- **Cozinha/bar e garçom**: avisam perdas e veem os próprios números.

Uso: no app `equipe`, pelo computador ou pelo celular do gerente.

**Requisito de entrega [dono]:**

> "preciso que até o fim dessa parte 4, tenhamos o ecossistema do gerente utilizável pra ele mexer (e eu testar)"

- Ao fim da etapa 4 (4A + 4B + 4C), tudo o que o gerente configura ou consulta é feito **pelo app**, sem script nem seed.
- Cada sub-etapa traz as telas de cadastro de que precisa. O script de dev serve só para preencher a demo.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- O estoque baixa sozinho pela venda, usando a receita de cada prato [dono].
- O gerente lança contagens e a chegada das compras [nossa decisão].
- A cozinha e o garçom avisam perdas na hora ("quebrou uma cartela de ovos") [dono].
- O gerente é avisado quando um item chega no mínimo e quando alguém registra uma perda [dono].
- Lista de compras gerada pelo sistema, exportada em **planilha** e enviada aos **fornecedores** [dono].
- Painéis da equipe, da cozinha e do garçom, com **metas** [dono].
- Interface simples para quem não é técnico, com boa acessibilidade [dono].

**Não-objetivos (v1)**
- Contabilidade, custo médio ponderado, CMV, nota fiscal e integração com fornecedor.
- Compra automática sem o gerente aprovar.
- Previsão de demanda com IA.

**Anti-objetivos** (o que faria isto fracassar mesmo funcionando)
- **Ranking ou pódio de garçons**, "quem vendeu mais", ordenar pessoas por desempenho, cor vermelha de "atrasado" na meta de alguém [dono].
- **Prato que some do cardápio sozinho** porque o estoque do sistema zerou por um esquecimento de baixa [dono]:

  > "deixa o gerente marcar isso ele mesmo, que às vezes ele pode ter esquecido de dar baixa e o prato ficar indisponível antes do tempo."

- **Desestimular o aviso de perda.** Quem avisa não é identificado nos painéis. Acidente não conta contra a meta de ninguém [nossa decisão].

## 3. Etapa 4A — Estoque

### 3.1 Itens de estoque [nossa decisão nos detalhes]
- **Item:** nome (ex.: "Ovos", "Bacon", "Chopp Pilsen"), unidade, quantidade atual, **mínimo** (dispara o aviso), **nível cheio** (base da sugestão de compra) e fornecedor (opcional).
- **Unidades:**
  - `UN` (unidade);
  - `G` (o gerente digita em g ou kg);
  - `ML` (o gerente digita em ml ou L).
  - O sistema guarda na unidade base, em número inteiro, e mostra "1,5 kg".
- **Fornecedor:** nome, telefone (WhatsApp) e observação.
- **Embalagem de compra (opcional):** nome e quanto vem nela, ex.: "Cartela" = 30 UN, "Barril" = 30 L [nossa decisão].
  - A lista de compras, a planilha e o WhatsApp mostram "2 Cartelas (60 un)".
  - "Compra chegou" aceita a quantidade em embalagens ou na unidade.
- **Quantidade negativa:** aparece como "0 (conferir)". Não trava a venda.

### 3.2 Receitas (ficha técnica) [dono: receita; detalhes nossa decisão]
- **Prato:** cada prato pode ter uma receita, que é uma lista de (item, quantidade por porção). A receita é opcional: prato sem receita não baixa estoque.
- **Opções do prato:**
  - cada **opção** pode ter a própria receita, que soma à do prato (ex.: adicional Bacon = 50 g de bacon);
  - toda opção de **escolha única** pode ter um **multiplicador**. O padrão é 1; ex.: G = 1,5. Não precisa de marcação de "grupo de tamanho": um multiplicador diferente de 1 já indica que a opção muda o tamanho [nossa decisão].
  - **Sabores** (meio a meio): a receita de cada sabor escolhido entra **dividida pelo número de sabores**.
  - **O multiplicador vale para a receita base e para a dos sabores.** Os adicionais (múltipla escolha) não multiplicam [nossa decisão].
    - Ex.: pizza G meio a meio = 1,5 × (base + sabor A ÷ 2 + sabor B ÷ 2) + adicionais.
- **Quando baixa e quando volta:**
  - baixa quando a rodada vira `CONFIRMADA`, seja pelo garçom ou direto;
  - volta quando a rodada é cancelada na janela;
  - rodada recusada nunca baixou.
- **Registro:** cada baixa vira movimento de estoque do tipo `VENDA`, ligado à rodada.

### 3.3 Movimentos
Todo movimento é registrado com tipo, item, quantidade (+/−), quem, quando e observação. Tipos:
- `VENDA` (automático, pela receita);
- `ESTORNO` (cancelamento);
- `ENTRADA` (compra chegou);
- `CONTAGEM` (o gerente informa o real; o sistema grava a diferença);
- `PERDA` (veja 3.4).

O histórico do item mostra os movimentos.

**Desfazer** [nossa decisão]:
- vale só para o **último movimento que a própria pessoa lançou** (`ENTRADA`, `CONTAGEM` ou `PERDA`), nos primeiros **10 minutos**;
- `VENDA` e `ESTORNO` nunca se desfazem à mão: seguem o pedido.

### 3.4 Perdas avisadas pela cozinha e pelo garçom [dono]
- **Botão no app:** "Avisar perda" no app da cozinha e no do garçom, com 3 toques:
  1. escolher o item (busca e os mais usados no topo);
  2. a quantidade;
  3. o motivo.
- **Motivos:** `Acidente` (caiu, quebrou), `Validade`, `Erro de preparo`, `Outro` (com texto).
- **Efeito:** o estoque baixa na hora, e o gerente recebe aviso (push + selo no painel).
- **Nos painéis**, a perda aparece **sem o nome de quem registrou**. O nome só fica no histórico do item, para o gerente tirar dúvida [nossa decisão].

### 3.5 Avisos ao gerente
- **Item chegou no mínimo ou abaixo:** push e selo "Acabando". Aviso uma vez por cruzamento do mínimo, não a cada venda [nossa decisão].
- **Item chegou a zero:** o aviso traz os pratos que usam o item e um botão **"Marcar como esgotado"** em cada um. **O sistema nunca esgota sozinho** [dono].
- **Perda registrada:** "Perda: 30 Ovos (Acidente)" [nossa decisão].

### 3.6 Lista de compras [dono: planilha e fornecedores; detalhes nossa decisão]
- **Geração:** o botão "Gerar lista de compras" junta os itens no mínimo ou abaixo e sugere a quantidade `nível cheio − atual`.
- **Ajuste:** o gerente muda as quantidades, tira ou põe itens.
- **Agrupamento:** a lista sai separada por fornecedor.
- **Planilha:** baixar **.xlsx**, com uma aba por fornecedor e as colunas Item, Quantidade, Unidade, Observação.
- **WhatsApp:** botão por fornecedor que abre o WhatsApp com o pedido já escrito (link `wa.me` + texto).
- **Chegada:** "Compra chegou" lança `ENTRADA` com as quantidades da lista, que o gerente confirma ou corrige.

## 4. Etapa 4B — Painéis e metas

### 4.0 Dia de serviço, crédito e turnos [nossa decisão]
- **Dia de serviço:**
  - vai das **05:00 às 04:59** do dia seguinte, no fuso **America/Sao_Paulo**, para o serviço que passa da meia-noite não virar dois dias;
  - "hoje", "a noite" e a meta diária usam o dia de serviço;
  - a **semana** começa na segunda-feira, às 05:00.
- **Crédito do valor vendido:** o garçom responsável pela mesa **no momento em que a rodada foi confirmada**. A rodada passa a guardar `garcomId` na confirmação.
- **Crédito da mesa atendida:** o garçom responsável no **fechamento da conta**. Conta a sessão fechada no período.
- **Valor vendido da equipe** = soma das rodadas confirmadas e não canceladas no período, **sem 10% e couvert** (a mesma base da meta individual). Assim, o total da equipe é a soma das partes, mais as mesas sem garçom.
- **Registro de turnos:**
  - nova tabela com início e fim de cada "Em turno" de cada pessoa;
  - **pausa** = desligar e ligar "Em turno" de novo;
  - "X h sem pausa" = tempo contínuo do turno atual;
  - "mais mesas que os colegas" compara com a média dos garçons que trabalharam **no mesmo dia de serviço**.

### 4.1 Tempo esperado por prato [dono]
- **Cadastro:** cada prato tem **tempo de preparo esperado** (min). A categoria tem um padrão, que o prato herda.
- **Pedido no tempo:** a estação o deixou pronto até **tempo esperado × 1,10** [dono: +10%]. Numa rodada com vários pratos, vale o **maior** tempo esperado dos itens da estação.
- **Cores do cartão na tela da produção** (troca os 10/20 min fixos da 3A) [nossa decisão]:
  - amarelo quando passa de esperado × 1,10;
  - vermelho quando passa de esperado × 2.
- **Esquecido:** pedido que passou de esperado × 2.
- **Prato sem tempo e categoria sem padrão:** usa 15 min [nossa decisão].

### 4.2 Metas [dono]
O gerente define todas as metas.

- **Meta da equipe:** em **valor vendido** ou **mesas atendidas**, por dia ou por semana.
  - Fica no topo de todos os painéis, maior que as individuais.
  - Todos da equipe a veem.
  - Ao bater, a comemoração aparece para todos.
- **Meta individual do garçom:** em **valor vendido** (rodadas confirmadas nas mesas em que ele era o responsável) e/ou **mesas atendidas** (contas fechadas em que ele era o responsável), por dia ou por semana.
  - **Meta padrão:** um valor igual para todos os garçons, que vale **sempre** (todo dia ou toda semana) até o gerente mudar.
  - **Ajuste por pessoa:** o gerente pode dar um valor diferente a alguém, por exemplo a quem trabalha meio período.
  - A tela de ajuste mostra só a pessoa sendo editada, sem lista comparando os valores.
  - Essa regra vale também para a meta da equipe e para a da estação [nossa decisão; o dono não respondeu, pode revisar].
  - Ele vê a dele.
  - O gerente vê todas, em cartões por pessoa.
- **Meta da estação** (Cozinha, Bar), nunca de pessoa (o login é por estação):
  - **% de pedidos no tempo** (ex.: 85%);
  - **zero esquecidos** na noite.
- **Como a meta aparece:** abaixo da meta, a barra fica **neutra** (nunca vermelha). Bateu: verde e comemoração.

### 4.3 Painel da equipe (gerente)
- **No topo:** a meta da equipe.
- **Cartões por pessoa** (garçons em turno ou que trabalharam no período), em **ordem alfabética**, sem opção de ordenar por desempenho [dono]. Cada cartão traz:
  - **avisos de cuidado no topo do cartão** [dono]:
    - "X h em turno sem pausa", contado desde o último "Em turno". O padrão é 4 h, configurável [nossa decisão];
    - "pegou bem mais mesas que os colegas", quando passa da média + 3 no turno [nossa decisão];
  - as barras da meta pessoal.
  - **Sem** o contexto do movimento da casa ao lado do número [dono].
- **Números da operação:**
  - movimento por hora e por dia da semana (para escala);
  - faturamento e ticket médio;
  - pratos mais vendidos;
  - tempo de preparo por estação (sem nome);
  - chamados que demoraram (sem nome);
  - perdas da semana por item e motivo (sem nome).

### 4.4 Painel do garçom
O que o garçom vê:
- a meta da equipe;
- as suas metas;
- as mesas atendidas hoje e o seu turno.

O garçom vê exatamente o que o gerente vê sobre ele [nossa decisão]. Nada de colegas.

### 4.5 Painel da cozinha/bar
- a meta da estação;
- os pedidos de hoje;
- % no tempo;
- os esquecidos.

Tudo em clima de "dia em andamento", sem nomes.

## 5. Acessibilidade e simplicidade [dono]
- **Botões e texto:** botões grandes (alvo de toque mínimo de 44 px), texto de no mínimo 16 px e contraste AA no tema escuro atual.
- **Telas:** poucas por fluxo. A tela inicial do estoque mostra só três blocos:
  - **Acabando**;
  - **Perdas de hoje**;
  - **Gerar lista de compras**.
- **Linguagem do dia a dia:** "Chegou compra", "Contar estoque", "Avisar perda". Sem termos contábeis.
- **Leitor de tela:** tudo funciona com leitor de tela, com rótulos nos botões e números lidos com unidade ("1,5 quilo").
- **Erros e confirmações:** confirmação antes de ações que mudam muito o estoque, como uma contagem com diferença grande. Desfazer o último movimento [nossa decisão].

## 6. Técnico
- **Base:** o mesmo stack. API NestJS + Prisma (multi-tenant por `restauranteId`) e telas no app `equipe` (PWA).
- **Gerente:** o perfil `DONO`. As rotas de estoque e de metas exigem `DONO`. "Avisar perda" aceita `GARCOM`, `COZINHA` e `DONO`.
- **Baixa pela venda:** acontece na **mesma transação** que confirma a rodada, com a mesa já travada. Assim a baixa nunca diverge do pedido.
- **Eventos novos persistidos:** `EstoqueMovimentado`, `EstoqueAcabando`, `PerdaRegistrada`, `MetaBatida`.
- **Números dos painéis:** calculados a partir dos eventos e tabelas que já existem (rodadas, carimbos de item da 3A, sessões fechadas da 3B, chamados).
- **Planilha:** gerada na API (biblioteca de .xlsx, à escolha do construtor).

## 7. Ordem
1. **4A Estoque:**
   - itens, fornecedores, receitas, baixa pela venda, movimentos, perdas, avisos, lista de compras com planilha e WhatsApp;
   - **telas do gerente:**
     - itens e fornecedores;
     - receita de cada prato e de cada opção (com multiplicador);
     - botão **Esgotado/Disponível** por prato.
2. **4B Painéis e metas:**
   - tempo por prato, cores da produção, metas e os três painéis;
   - registro de turnos e `garcomId` na rodada;
   - **telas do gerente:**
     - tempo de preparo por prato e o padrão por categoria;
     - metas (padrão e ajuste por pessoa);
     - horas de "sem pausa".
3. **4C Painel do dono** (Etapa 4 do spec base):
   - cadastros de categorias, pratos (criar, preço, promoção, destaque, opções, exige confirmação), mesas com QR e regenerar token, garçons e logins;
   - upload e conversão de vídeo;
   - configurações (Wi-Fi, Google, janela de cancelamento, limite, 10% e couvert);
   - super-admin.
   - **No fim da 4C:** um roteiro de teste do gerente de ponta a ponta, só pelo app.

O dono do projeto revisa ao fim de cada etapa.

## 8. Deixado para quem constrói
- O visual das telas, desde que siga o tema escuro do app equipe e a seção 5.
- A biblioteca de planilha e a forma dos gráficos.
- Os nomes de tabelas e módulos.

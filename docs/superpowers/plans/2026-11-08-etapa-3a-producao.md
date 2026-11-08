# Etapa 3A — Produção (cozinha e bar): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O pedido confirmado chega a uma tela de produção por estação (Cozinha, Bar). A estação marca cada item como "em preparo" e "pronto", o garçom responsável é avisado e marca "entregue", e o cliente acompanha o status. As rodadas seguintes vão direto para a produção, e o garçom pode cancelá-las nos primeiros 2 minutos.

**Parte de:** a Etapa 3 foi dividida em duas [nossa decisão, 08/11; o dono pediu para seguir o spec sem perguntas]:
- **3A (este plano):** produção.
- **3B:** conta da mesa (10% de serviço, couvert) e fechamento.

As Etapas 0 a 2B e o visual novo do app da equipe estão na `main` (merge `072ab34`).

**Architecture:**
- **Estação:**
  - campo `Categoria.estacao` (texto, padrão `"Cozinha"`);
  - o item da rodada **copia a estação** ao ser criado, igual ao preço congelado. Mudar a categoria depois não move pedido já feito.
- **Status por item** (`ItemRodada.status`): `NA_FILA` → `EM_PREPARO` → `PRONTO` → `ENTREGUE`.
  - A **fase** da rodada é calculada a partir dos itens, nunca gravada. Para o cliente:
    - `AGUARDANDO_GARCOM`;
    - `NA_COZINHA`: confirmada e algum item ainda não pronto;
    - `PRONTO`: todos prontos ou entregues, e algum ainda não entregue;
    - `ENTREGUE`;
    - `CANCELADA`.
- **Rodadas seguintes:**
  - Hoje a rodada já nasce `CONFIRMADA` quando a mesa tem garçom e o celular já foi confirmado.
  - A 3A acrescenta as **exceções** que forçam `AGUARDANDO_GARCOM`: total **acima** de `Restaurante.limiteConfirmacaoCentavos` (nulo = sem limite) ou algum prato com `exigeConfirmacao`.
  - A 3A acrescenta a **janela de cancelamento**: `Restaurante.janelaCancelamentoSegundos`, padrão 120. O garçom responsável, ou o dono, cancela dentro dela.
- **Telas:**
  - Módulo novo `producao` na API, e a rota `/producao` no app `equipe`.
  - Quem tem papel `COZINHA` só vê essa tela. O `DONO` chega a ela por um botão no início.
  - O garçom continua sem acesso à produção (403).
- **Tempo real:**
  - Evento novo `producao-mudou` na sala `equipe:<rest>`, que já recebe todo usuário logado. Como os outros, não carrega dados: a tela busca de novo.
  - Mudança de status de item também emite `rodadas-mudaram` (cliente) e `mesa-mudou` (garçom).
- **Push para o garçom responsável:**
  - pedido direto: `Mesa 7` / `Novo pedido na produção. Dá para cancelar em 2 min`;
  - estação terminou a parte dela numa rodada: `Mesa 7` / `Pronto no Bar: 2 itens`.

**Tech Stack:** NestJS 11 + Prisma 6 (migração nova), React 19 + Vite 8 + Vitest, socket.io e Web Push, que já existem.

**Spec:** `docs/superpowers/specs/2026-11-04-cardapio-digital-design.md` (§4 status das rodadas para o cliente, §5 passos 4–6, §6 Tela da cozinha, §8 linha da Etapa 3, §8.1 Estações)

## Global Constraints

- Dinheiro em **centavos inteiros**. Cancelar ou entregar nunca muda preço.
- **Banco de dev:**
  - nunca rodar o seed (ele troca os tokens das mesas) nem comando destrutivo;
  - a migração só **acrescenta** colunas e tabelas, com padrão;
  - os dados da demo (usuário da cozinha, Bebidas no Bar) entram por um script idempotente.
- Eventos persistidos, com os nomes do spec: `PedidoEmPreparo` (primeiro item da rodada entra em preparo), `PedidoPronto` (todos os itens prontos), `PedidoEntregue` (todos entregues) e `PedidoCancelado`, que já existe, com `dados.porJanela: true` no cancelamento pela janela.
- **Tempo real (lição da 2A):** toda conexão busca o estado de novo; `visibilitychange` e `online` derrubam e refazem a conexão. A tela da cozinha fica aberta horas: a mesma regra vale para ela.
- **A tela é a verdade da API:** ação recusada (409) mostra o aviso e recarrega. Nunca "adivinhar" o estado.
- Visual: tokens de `apps/equipe/src/estilo/tokens.css` (escala `--t-*`, cores por significado). A tela da cozinha é para **tablet ou TV**, com texto grande e toque grande.
- Estilo do código: API com prettier e ponto e vírgula; fronts com oxlint, sem ponto e vírgula, aspas simples. Testes de front com API falsa e socket falso (`apps/equipe/src/test/`).
- **Fora desta etapa:**
  - conta, 10%, couvert e fechamento (3B);
  - configurar janela, limite, estação e "exige confirmação" pelo painel (Etapa 4). Por enquanto valem os padrões do banco e o script de dev.

## Review Focus

1. **Duas telas da mesma estação** (ou toque duplo) no mesmo item. O PATCH grava o status pedido, então repetir é inofensivo. Se o item já foi entregue ou a rodada foi cancelada, a resposta é 409 `Este pedido mudou`, e a tela recarrega.
2. **O garçom cancela com 1:59 de janela enquanto a cozinha já está preparando.** O cancelamento vale. Na tela da cozinha, o cartão fica vermelho com `Cancelado`. Passou o prazo: 409 `O prazo para cancelar acabou`.
3. **Rodada com itens da Cozinha e do Bar.** Cada estação vê só os seus itens. O Push de pronto sai por estação. O cliente só vê `Pronto` quando todos os itens estão prontos.
4. **Rodada exatamente igual ao limite.** "Acima de R$ X" é estritamente maior. Limite nulo nunca exige confirmação.
5. **Papel errado:** cozinha nas rotas do salão e garçom nas rotas da produção recebem 403. A cozinha que loga cai direto em `/producao`, sem interruptor de turno.

---

### Task 1: API — estação, status por item, exceções e fase

**Files:**
- Modify:
  - `apps/api/prisma/schema.prisma`;
  - `apps/api/prisma/seed.ts` (usuário `Dani` / `cozinha@demo.com` / `COZINHA`; categoria `Bebidas` com `estacao: 'Bar'`);
  - `src/pedidos/pratos.ts` (`COM_OPCOES` passa a incluir `categoria: { select: { estacao: true } }`);
  - `src/rodadas/{rodadas.service.ts,rodadas-equipe.service.ts,mapear.ts,rodadas.types.ts}`;
  - `src/eventos/eventos.types.ts`.
- Create:
  - migração `prisma/migrations/<data>_producao/`;
  - `apps/api/scripts/dev-etapa3.mjs` (idempotente: faz upsert da Dani e põe as categorias de nome `Bebidas` no `Bar`);
  - script `"dev:etapa3"` no `package.json` da API;
  - `src/rodadas/fase.ts` + `fase.spec.ts`.
- Test: `test/rodadas.e2e-spec.ts`

**Interfaces:**
- Produces (schema):
  - `enum StatusItem { NA_FILA EM_PREPARO PRONTO ENTREGUE }`;
  - `ItemRodada`: `estacao String @default("Cozinha")`, `status StatusItem @default(NA_FILA)`, `emPreparoEm`, `prontoEm` e `entregueEm` (`DateTime?`);
  - `Rodada.canceladaEm DateTime?` e `Rodada.direta Boolean @default(false)` (nasceu confirmada sem o garçom; só ela tem janela de cancelamento);
  - `Categoria.estacao String @default("Cozinha")`;
  - `Prato.exigeConfirmacao Boolean @default(false)`;
  - `Restaurante`: `janelaCancelamentoSegundos Int @default(120)` e `limiteConfirmacaoCentavos Int?`.
- Produces (código):
  - `type FaseRodada = 'AGUARDANDO_GARCOM' | 'NA_COZINHA' | 'PRONTO' | 'ENTREGUE' | 'CANCELADA'`;
  - `faseDa(r: { status: StatusRodada; itens: { status: StatusItem }[] }): FaseRodada`, em `fase.ts`. Rodada confirmada sem itens dá `NA_COZINHA`;
  - `RodadaPublica` ganha `fase: FaseRodada`. Cada item público ganha `status: StatusItem`;
  - `ItemRodadaEquipe` ganha `estacao: string`;
  - `TipoEvento` ganha `'PedidoEmPreparo' | 'PedidoPronto' | 'PedidoEntregue'`.
- Rule (`RodadasService.enviar`): `precisaConfirmar = !sessao.garcomId || !dispositivo.confirmado || (limite !== null && total > limite) || algumPrato.exigeConfirmacao`.
  - Na rodada direta, `direta: true` e o evento `PedidoConfirmado` leva `dados.direto: true` e `dados.garcomId`.
  - O item congela `estacao` a partir de `prato.categoria.estacao`, em `enviar` e em `adicionarItem` do garçom.

- [ ] **Step 1: Testes que falham**
  - `fase.spec.ts`:
    - `aguardando e cancelada passam direto`;
    - `confirmada com item na fila → NA_COZINHA`;
    - `todos PRONTO → PRONTO`;
    - `PRONTO + ENTREGUE → PRONTO`;
    - `todos ENTREGUE → ENTREGUE`.
  - e2e:
    - `item congela a estação da categoria (Bebidas → Bar, Pizzas → Cozinha)`;
    - `rodada seguinte acima do limite pede confirmação`;
    - `rodada igual ao limite vai direto`;
    - `prato que exige confirmação pede confirmação mesmo com mesa aberta`;
    - `rodada direta publica PedidoConfirmado com direto: true`;
    - `cliente recebe fase e status dos itens`;
    - `garçom adiciona item: estação do prato`.
- [ ] **Step 2:** `cd apps/api && pnpm test && pnpm test:e2e`. Expected: FAIL nos novos.
- [ ] **Step 3:** Rodar a migração (`pnpm prisma migrate dev --name producao`, que só acrescenta) e implementar.
- [ ] **Step 4:** Expected: PASS. Suítes inteiras verdes, `tsc` e `lint` limpos. Depois rodar `pnpm --filter api dev:etapa3` no banco de dev, **duas vezes** (idempotente), e anotar a saída no ledger.
- [ ] **Step 5:** Commit `feat(api): stations, per-item status, confirmation exceptions and round phase`.

### Task 2: API — rotas da produção

**Files:**
- Create: `apps/api/src/producao/{producao.module.ts,producao.controller.ts,producao.service.ts,producao.types.ts}`
- Modify: `src/equipe/papel.ts` (`exigirProducao`), `src/app.module.ts`, `src/chamados/chamados.types.ts` (constante do evento interno)
- Test: `test/producao.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `exigirProducao(usuario)`: aceita `COZINHA` ou `DONO`. Qualquer outro recebe 403 `Acesso só para a produção`.
  - `GET /equipe/producao?estacao=Bar` → `{ estacoes: string[]; pedidos: PedidoProducao[] }`.
    - `estacoes`: as estações distintas das categorias do restaurante, em ordem alfabética.
    - Estação ausente ou desconhecida: usa a primeira.
  - `PedidoProducao = { rodadaId; mesa: { numero }; garcomNome: string | null; confirmadaEm; cancelada: boolean; itens: ItemProducao[] }`.
  - `ItemProducao = { id; nome; resumoOpcoes; observacao; quantidade; status }`, só os itens daquela estação.
  - Quais rodadas entram:
    - `CONFIRMADA` com algum item da estação em `NA_FILA` ou `EM_PREPARO`;
    - `CONFIRMADA` com todos os itens da estação `PRONTO` há menos de 15 min, para a faixa "Prontos" com desfazer;
    - `CANCELADA` com `confirmadaEm` preenchido e `canceladaEm` há menos de 10 min (`cancelada: true`).
    - Ordem: `confirmadaEm` crescente (ordem de chegada).
  - `PATCH /equipe/producao/itens/:id` `{ status: 'NA_FILA' | 'EM_PREPARO' | 'PRONTO' }`:
    - grava o status pedido e o carimbo de hora daquele passo; voltar um passo limpa o carimbo;
    - item de outro restaurante: 404;
    - item `ENTREGUE` ou rodada não `CONFIRMADA`: 409 `Este pedido mudou`.
  - `PATCH /equipe/producao/rodadas/:id` `{ estacao, status }`: o mesmo, para todos os itens da estação que não estão `ENTREGUE`.
  - Depois de cada mudança:
    - publicar `PedidoEmPreparo` (primeiro item da rodada saindo de `NA_FILA`) e `PedidoPronto` (rodada inteira pronta), uma vez cada;
    - emitir `producao-mudou`, `rodadas-mudaram` e `mesa-mudou`;
    - se a estação acabou de ficar toda `PRONTO` nessa rodada, emitir o evento interno `ESTACAO_PRONTA = 'producao.estacao-pronta'` com `{ rodadaId, estacao, itens: number }`.

- [ ] **Step 1: Testes que falham** (e2e)
  - `cozinha lista só os itens da estação, em ordem de chegada`;
  - `rodada aguardando garçom não aparece`;
  - `garçom recebe 403; dono e cozinha acessam`;
  - `PATCH item muda status e repetir é inofensivo`;
  - `item entregue → 409`;
  - `rodada cancelada → 409`;
  - `PATCH da rodada marca a estação inteira e não mexe na outra estação`;
  - `primeiro em preparo publica PedidoEmPreparo uma vez`;
  - `todos prontos publica PedidoPronto e o cliente vê fase PRONTO`;
  - `cancelada aparece com cancelada: true`;
  - `pronta há mais de 15 min some da lista`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar. Transação com `travarMesa`, igual a `naRodada`.
- [ ] **Step 4:** Expected: PASS; suítes inteiras verdes.
- [ ] **Step 5:** Commit `feat(api): production queue by station with per-item status`.

### Task 3: API — garçom cancela na janela, entrega e recebe Push

**Files:**
- Modify:
  - `src/rodadas/{rodadas-equipe.service.ts,rodadas-equipe.controller.ts,rodadas.types.ts,mapear.ts}`;
  - `src/push/{push.listener.ts,push.service.ts}`.
- Test: `test/rodadas.e2e-spec.ts`, `src/push/push.service.spec.ts`

**Interfaces:**
- Produces:
  - `POST /equipe/rodadas/:id/cancelar`:
    - só a rodada `CONFIRMADA` com `agora < confirmadaEm + janela`;
    - só o garçom responsável da sessão ou o `DONO`. Outro garçom: 403 `Esta mesa é de outro garçom`;
    - fora do prazo: 409 `O prazo para cancelar acabou`;
    - grava `CANCELADA` e `canceladaEm`, publica `PedidoCancelado` com `porJanela: true` e emite `producao-mudou`, `rodadas-mudaram` e `mesa-mudou`.
  - `POST /equipe/rodadas/:id/entregar`:
    - passa os itens `PRONTO` para `ENTREGUE` com `entregueEm`;
    - nenhum pronto: 409 `Nada pronto para entregar`;
    - todos entregues: publica `PedidoEntregue`.
  - `RodadaEquipe` ganha `fase: FaseRodada` e `cancelavelAte: string | null` (ISO, só dentro da janela).
  - `MesaResumo` ganha `prontos: number` (itens `PRONTO` da sessão aberta).
  - Push:
    - `PedidoConfirmado` com `direto` → para o `garcomId`: título `Mesa <n>`, corpo `Novo pedido na produção. Dá para cancelar em <m> min`;
    - `ESTACAO_PRONTA` → para o garçom da sessão: título `Mesa <n>`, corpo `Pronto no <estação>: <k> ite(m|ns)`;
    - `url` sempre `/mesa/<token>`.

- [ ] **Step 1: Testes que falham**
  - e2e:
    - `garçom responsável cancela dentro da janela`;
    - `depois da janela → 409` (a janela de teste vem do restaurante: 1 s, e espera 1,1 s);
    - `outro garçom → 403`;
    - `dono cancela`;
    - `entregar passa só os prontos`;
    - `nada pronto → 409`;
    - `mesas mostra prontos`;
    - `rodada direta tem cancelavelAte`;
    - `rodada confirmada pelo garçom na mesa não tem janela (cancelavelAte: null)`.
  - unit (push): `mensagem do pedido direto` e `mensagem de estação pronta com singular e plural`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar. A janela usa `Rodada.direta` (Task 1).
- [ ] **Step 4:** Expected: PASS; suítes inteiras verdes.
- [ ] **Step 5:** Commit `feat(api): waiter cancel window, deliver ready items, push for direct and ready`.

### Task 4: App da equipe — tela da produção

**Files:**
- Create: `apps/equipe/src/producao/{TelaProducao.tsx,CartaoPedido.tsx,somEPresenca.ts}` + testes; estilos em `estilo/producao.css`
- Modify:
  - `src/rotas.ts` (`{ nome: 'producao' }` para `/producao`);
  - `src/App.tsx` (papel `COZINHA` → sempre `TelaProducao`);
  - `src/inicio/Topo.tsx` (sem o interruptor de turno para a `COZINHA`);
  - `src/api/{equipe.ts,tipos.ts}`;
  - `src/tempo-real/useEquipeAoVivo.ts` (handler `producao`).

**Interfaces:**
- Consumes: as rotas da Task 2.
- Produces:
  - `buscarProducao(estacao?: string)`, `mudarItemProducao(id, status)`, `mudarRodadaProducao(id, estacao, status)`;
  - `TelaProducao`:
    - chips das estações no topo; a escolhida fica no `localStorage` (`estacao`, com try/catch);
    - grade de cartões (1 coluna no celular, várias no tablet);
    - faixa "Prontos" recolhida no fim, para desfazer;
    - recarrega em `producao-mudou` e a cada conexão.
  - `CartaoPedido`:
    - `Mesa <n>`, garçom e tempo desde `confirmadaEm` (tique de 30 s; amarelo a partir de 10 min, vermelho a partir de 20 min);
    - itens com quantidade grande, opções, e observação em destaque amarelo;
    - **tocar no item** avança `NA_FILA → EM_PREPARO → PRONTO`;
    - botão do cartão: `Começar` (algum item na fila → tudo `EM_PREPARO`) ou `Pronto` (tudo `PRONTO`);
    - cancelada: cartão vermelho `Cancelado`, itens riscados, sem ações, e botão `Ok` que esconde o cartão só nesta tela;
    - 409 → aviso `Este pedido mudou` e recarrega.
  - `somEPresenca.ts`:
    - `tocarBipe()` (WebAudio, 2 tons curtos), quando aparece um `rodadaId` novo na fila. O som só é liberado depois do toque no botão `Ativar som`;
    - `manterTelaLigada()`: `navigator.wakeLock` quando existe; refaz em `visibilitychange`.

- [ ] **Step 1: Testes que falham**
  - `cozinha logada cai na produção, sem interruptor de turno`;
  - `mostra os pedidos da estação escolhida e troca pelo chip`;
  - `tocar no item avança o status`;
  - `Começar e Pronto mandam a estação inteira`;
  - `observação aparece em destaque`;
  - `cancelado fica vermelho e Ok esconde`;
  - `409 avisa e recarrega`;
  - `producao-mudou recarrega`;
  - `pedido novo toca o bipe depois de Ativar som` (`tocarBipe` falso);
  - `tempo passa de 10 min → cartão em alerta`.
- [ ] **Step 2:** `pnpm --filter equipe test < /dev/null`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS; `tsc`, `lint` e `build` limpos.
- [ ] **Step 5:** Commit `feat(equipe): production screen by station for kitchen and bar`.

### Task 5: Garçom e cliente veem o andamento

**Files:**
- Modify:
  - `apps/equipe/src/mesa/TelaMesa.tsx` (+ teste);
  - `apps/equipe/src/inicio/Inicio.tsx` (+ teste);
  - `apps/equipe/src/api/{equipe.ts,tipos.ts}`;
  - `apps/cliente/src/pedido/PedidosSheet.tsx` (+ teste);
  - `apps/cliente/src/api/tipos.ts`;
  - `apps/api/scripts/garcom.mjs` (comandos `cancelar` e `entregar`);
  - `README.md` (seção "Tela da produção").

**Interfaces:**
- Consumes: as rotas da Task 3.
- Produces:
  - `TelaMesa`, rodadas confirmadas:
    - cada item com selo de status `Na fila`, `Preparando`, `Pronto` (verde) ou `Entregue`;
    - botão `Entregar prontos (<k>)` (sucesso) quando há item pronto;
    - com `cancelavelAte` no futuro: `Cancelar pedido (m:ss)` com contagem regressiva, que pergunta `Cancelar este pedido?` e depois `Sim, cancelar`. O botão some sozinho quando o tempo acaba.
  - `Inicio`:
    - em "Minhas mesas", o selo verde `<k> prontos`;
    - para o `DONO`, o botão `Produção` em `inicio-acoes`.
  - `PedidosSheet` mostra a fase: `Aguardando garçom`, `Na cozinha`, `Pronto`, `Entregue`, `Cancelado`.
  - README "Tela da produção":
    - logar no tablet/TV com `cozinha@demo.com` / `demo1234`;
    - escolher a estação e tocar `Ativar som`;
    - rodar `pnpm --filter api dev:etapa3` uma vez no banco de dev.

- [ ] **Step 1: Testes que falham**
  - equipe:
    - `item pronto mostra selo verde e Entregar prontos chama a API`;
    - `contagem regressiva some quando a janela acaba` (relógio falso);
    - `Cancelar pedido pede confirmação`;
    - `minhas mesas mostra 2 prontos`;
    - `dono vê o botão Produção`.
  - cliente: `fase NA_COZINHA mostra 'Na cozinha'`, `fase PRONTO mostra 'Pronto'`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS. Rodar todas as suítes (api unit + e2e, opcoes, cliente, equipe; `tsc`, `lint`, `build`).
- [ ] **Step 5: Fumaça por script** (resultado no ledger), com tudo no ar, pelos proxies 5173/5174, na mesa 8:
  1. A mesa já tem garçom: o cliente envia pizza + suco.
  2. A rodada vai direta, com `cancelavelAte`.
  3. A cozinha vê a pizza; o bar vê o suco.
  4. O bar marca pronto: `prontos` = 1 para o garçom.
  5. A cozinha marca pronto: o cliente vê `PRONTO`.
  6. O garçom entrega: o cliente vê `ENTREGUE`.
  7. Outra rodada direta é cancelada dentro da janela: a cozinha vê `cancelada`.
- [ ] **Step 6:** Commit `feat: waiter and customer follow production progress`.

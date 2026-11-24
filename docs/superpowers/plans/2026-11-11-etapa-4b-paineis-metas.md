# Etapa 4B — Painéis e metas: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar ao gerente o tempo de preparo por prato, as metas e o painel da equipe (que vira o Início do dono), e dar ao garçom e à cozinha/bar os próprios painéis, sem ranking e sem nomes onde o spec proíbe.

**Architecture:**
- **API:**
  - Grava o que falta para medir: turnos (`TurnoEquipe`), o garçom que recebe o crédito da rodada (`Rodada.garcomId`) e o tempo esperado congelado no item (`ItemRodada.tempoEsperadoMin`).
  - Um módulo novo, `paineis`, junta funções puras de cálculo (período, pedidos no tempo, avisos de cuidado, progresso da meta) e um serviço que lê o banco e monta os três painéis.
  - As metas ficam numa tabela `Meta`.
  - Um ouvinte de eventos detecta a meta da equipe batida (`MetaBatida`, uma vez por período) e manda o socket.
- **Front (`apps/equipe`):**
  - O Início do dono passa a ser o painel da equipe.
  - O garçom ganha o bloco "Meu dia" no Início.
  - A cozinha ganha a tela "Hoje".
  - O dono ganha as telas Metas e Tempo de preparo.

**Tech Stack:** NestJS 11, Prisma 6.19, Postgres 17, React 19 + Vite, vitest, Testing Library. Os gráficos são feitos em CSS puro, sem biblioteca nova.

**Spec:** `docs/superpowers/specs/2026-11-09-estoque-e-metas-design.md` §4 e §7 item 2 (a base é `2026-11-04-cardapio-digital-design.md`).

**Branch:** `etapa-4b`, criado a partir de `etapa-4a`, porque a 4A ainda espera o "sim" para ir à main.

## Global Constraints

- **Dia de serviço:** vai das 05:00 às 04:59 do dia seguinte, em America/Sao_Paulo. A semana começa na segunda-feira às 05:00. Usar o `inicioDoDiaDeServico` que já existe em `apps/api/src/comum/dia-servico.ts`.
- **Valor vendido:** soma de `Rodada.totalCentavos` das rodadas CONFIRMADAS, não canceladas, com `confirmadaEm` no período. Não entram 10% nem couvert. O crédito vai para `Rodada.garcomId`.
- **Mesa atendida:** sessão com `status = FECHADA` e `fechadaEm` no período. O crédito vai para `SessaoMesa.garcomId` no fechamento.
- **Pedido no tempo:**
  - Um "pedido" é o par (rodada, estação).
  - Ele está no tempo quando a estação o deixou pronto até `esperado × 1,10`.
  - `esperado` é o maior `tempoEsperadoMin` entre os itens daquela estação na rodada.
  - **Esquecido:** passou de `esperado × 2`.
  - Prato sem tempo e categoria sem padrão usam 15 min.
- **Cores da produção:** amarelo quando passa de `esperado × 1,10`; vermelho quando passa de `esperado × 2`. Isso substitui o 10/20 min fixo.
- **Anti-objetivos [dono]:**
  - Nenhum ranking ou ordenação por desempenho: pessoas sempre em ordem alfabética.
  - Meta abaixo do alvo usa barra **neutra**, nunca vermelha. Bateu: verde, com comemoração.
  - Nenhum número de colega no painel do garçom.
  - A tela de ajuste da meta por pessoa mostra só aquela pessoa.
  - Nada de "contexto do movimento da casa" ao lado do número da pessoa.
  - As perdas e os números de produção aparecem **sem nome**.
- **Aviso "sem pausa":** padrão de 4 h, configurável pelo gerente.
- **"Bem mais mesas":** mais que a média dos colegas que trabalharam no mesmo dia de serviço + 3.
- **Acessibilidade:**
  - Alvo de toque de no mínimo 44 px e texto de no mínimo 16 px.
  - Cada barra de meta tem `role="meter"`, com `aria-valuenow`, `aria-valuemax` e texto visível ("R$ 1.200 de R$ 2.000").
- **Português:** textos pt-BR do dia a dia; commits em inglês com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Banco:** migração só com `prisma migrate deploy` e só aditiva (com backfill). Nunca rodar o seed no dev. Nunca commitar `.env`.
- **Papéis:**
  - Metas, tempos e o painel da equipe exigem `DONO`.
  - `GET /equipe/painel/eu` exige `GARCOM`.
  - O painel da estação aceita `COZINHA` e `DONO`.

## Review Focus

1. **Rodada confirmada e depois cancelada na janela:** sai do valor vendido, dos pedidos da estação e dos mais vendidos. Teste e2e na Task 5.
2. **Venda à 01:00 de sábado:** conta para a sexta. Venda na segunda às 04:59 conta para a semana anterior. Teste unitário na Task 2.
3. **Garçom sem meta nenhuma (sem padrão):** o painel mostra "Sem meta definida" em vez de 0/0 ou NaN. O alvo é sempre ≥ 1 (zod). Testes na Task 4 (422) e na Task 7.
4. **Mesa sem garçom responsável:** a venda entra no total da equipe, mas em nenhum cartão. Teste e2e na Task 5.
5. **Meta batida, cancelamento e reconfirmação no mesmo período:** só uma `MetaBatida` e uma comemoração; o período seguinte começa do zero. Teste e2e na Task 5.

---

## File Structure

**API (`apps/api`)**
- `prisma/schema.prisma` e uma migração nova, `20261111120000_paineis_metas`.
- `src/comum/dia-servico.ts`: soma `inicioDaSemanaDeServico`.
- `src/paineis/periodo.ts`: período DIA/SEMANA (puro).
- `src/paineis/pedidos-estacao.ts`: pedidos no tempo e esquecidos (puro).
- `src/paineis/cuidado.ts`: avisos de "sem pausa" e "bem mais mesas" (puro).
- `src/paineis/progresso.ts`: progresso da meta (puro).
- `src/paineis/paineis.service.ts`, `paineis.controller.ts`, `paineis.module.ts`, `paineis.types.ts`.
- `src/paineis/metas.service.ts`, `metas.controller.ts`.
- `src/paineis/meta-batida.listener.ts`.
- `src/paineis/tempos.service.ts`, `tempos.controller.ts`.
- `src/paineis/tempo-esperado.ts`: `tempoEsperadoDe(prato)` (puro).
- Mudam:
  - `src/equipe/auth.service.ts`: turnos.
  - `src/rodadas/rodadas.service.ts` e `rodadas-equipe.service.ts`: `garcomId` e `tempoEsperadoMin`.
  - `src/producao/producao.service.ts` e `producao.types.ts`: `esperadoMin`.
  - `src/app.module.ts`.
- `scripts/dev-paineis.mjs` e o script `dev:paineis` no `package.json`.
- Testes: `src/paineis/*.spec.ts`, `test/paineis.e2e-spec.ts`, `test/metas.e2e-spec.ts`, `test/turnos.e2e-spec.ts`.

**Front (`apps/equipe/src`)**
- `api/paineis.ts`: chamadas a painel, metas e tempos; tipos em `api/tipos.ts`.
- `paineis/BarraMeta.tsx`, `paineis/PainelEquipe.tsx`, `paineis/MeuDia.tsx`, `paineis/PainelEstacao.tsx`, `paineis/Comemoracao.tsx`, `paineis/numeros.ts`.
- `gestao/TelaMetas.tsx`, `gestao/TelaMetaPessoa.tsx`, `gestao/TelaTempos.tsx`.
- `estilo/paineis.css`.
- Mudam:
  - `rotas.ts`: `metas`, `meta-pessoa`, `tempos` e `hoje`.
  - `App.tsx`.
  - `inicio/Inicio.tsx`: o dono vê o painel; o garçom vê "Meu dia".
  - `producao/CartaoPedido.tsx`: cores pelo esperado.
  - `producao/TelaProducao.tsx`: botão "Hoje".
  - `tempo-real/useEquipeAoVivo.ts`: eventos `painel-mudou` e `meta-batida`.
  - A API falsa dos testes, com as rotas novas.

---

### Task 1: Gravar o que falta medir (schema, turnos, crédito, tempo congelado)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261111120000_paineis_metas/migration.sql`
- Create: `apps/api/src/paineis/tempo-esperado.ts` e `tempo-esperado.spec.ts`
- Modify: `apps/api/src/equipe/auth.service.ts`, `apps/api/src/rodadas/rodadas.service.ts`, `apps/api/src/rodadas/rodadas-equipe.service.ts`
- Test: `apps/api/test/turnos.e2e-spec.ts`, novos casos em `apps/api/test/rodadas.e2e-spec.ts`

**Interfaces:**
- **Produces, schema:**
  - `TurnoEquipe { id, restauranteId, usuarioId, inicio DateTime, fim DateTime?; @@index([restauranteId, inicio]) }`
  - `Rodada.garcomId String?`
  - `ItemRodada.tempoEsperadoMin Int @default(15)`
  - `Prato.tempoPreparoMin Int?`
  - `Categoria.tempoPreparoMin Int?`
  - `Restaurante.horasSemPausa Int @default(4)`
  - `enum EscopoMeta { EQUIPE GARCOM ESTACAO }`
  - `enum TipoMeta { VALOR MESAS NO_TEMPO ESQUECIDOS }`
  - `enum PeriodoMeta { DIA SEMANA }`
  - `Meta { id, restauranteId, escopo EscopoMeta, tipo TipoMeta, periodo PeriodoMeta, alvo Int, usuarioId String?, estacao String?, criadoEm, atualizadoEm @updatedAt; @@index([restauranteId, escopo]) }`. `alvo` é em centavos para VALOR, em mesas para MESAS, em % para NO_TEMPO e 0 para ESQUECIDOS.
- **Produces, código:**
  - `tempoEsperadoDe(prato: { tempoPreparoMin: number | null; categoria: { tempoPreparoMin: number | null } }): number`, em `src/paineis/tempo-esperado.ts`.
  - A constante `TEMPO_PADRAO_MIN = 15`.

- [ ] **Step 1: Escrever o teste unitário que falha (`tempo-esperado.spec.ts`)**

```ts
it('prato vence categoria, categoria vence o padrão de 15', () => {
  expect(tempoEsperadoDe({ tempoPreparoMin: 25, categoria: { tempoPreparoMin: 12 } })).toBe(25);
  expect(tempoEsperadoDe({ tempoPreparoMin: null, categoria: { tempoPreparoMin: 12 } })).toBe(12);
  expect(tempoEsperadoDe({ tempoPreparoMin: null, categoria: { tempoPreparoMin: null } })).toBe(15);
});
```

- [ ] **Step 2: Escrever os e2e que falham**

`test/turnos.e2e-spec.ts`:
- `'ligar e desligar Em turno abre e fecha um TurnoEquipe'`: PATCH `/equipe/turno {emTurno:true}`, depois `{emTurno:false}`. Espera 1 linha com `fim` preenchido.
- `'ligar duas vezes não abre dois turnos'`: dois PATCH `true` seguidos. Espera 1 linha aberta.

`test/rodadas.e2e-spec.ts`:
- `'rodada direta guarda o garçom da mesa como crédito'`: mesa com garçom Ana e celular confirmado → `rodada.garcomId === ana.id`.
- `'garçom que confirma a rodada de mesa sem responsável fica com o crédito'`.
- `'item congela o tempo esperado do prato (ou da categoria, ou 15)'`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd apps/api && pnpm test -- tempo-esperado && pnpm test:e2e -- turnos rodadas`
Expected: FAIL (módulo inexistente; coluna `garcomId` inexistente).

- [ ] **Step 4: Schema e migração**

- A migração cria as tabelas, colunas e enums da seção Interfaces.
- Backfill sem apagar nada:
  - `UPDATE "Rodada" r SET "garcomId" = s."garcomId" FROM "SessaoMesa" s WHERE r."sessaoId" = s.id AND r."confirmadaEm" IS NOT NULL;`
  - `INSERT` de um `TurnoEquipe` aberto (`inicio = "emTurnoDesde"`) para cada usuário com `"emTurno" = true AND "emTurnoDesde" IS NOT NULL`.
- Aplicar com `pnpm prisma migrate deploy` e `pnpm prisma generate`.

- [ ] **Step 5: Implementar**

- **`mudarTurno`:** numa transação, ligar abre um `TurnoEquipe` só se não houver outro aberto; desligar põe `fim = agora` nos abertos. `emTurnoDesde` continua como está.
- **Rodada direta (`rodadas.service.ts`):** `garcomId: precisaConfirmar ? null : sessao.garcomId`.
- **`confirmar` (`rodadas-equipe.service.ts`):** `garcomId: r.sessao.garcomId ?? usuario.id`.
- **Os dois pontos que criam `ItemRodada`:** incluir `categoria` no `findMany` de pratos e gravar `tempoEsperadoMin: tempoEsperadoDe(prato)`.

- [ ] **Step 6: Rodar e ver passar; rodar a suíte da API**

Run: `pnpm test && pnpm test:e2e`
Expected: tudo verde.

- [ ] **Step 7: Commit**

`feat(api): record shifts, sale credit and frozen expected prep time`

---

### Task 2: Cálculos puros (período, pedidos no tempo, cuidado, progresso)

**Files:**
- Modify: `apps/api/src/comum/dia-servico.ts` (+ spec)
- Create: `apps/api/src/paineis/periodo.ts`, `pedidos-estacao.ts`, `cuidado.ts`, `progresso.ts` e um `.spec.ts` para cada um

**Interfaces:**
- `inicioDaSemanaDeServico(agora: Date): Date`: segunda-feira 05:00 em SP.
- `periodoDe(periodo: 'DIA' | 'SEMANA', agora: Date): { inicio: Date; fim: Date }`.
- `type ItemMedido = { rodadaId: string; estacao: string; confirmadaEm: Date; tempoEsperadoMin: number; prontoEm: Date | null; mesa: number }`
- `medirPedidos(itens: ItemMedido[], agora: Date): MedidaEstacao[]`, onde:
  - `MedidaEstacao = { estacao: string; pedidos: number; avaliados: number; noTempo: number; noTempoPct: number | null; mediaMin: number | null; esquecidos: { rodadaId: string; mesa: number; minutos: number }[] }`
  - `avaliados` = prontos + em andamento que já passaram de `esperado × 1,10`.
  - `noTempoPct = round(100 × noTempo / avaliados)`, ou `null` se `avaliados = 0`.
  - `mediaMin` é a média de (pronto − confirmada) dos prontos, em minutos arredondados.
- `avisosDeCuidado(p: { emTurnoDesde: Date | null; horasSemPausa: number; mesasHoje: number; mediaColegas: number | null }, agora: Date): string[]`. Textos exatos:
  - `` `${h} h em turno sem pausa` `` (h inteiro, só se ≥ `horasSemPausa`);
  - `'Pegou bem mais mesas que os colegas'` (só se `mediaColegas !== null && mesasHoje > mediaColegas + 3`).
- `progresso(meta: { tipo: TipoMeta; periodo: PeriodoMeta; alvo: number }, atual: number): ProgressoMeta`, onde:
  - `ProgressoMeta = { tipo; periodo; alvo; atual; batida: boolean; pct: number }`
  - `pct` vai de 0 a 100, arredondado.
  - **ESQUECIDOS:** `batida = atual === 0`, `pct = atual === 0 ? 100 : 0`.
  - **Demais tipos:** `batida = atual >= alvo`.

- [ ] **Step 1: Testes que falham**

```ts
// dia-servico.spec.ts
it('semana começa segunda 05:00 em SP', () => {
  // domingo 08/11 01:00 SP (04:00Z) → semana que começou segunda 02/11 05:00 SP (08:00Z)
  expect(inicioDaSemanaDeServico(new Date('2026-11-08T04:00:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z');
  // segunda 04:59 SP ainda é a semana anterior
  expect(inicioDaSemanaDeServico(new Date('2026-11-09T07:59:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z');
  expect(inicioDaSemanaDeServico(new Date('2026-11-09T08:00:00Z')).toISOString()).toBe('2026-11-09T08:00:00.000Z');
});
// periodo.spec.ts
it('venda sábado 01:00 conta na sexta', () => {
  expect(periodoDe('DIA', new Date('2026-11-07T04:00:00Z')).inicio.toISOString()).toBe('2026-11-06T08:00:00.000Z');
});
// pedidos-estacao.spec.ts — confirmada às 20:00, esperado 20 → prazo 22 min, esquecido > 40
it('pronto em 22 min está no tempo; em 23 não', ...)          // noTempo 1 de 2, noTempoPct 50
it('rodada com 2 pratos usa o maior esperado da estação', ...)
it('em andamento antes do prazo não entra no %', ...)         // avaliados 0 → noTempoPct null
it('em andamento há 41 min com esperado 20 é esquecido', ...)  // esquecidos [{mesa, minutos: 41}]
it('estações separadas na mesma rodada', ...)
// cuidado.spec.ts
it('5 h sem pausa com limite 4 avisa', ...)  // ['5 h em turno sem pausa']
it('fora do turno não avisa pausa', ...)
it('média 2, ele 6 → bem mais mesas; ele 5 → não', ...)
// progresso.spec.ts
it('abaixo do alvo não está batida e pct proporcional', ...)  // 1200 de 2000 → pct 60
it('acima do alvo pct limita em 100', ...)
it('esquecidos: 0 bate, 1 não', ...)
```

Datas conferidas: 02/11/2026 e 09/11/2026 são segundas; 06/11 é sexta; 07/11 é sábado.

- [ ] **Step 2: Rodar e ver falhar.** Run: `pnpm test -- dia-servico periodo pedidos-estacao cuidado progresso`. Expected: FAIL (funções inexistentes).
- [ ] **Step 3: Implementar as cinco funções** nos arquivos da seção Interfaces. A semana usa o dia da semana em SP do início do dia de serviço.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat(api): pure dashboard math - service week, on-time orders, care notices, goal progress`

---

### Task 3: Tempo de preparo (API, cores da produção e a tela do gerente)

**Files:**
- Create: `apps/api/src/paineis/tempos.service.ts`, `tempos.controller.ts`; registrar em `paineis.module.ts` (criar o módulo aqui) e no `app.module.ts`
- Modify: `apps/api/src/producao/producao.service.ts`, `producao.types.ts`
- Modify: `apps/equipe/src/producao/CartaoPedido.tsx` (+ teste)
- Create: `apps/equipe/src/gestao/TelaTempos.tsx` (+ teste), `apps/equipe/src/api/paineis.ts`
- Test: `apps/api/test/paineis.e2e-spec.ts` (criar, com a seção "tempos")

**Interfaces:**
- **API:**
  - `GET /equipe/tempos` (DONO) → `{ categorias: { id; nome; estacao; tempoPreparoMin: number | null; pratos: { id; nome; tempoPreparoMin: number | null }[] }[] }`, em ordem de `ordem`.
  - `PATCH /equipe/tempos/categorias/:id` e `PATCH /equipe/tempos/pratos/:id`, com corpo `{ tempoPreparoMin: number | null }`. zod: inteiro de 1 a 240, ou null. Resposta: 200 com o objeto atualizado. Id de outro restaurante dá 404.
  - `PedidoProducao` ganha `esperadoMin: number`: o maior `tempoEsperadoMin` dos itens daquela estação.
- **Front:**
  - `buscarTempos()`, `mudarTempoCategoria(id, min | null)`, `mudarTempoPrato(id, min | null)` em `api/paineis.ts`.
  - Rota `/tempos` → `{ nome: 'tempos' }`; `voltaDe` → `'/'`.

- [ ] **Step 1: Testes que falham**
  - **e2e:**
    - `'gerente define o padrão da categoria e o tempo do prato'`;
    - `'garçom recebe 403 em /equipe/tempos'`;
    - `'tempo 0 ou 241 dá 422'`;
    - `'produção manda esperadoMin da estação'`.
  - **`CartaoPedido.test.tsx`:**
    - `'esperado 20: amarelo depois de 22 min, vermelho depois de 40'`, que confere as classes `cartao-producao--alerta` e `--perigo` com `agora` controlado;
    - `'esperado 30: 25 min ainda neutro'`.
  - **`TelaTempos.test.tsx`:**
    - `'mostra a categoria com o padrão e os pratos herdando'`: o prato sem tempo mostra o placeholder `"Padrão: 12 min"`;
    - `'mudar o tempo do prato manda PATCH com o número'`;
    - `'apagar o campo volta ao padrão (null)'`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar**
  - A API.
  - No `CartaoPedido`: `alerta = minutos > esperadoMin * 1.1`, `perigo = minutos > esperadoMin * 2`. Remover `ALERTA_MIN` e `PERIGO_MIN`.
  - A `TelaTempos`:
    - uma seção por categoria (campo "Padrão da categoria (min)"), com uma linha por prato (campo "Tempo de {prato} (min)");
    - salva ao sair do campo (`onBlur`), com status "Salvo" em `role="status"`.
  - O botão "Tempo de preparo" no Início do dono, junto da Task 7. Por ora, só a rota.
- [ ] **Step 4: Rodar API e equipe; ver passar.** Run: `pnpm test:e2e -- paineis producao` e `pnpm exec vitest run src/producao src/gestao`.
- [ ] **Step 5: Commit** `feat: expected prep time per dish/category and production colors by it`

---

### Task 4: Metas (API e telas do gerente)

**Files:**
- Create: `apps/api/src/paineis/metas.service.ts`, `metas.controller.ts`, `test/metas.e2e-spec.ts`
- Create: `apps/equipe/src/gestao/TelaMetas.tsx`, `TelaMetaPessoa.tsx` (+ testes)

**Interfaces (todas DONO):**
- `GET /equipe/metas` → `MetasConfig`:

```ts
type MetaValor = { periodo: 'DIA' | 'SEMANA'; alvo: number } | null
type MetasConfig = {
  equipe: { VALOR: MetaValor; MESAS: MetaValor }
  garcomPadrao: { VALOR: MetaValor; MESAS: MetaValor }
  estacoes: { estacao: string; noTempoPct: number | null; zeroEsquecidos: boolean }[]  // estações das categorias
  garcons: { id: string; nome: string }[]   // A→Z, sem valores (sem lista comparando)
  horasSemPausa: number
}
```

- `PUT /equipe/metas/equipe/:tipo` (`VALOR | MESAS`), corpo `{ periodo, alvo }` (alvo inteiro ≥ 1). `DELETE` a remove.
- `PUT /equipe/metas/garcom/:tipo`, mesmo corpo: é o padrão. `DELETE` remove o padrão e os ajustes daquele tipo.
- `GET /equipe/metas/garcom/pessoa/:usuarioId` → `{ id; nome; VALOR: { padrao: MetaValor; ajuste: number | null }; MESAS: { padrao: MetaValor; ajuste: number | null } }`. Usuário que não é garçom dá 404.
- `PUT /equipe/metas/garcom/pessoa/:usuarioId/:tipo`, corpo `{ alvo }`. Sem padrão daquele tipo, dá 422 `'Defina a meta padrão primeiro'`. `DELETE` volta ao padrão.
- `PUT /equipe/metas/estacao/:estacao`, corpo `{ noTempoPct: number | null; zeroEsquecidos: boolean }`. `noTempoPct` vai de 1 a 100. Grava NO_TEMPO e ESQUECIDOS com `periodo DIA`; null ou false removem a meta.
- `PATCH /equipe/configuracoes/painel`, corpo `{ horasSemPausa }`, inteiro de 1 a 12.
- **Upsert:** a chave lógica é (escopo, tipo, usuarioId, estacao). O serviço faz `findFirst` + `update` ou `create` dentro de uma transação, porque um `@@unique` com nulos não protege no Postgres.
- **Front:**
  - Rotas `/metas` (`'metas'`) e `/metas/garcom/:id` (`'meta-pessoa'`). `voltaDe`: `'/'` e `'/metas'`.
  - Em `api/paineis.ts`: `buscarMetas`, `salvarMetaEquipe(tipo, v | null)`, `salvarMetaPadrao(tipo, v | null)`, `buscarMetaPessoa(id)`, `salvarAjuste(id, tipo, alvo | null)`, `salvarMetaEstacao(estacao, {noTempoPct, zeroEsquecidos})`, `salvarHorasSemPausa(h)`.
  - O valor em reais é digitado como "1.500" ou "1.500,50" e enviado em centavos. Reaproveitar a leitura pt-BR de `estoque/campo.ts` se servir; senão, criar `paineis/numeros.ts` com `lerReais(texto): number | null`.

- [ ] **Step 1: Testes que falham**
  - **e2e:**
    - `'gerente define meta da equipe por semana e lê de volta'`;
    - `'alvo 0 dá 422'`;
    - `'padrão do garçom vale para todos; ajuste muda só a pessoa'`;
    - `'ajuste sem padrão dá 422'`;
    - `'apagar o padrão apaga os ajustes'`;
    - `'meta da estação: 85% e zero esquecidos'`;
    - `'garçom recebe 403 em todas as rotas de metas'`;
    - `'GET /metas não traz valores por pessoa'` (confere que `garcons` só tem id e nome).
  - **`TelaMetas.test.tsx`:**
    - `'salva a meta da equipe em reais por semana'`: digitar "2.000" com Semana manda `{periodo:'SEMANA', alvo:200000}`;
    - `'lista os garçons em ordem alfabética só com o nome'`;
    - `'tocar no garçom abre a meta dele'`;
    - `'salva horas sem pausa'`.
  - **`TelaMetaPessoa.test.tsx`:**
    - `'mostra o padrão e deixa ajustar só esta pessoa'`;
    - `'Usar o padrão apaga o ajuste'`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Layout da `TelaMetas`, em blocos, nesta ordem:
  1. "Meta da equipe" (valor vendido e mesas atendidas; cada um com campo, Dia/Semana e "Sem meta");
  2. "Meta de cada garçom (padrão)";
  3. "Ajustar para alguém" (lista de nomes A→Z, em botões);
  4. "Cozinha e bar" (por estação: "% no tempo" e o interruptor "Zero esquecidos");
  5. "Cuidado com a equipe" (horas sem pausa).
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat: goals for team, waiters (default + per person) and stations`

---

### Task 5: Painéis na API e meta batida

**Files:**
- Create: `apps/api/src/paineis/paineis.service.ts`, `paineis.controller.ts`, `paineis.types.ts`, `meta-batida.listener.ts`
- Test: `apps/api/test/paineis.e2e-spec.ts`

**Interfaces:**

```ts
type ProgressoMeta = { tipo: TipoMeta; periodo: PeriodoMeta; alvo: number; atual: number; batida: boolean; pct: number }
type CartaoPessoa = {
  id: string; nome: string; emTurno: boolean; emTurnoDesde: string | null
  avisos: string[]            // de avisosDeCuidado
  metas: ProgressoMeta[]      // VALOR e/ou MESAS, alvo = ajuste ?? padrão; [] se não há padrão
  mesasHoje: number
}
type PainelEquipe = {
  periodo: 'DIA' | 'SEMANA'; inicio: string
  metaEquipe: ProgressoMeta[]
  pessoas: CartaoPessoa[]     // garçons em turno ou com TurnoEquipe no período; A→Z por nome
  operacao: {
    faturamentoCentavos: number; contas: number; ticketMedioCentavos: number | null
    porHora: { hora: number; rodadas: number }[]          // 0..23 em SP, só horas com rodadas, no período
    porDiaSemana: { dia: number; mediaRodadas: number }[] // 0=dom..6, média dos últimos 28 dias de serviço
    maisVendidos: { nome: string; quantidade: number }[]  // top 10 no período, por soma de quantidade
    estacoes: MedidaEstacao[]                             // de medirPedidos, no período
    chamadosDemorados: { quantidade: number; mediaRespostaSeg: number | null } // resposta > 180 s
    perdasSemana: { item: string; unidade: Unidade; quantidade: number; motivo: MotivoPerda | null }[]
  }
}
type PainelGarcom = { metaEquipe: ProgressoMeta[]; eu: CartaoPessoa }
type PainelEstacao = {
  estacao: string; metaEquipe: ProgressoMeta[]
  metas: ProgressoMeta[]      // NO_TEMPO (atual = noTempoPct ?? 0) e ESQUECIDOS (atual = esquecidos.length)
  medida: MedidaEstacao       // dia de serviço atual
}
```

- **Rotas:**
  - `GET /equipe/painel?periodo=DIA|SEMANA` (DONO). O padrão é DIA.
  - `GET /equipe/painel/eu` (GARCOM).
  - `GET /equipe/painel/estacao/:estacao` (COZINHA, DONO).
- **Tempo de resposta do chamado:** `(lidoEm ?? resolvidoEm ?? agora) − criadoEm`.
- **`MetaBatidaListener`:**
  - `@OnEvent('PedidoConfirmado' | 'PedidoCancelado' | 'ContaFechada')`, em fire-and-forget (erro só no log).
  - Emite `tempoReal.paraEquipe(r, 'painel-mudou', {})`.
  - Para cada meta de EQUIPE batida, procura um `Evento` com `tipo 'MetaBatida'` e `dados {metaId, inicio}`. Se não houver, publica `MetaBatida` e emite `paraEquipe(r, 'meta-batida', { tipo, periodo, alvo })`.
  - `ESTACAO_PRONTA` também emite `painel-mudou`.
- **`mudarTurno`** emite `painel-mudou`.

- [ ] **Step 1: Testes e2e que falham**

Monte os dados com os helpers que já existem em `test/app-teste.ts` e `banco-teste.ts`.

- `'valor vendido da Ana conta só rodadas confirmadas e não canceladas, sem 10%'`;
- `'mesa sem garçom entra no total da equipe e em nenhum cartão'`;
- `'mesas atendidas contam a conta fechada do responsável'`;
- `'cartões em ordem alfabética, com garçom em turno e quem trabalhou hoje'`;
- `'garçom sem meta padrão tem metas []'`;
- `'ajuste por pessoa vence o padrão no cartão'`;
- `'painel/eu traz só a própria pessoa'`, que confere que o JSON não contém o nome de outro garçom;
- `'garçom recebe 403 em /equipe/painel; cozinha recebe 403 em /painel/eu'`;
- `'painel da estação: no tempo, atrasado e esquecido'`, com os carimbos `prontoEm` ajustados direto no banco;
- `'perdas da semana sem nome de quem avisou'`;
- `'meta da equipe batida publica MetaBatida uma vez, mesmo com cancelar e reconfirmar'`, usando `contarEventos(t, 'MetaBatida', 1)`;
- `'rodada cancelada some dos mais vendidos e das estações'`.

- [ ] **Step 2: Rodar e ver falhar.** Run: `pnpm test:e2e -- paineis`.
- [ ] **Step 3: Implementar** o serviço com consultas por período e as funções puras da Task 2. Mantenha cada bloco de `operacao` num método privado. Agrupe por hora em SP com `Intl.DateTimeFormat` (o mesmo usado em `dia-servico.ts`).
- [ ] **Step 4: Rodar e ver passar; rodar `pnpm test && pnpm test:e2e`** (todos verdes; rode `paineis` 3 vezes para checar a estabilidade).
- [ ] **Step 5: Commit** `feat(api): team, waiter and station dashboards; team goal reached event`

---

### Task 6: Peças de painel no front (barra da meta, números, comemoração, tempo real)

**Files:**
- Create: `apps/equipe/src/paineis/BarraMeta.tsx`, `Comemoracao.tsx`, `numeros.ts` (+ testes), `estilo/paineis.css`
- Modify: `apps/equipe/src/tempo-real/useEquipeAoVivo.ts`, `apps/equipe/src/App.tsx`, `apps/equipe/src/api/tipos.ts`
- Modify: a API falsa (`test/api-falsa.ts`), com as rotas de painel, metas e tempos e o estado `paineis`

**Interfaces:**
- `<BarraMeta meta={ProgressoMeta} rotulo={string} />`:
  - `role="meter"`, `aria-label={rotulo}`, `aria-valuemin=0`, `aria-valuemax=alvo`, `aria-valuenow=atual`;
  - texto visível:
    - VALOR: `"R$ 1.200,00 de R$ 2.000,00"`;
    - MESAS: `"6 de 10 mesas"`;
    - NO_TEMPO: `"82% no tempo · meta 85%"`;
    - ESQUECIDOS: `"Nenhum esquecido"` ou `"2 esquecidos"`;
  - período: `"hoje"` ou `"na semana"`;
  - classe `barra-meta--batida` só quando `batida`. Sem nenhuma classe de perigo.
  - Batida: o texto ganha `"Meta batida! 🎉"`.
- `textoMeta(meta: ProgressoMeta): string` em `numeros.ts`. Reaproveite `formatarReais` de `packages/opcoes`.
- `useEquipeAoVivo({ painel?: () => void; metaBatida?: (d: { tipo: TipoMeta; periodo: PeriodoMeta; alvo: number }) => void })`, que escuta `painel-mudou` e `meta-batida`.
- `<Comemoracao />` no `App`, para todos os papéis:
  - em `meta-batida`, mostra uma faixa `role="status"` com `"A equipe bateu a meta de {texto}! 🎉"` e o botão "Fechar";
  - some sozinha em 15 s.

- [ ] **Step 1: Testes que falham**
  - **`BarraMeta.test.tsx`:**
    - `'abaixo do alvo: neutra, com o texto em reais'`;
    - `'batida: classe batida e Meta batida!'`;
    - `'nunca usa classe de perigo'`;
    - `'meter com valores para leitor de tela'`.
  - **`Comemoracao.test.tsx`:**
    - `'socket meta-batida mostra a faixa para quem está logado'`;
    - `'Fechar some a faixa'`.
- [ ] **Step 2: Rodar e ver falhar.** **Step 3: Implementar.** **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat(equipe): goal bar, celebration banner and live dashboard events`

---

### Task 7: Início do dono = painel da equipe

**Files:**
- Create: `apps/equipe/src/paineis/PainelEquipe.tsx` (+ teste)
- Modify: `apps/equipe/src/inicio/Inicio.tsx` (+ teste), `apps/equipe/src/rotas.ts`, `apps/equipe/src/App.tsx` (rotas `metas`, `meta-pessoa`, `tempos` só para DONO)

**Interfaces:**
- Consumes: `buscarPainel(periodo)` em `api/paineis.ts` (`GET /equipe/painel?periodo=`), `BarraMeta` e `useEquipeAoVivo({ painel, estoque })`.
- **Layout do Início do dono, de cima para baixo:**
  1. Faixa de notificações (como hoje).
  2. Bloco "Meta da equipe": as `BarraMeta`, ou "Sem meta da equipe. Definir em Metas" com um link.
  3. Atalhos em grade de 2 colunas: **Estoque · N acabando**, **Metas**, **Tempo de preparo**.
  4. Seletor `Hoje | Semana` (dois botões `aria-pressed`).
  5. "Equipe": um cartão por pessoa, na ordem que vem da API:
     - nome e "Em turno desde 18:00" ou "Fora do turno";
     - os avisos de cuidado no topo do cartão, em amarelo informativo, nunca vermelho;
     - as barras pessoais, ou "Sem meta definida".
  6. "Operação":
     - faturamento, contas e ticket médio (3 números grandes);
     - "Movimento por hora" (barras CSS horizontais);
     - "Movimento por dia da semana" (média);
     - "Mais pedidos" (lista numerada pelo nome do prato);
     - "Cozinha e bar" (por estação: % no tempo, média em min, esquecidos);
     - "Chamados que demoraram (mais de 3 min)";
     - "Perdas da semana".
  Nenhuma seção mostra nome de pessoa, exceto os cartões da equipe.
- Recarrega em `painel-mudou` e no foco da aba (o padrão de `useMaisRecente` que já existe).

- [ ] **Step 1: Testes que falham (`PainelEquipe.test.tsx`)**
  - `'dono vê a meta da equipe no topo'`;
  - `'sem meta mostra Definir em Metas'`;
  - `'cartões na ordem da API e aviso de cuidado no cartão'`;
  - `'cartão sem meta mostra Sem meta definida'`;
  - `'Semana pede periodo=SEMANA'`;
  - `'socket painel-mudou recarrega'`;
  - `'atalhos Estoque, Metas e Tempo de preparo navegam'`;
  - `'operação: ticket médio e mais pedidos'`.
  - Atualizar `Inicio.test.tsx`: `'dono não vê chamados, mesas nem produção: só o Estoque'` passa a esperar também o heading "Meta da equipe".
- [ ] **Step 2: Rodar e ver falhar.** **Step 3: Implementar.** **Step 4: Rodar a suíte da equipe; ver passar.**
- [ ] **Step 5: Commit** `feat(equipe): owner home is the team dashboard`

---

### Task 8: "Meu dia" do garçom e "Hoje" da cozinha/bar

**Files:**
- Create: `apps/equipe/src/paineis/MeuDia.tsx`, `PainelEstacao.tsx` (+ testes)
- Modify: `apps/equipe/src/inicio/Inicio.tsx` (o garçom vê `MeuDia` acima de Chamados), `apps/equipe/src/producao/TelaProducao.tsx` (botão "Hoje" para cada estação), `apps/equipe/src/rotas.ts` (`/hoje/:estacao` → `{ nome: 'hoje'; estacao }`, `voltaDe` → `'/'`), `apps/equipe/src/App.tsx` (a cozinha abre `hoje`; o Voltar do topo aparece para a cozinha só nessa rota)

**Interfaces:**
- **`MeuDia`:** busca `GET /equipe/painel/eu`. Mostra:
  - a meta da equipe;
  - "Minhas metas" (`BarraMeta` para cada uma, ou "Sem meta definida");
  - "Mesas atendidas hoje: N";
  - "Em turno desde HH:MM", ou "Fora do turno", e os avisos de cuidado.
  Recarrega em `painel-mudou`.
- **`PainelEstacao({ estacao })`:** busca `GET /equipe/painel/estacao/:estacao`. Mostra:
  - a meta da equipe;
  - as metas da estação;
  - "Pedidos hoje: N";
  - "% no tempo" (ou "—");
  - "Esquecidos": lista "Mesa 7 · 41 min", sem nome de ninguém.

- [ ] **Step 1: Testes que falham**
  - **`MeuDia.test.tsx`:**
    - `'garçom vê a meta da equipe e as dele'`;
    - `'não mostra nome de colega'` (a API falsa responde só "eu" e o teste procura o nome "Bruno": ausente);
    - `'mesas atendidas hoje e turno'`;
    - `'sem metas mostra Sem meta definida'`.
  - **`PainelEstacao.test.tsx`:**
    - `'mostra % no tempo e os esquecidos por mesa'`;
    - `'meta de % batida fica verde'`.
  - **`App.test.tsx`:** `'cozinha abre Hoje pela produção e volta pelo topo'`.
- [ ] **Step 2: Rodar e ver falhar.** **Step 3: Implementar.** **Step 4: Rodar a suíte da equipe; ver passar.**
- [ ] **Step 5: Commit** `feat(equipe): waiter "my day" and station "today" dashboards`

---

### Task 9: Dados de demo e roteiro de teste

**Files:**
- Create: `apps/api/scripts/dev-paineis.mjs`
- Modify: `apps/api/package.json` (script `dev:paineis`), `README.md` (seção "Painéis e metas")

**Interfaces:**
- `dev-paineis.mjs` é idempotente: nunca apaga e nunca mexe em vendas ou turnos. Só define:
  - padrão de 12 min na categoria de pizzas;
  - 5 min no Bar;
  - meta da equipe de R$ 3.000 por dia;
  - meta padrão do garçom de R$ 800 por dia;
  - 85% no tempo e zero esquecidos na Cozinha.
  Usa só valores que ainda não existem (não sobrescreve o que o gerente mudou pelo app).
- O roteiro do README, passo a passo:
  1. O dono abre o app e vê o painel.
  2. A Ana liga "Em turno" e aparece no cartão.
  3. Um pedido pelo cardápio aparece no valor vendido; a produção pinta pelo tempo.
  4. Fechar a conta conta a mesa atendida.
  5. Baixar a meta para R$ 10 mostra a comemoração para todos.
  6. A cozinha toca em "Hoje".

- [ ] **Step 1:** Escrever o script. Rodar `pnpm --filter api dev:paineis` duas vezes: a segunda roda não muda nada (o script imprime "nada a fazer").
- [ ] **Step 2:** Escrever a seção do README.
- [ ] **Step 3: Suíte completa:**
  - API: `pnpm test`, `pnpm test:e2e`, `pnpm lint`;
  - equipe: `pnpm exec vitest run`, `pnpm exec tsc -b`, `pnpm lint`, `pnpm build`;
  - cliente: `pnpm exec vitest run`.
  Expected: verde, exceto o teste instável já conhecido da contagem regressiva da 3A.
- [ ] **Step 4:** Medir as telas novas a 360 px (sem vazamento lateral) com o script Playwright do scratchpad.
- [ ] **Step 5: Commit** `chore: dashboards demo data and test walkthrough`

---

## Decisões minhas neste plano (para o dono revisar)

1. **Tempo esperado congelado no item na criação**, como o preço e a estação: mudar o tempo de um prato não reescreve o histórico.
2. **"% no tempo"** só conta pedidos prontos e pedidos já atrasados. Pedido em andamento, ainda dentro do prazo, não entra.
3. **"Chamado que demorou"** = mais de 3 min até alguém ler.
4. **Movimento por dia da semana** = média dos últimos 28 dias de serviço. **Movimento por hora** = do período escolhido (Hoje ou Semana).
5. **Ajuste por pessoa** muda só o alvo; o período (dia ou semana) é o do padrão.
6. **Meta da estação** é sempre por dia ("na noite").
7. **Comemoração** = faixa na tela de todos os logados, por socket. Sem push nesta etapa.
8. **O script de demo não cria vendas falsas:** os números vêm do uso real no app.

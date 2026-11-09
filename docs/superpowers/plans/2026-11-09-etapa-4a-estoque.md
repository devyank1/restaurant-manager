# Etapa 4A — Estoque Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O gerente (`DONO`) controla o estoque pelo app equipe. O app cobre:
- itens e fornecedores;
- receitas que baixam o estoque na venda;
- contagem e chegada de compras;
- perdas avisadas por qualquer pessoa da equipe;
- avisos de "acabando" e "acabou";
- lista de compras em .xlsx e WhatsApp.

**Architecture:** O módulo novo `estoque` na API concentra toda mudança de quantidade em `aplicarMovimentos(tx, …)`.
- Essa função grava o movimento, soma com `increment` e decide os avisos (cruzar o mínimo, zerar) dentro da mesma transação.
- A baixa pela venda roda dentro das transações que já existem: `confirmar`, envio direto do cliente e `cancelar`, todas com a mesa travada.
- Avisos (push para o DONO + socket `estoque-mudou`) saem depois do commit.
- As telas novas ficam em `apps/equipe/src/estoque/`, nas rotas `/estoque/*`, só para DONO. "Avisar perda" fica no Topo, para todos.

**Tech Stack:** NestJS 11, Prisma 6.19 + Postgres 17, zod, `exceljs` (novo, só na API), React + Vite (equipe), vitest + Testing Library, jest + supertest (e2e).

**Spec:** `docs/superpowers/specs/2026-11-09-estoque-e-metas-design.md` (§3, §5, §6, §7 item 1, requisito de entrega no topo). Base: `docs/superpowers/specs/2026-11-04-cardapio-digital-design.md`.

## Global Constraints

- **Telas:** tudo que o gerente configura na 4A é feito **pelo app**. Script só preenche a demo.
- **Esgotado:** o sistema **nunca marca esgotado sozinho**. Só o botão do gerente muda `Prato.esgotado`.
- **Unidades:** a quantidade é guardada na unidade base, em inteiro: `UN`, `G` ou `ML`.
  - A tela aceita g/kg e ml/L, e vírgula decimal ("1,5").
  - Formato de exibição: "1,5 kg", "800 g", "2 L", "30 un".
  - Negativo aparece como "0 (conferir)".
- **Receita:**
  - multiplicador só em opção de grupo `UNICA`; padrão 100 (%);
  - o multiplicador vale para a base do prato e para os sabores; adicionais e opções com receita própria não multiplicam;
  - cada sabor entra ÷ nº de sabores escolhidos.
- **Movimentos e desfazer:**
  - tipos: `VENDA`, `ESTORNO`, `ENTRADA`, `CONTAGEM`, `PERDA`;
  - desfazer: só o **último lote da própria pessoa** (`ENTRADA`/`CONTAGEM`/`PERDA`), em até **10 min**;
  - `VENDA` e `ESTORNO` nunca se desfazem.
- **Motivos de perda:** `ACIDENTE` "Acidente", `VALIDADE` "Validade", `PREPARO` "Erro de preparo", `OUTRO` "Outro" (texto obrigatório).
- **Avisos:**
  - uma vez por cruzamento: OK→ACABANDO (≤ mínimo), →ZERADO (≤ 0); volta a OK quando sobe acima do mínimo;
  - perda sempre avisa;
  - push vai para todos os usuários `DONO` do restaurante.
- **Nomes:** perdas nos resumos **não mostram quem registrou**. O nome só aparece no histórico do item.
- **"Hoje":** dia de serviço das 05:00 às 04:59, America/Sao_Paulo.
- **Acessibilidade:**
  - alvo de toque ≥ 44 px e texto ≥ 16 px;
  - todo botão com nome acessível;
  - quantidade lida por extenso no `aria-label` ("1,5 quilo");
  - tema escuro atual (`tokens.css`).
- **Textos:** linguagem do dia a dia, sem termos contábeis. Rótulos exatos:
  - "Estoque", "Acabando", "Acabou", "Perdas de hoje", "Gerar lista de compras";
  - "Chegou compra", "Contar estoque", "Avisar perda", "Marcar como esgotado", "Desfazer".
- **Regras do repo:**
  - nunca rodar seed no banco dev;
  - nunca commitar `.env`;
  - migração só aditiva;
  - commits em inglês com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Receita muda entre confirmar e cancelar:** o estorno deve devolver exatamente o que a venda baixou. Por isso lê os movimentos `VENDA` da rodada, não a receita atual. Teste na Task 3.
2. **Rodada antiga com opção ou item que não existe mais** (opção apagada, item arquivado) não pode quebrar a confirmação. Ignora o que sumiu. Teste na Task 3.
3. **Vendas seguidas abaixo do mínimo:** um aviso só, não um por venda. Teste na Task 2.
4. **Entrada "1,5" com vírgula em kg vira 1500 g, e "abc" ou valor ≤ 0 é recusado na tela.** Teste na Task 5.
5. **Contagem com diferença grande pede confirmação.** Grande = |diferença| > 20% do nível cheio. Contagem 0 em item negativo grava a diferença certa. Testes nas Tasks 2 e 5.

---

## File Structure

**API (`apps/api`)**
- `prisma/schema.prisma`: enums e modelos `Fornecedor`, `ItemEstoque`, `ReceitaItem`, `MovimentoEstoque`, `ListaCompra`; `Opcao.multiplicadorPct`.
- `prisma/migrations/<ts>_estoque/`: migração aditiva.
- `src/comum/dia-servico.ts` (+ spec): `inicioDoDiaDeServico`.
- `src/estoque/quantidade.ts` (+ spec): formato "1,5 kg" e embalagens (para planilha e WhatsApp).
- `src/estoque/consumo.ts` (+ spec): rodada → consumo por item (pura).
- `src/estoque/movimentos.ts`: `aplicarMovimentos` (dentro de tx) e tipos de aviso.
- `src/estoque/avisos-estoque.service.ts`: depois do commit, push + socket + eventos.
- `src/estoque/baixa.ts`: `baixarRodada` / `estornarRodada` (dentro de tx).
- `src/estoque/estoque.service.ts`, `estoque.controller.ts`: itens, fornecedores, movimentos, resumo, perdas, desfazer.
- `src/estoque/receitas.service.ts`, `receitas.controller.ts`: receitas, multiplicador, esgotado.
- `src/estoque/compras.service.ts`, `compras.controller.ts`, `planilha.ts`: lista de compras, xlsx, chegou.
- `src/estoque/estoque.module.ts`; `app.module.ts` registra.
- `src/rodadas/rodadas-equipe.service.ts`, `src/rodadas/rodadas.service.ts`: chamam baixa e estorno.
- `src/push/push.service.ts`: `notificarGerentes`.
- `src/eventos/eventos.types.ts`: `EstoqueMovimentado`, `EstoqueAcabando`, `PerdaRegistrada`.
- `src/equipe/papel.ts`: `exigirDono`.
- `test/estoque.e2e-spec.ts`, `test/receitas.e2e-spec.ts`, `test/compras.e2e-spec.ts`.
- `scripts/dev-estoque.mjs` + script `dev:estoque`.

**Equipe (`apps/equipe/src`)**
- `rotas.ts`: rotas `/estoque…`.
- `api/tipos.ts`, `api/estoque.ts`: tipos e chamadas.
- `estoque/unidades.ts` (+ test): converter e formatar, espelho de `quantidade.ts` da API.
- `estoque/TelaEstoque.tsx`: início (Acabando, Acabou, Perdas de hoje, botões).
- `estoque/TelaItens.tsx`, `estoque/TelaItem.tsx`, `estoque/TelaFornecedores.tsx`.
- `estoque/TelaReceitas.tsx`, `estoque/TelaReceita.tsx`.
- `estoque/TelaCompras.tsx`, `estoque/TelaChegou.tsx`, `estoque/whatsapp.ts` (+ test).
- `estoque/AvisarPerda.tsx`; `inicio/Topo.tsx` ganha o botão.
- `estoque/CampoQuantidade.tsx`: número + unidade, reaproveitado nas telas.
- `estilo/estoque.css`.
- `test/api-falsa.ts`, `test/fixtures.ts`: rotas e dados de estoque.
- `App.tsx`, `inicio/Inicio.tsx`: rotas e botão "Estoque".

---

### Task 1: Modelo, migração e regras puras

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_estoque/migration.sql` (via `prisma migrate dev --name estoque --create-only`, then apply)
- Create: `apps/api/src/comum/dia-servico.ts`, `dia-servico.spec.ts`
- Create: `apps/api/src/estoque/quantidade.ts`, `quantidade.spec.ts`
- Create: `apps/api/src/estoque/consumo.ts`, `consumo.spec.ts`

**Interfaces:**
- Produces (Prisma):
  - `enum UnidadeEstoque { UN G ML }`
  - `enum TipoMovimento { VENDA ESTORNO ENTRADA CONTAGEM PERDA }`
  - `enum MotivoPerda { ACIDENTE VALIDADE PREPARO OUTRO }`
  - `enum NivelEstoque { OK ACABANDO ZERADO }`
  - `Fornecedor { id, restauranteId, nome, telefone String?, observacao String?, criadoEm }`
  - `ItemEstoque { id, restauranteId, nome, unidade UnidadeEstoque, quantidade Int @default(0), minimo Int @default(0), cheio Int @default(0), fornecedorId String? (onDelete SetNull), embalagemNome String?, embalagemQuantidade Int?, nivel NivelEstoque @default(OK), ativo Boolean @default(true), criadoEm }`, `@@unique([restauranteId, nome])`
  - `ReceitaItem { id, restauranteId, pratoId String?, opcaoId String?, itemId, quantidade Int }`
    - onDelete Cascade nas três FKs;
    - `@@unique([pratoId, itemId])`, `@@unique([opcaoId, itemId])`.
  - `MovimentoEstoque { id, restauranteId, itemId, tipo TipoMovimento, quantidade Int, motivo MotivoPerda?, observacao String?, usuarioId String?, rodadaId String?, lote String, desfeitoEm DateTime?, criadoEm }`
    - `@@index([restauranteId, criadoEm])`, `@@index([rodadaId])`.
  - `ListaCompra { id, restauranteId, itens Json, criadaEm, chegouEm DateTime? }`
    - `itens` = `{itemId, quantidade}[]`, quantidade na unidade base.
  - `Opcao.multiplicadorPct Int @default(100)`
  - relações inversas em `Restaurante`, `Prato`, `Opcao`, `Usuario`.
- Produces (TS):
  - `inicioDoDiaDeServico(agora: Date): Date`
  - `formatarQuantidade(base: number, unidade: 'UN'|'G'|'ML'): string`
  - `formatarCompra(base: number, unidade, embalagem: {nome: string; quantidade: number} | null): string`
  - `embalagensPara(base: number, porEmbalagem: number): number` (arredonda para cima)
  - `consumoDaRodada(itens: ItemVendido[], receitas: Receitas): Map<string, number>`
  - tipos:
    ```ts
    type ItemVendido = { pratoId: string; selecao: Record<string,string[]>; quantidade: number }
    type Receitas = {
      prato: Map<string, {itemId: string; quantidade: number}[]>
      opcao: Map<string, {itemId: string; quantidade: number; multiplicadorPct: number; grupoId: string; tipoGrupo: 'UNICA'|'MULTIPLA'|'SABORES'}>
      linhasOpcao: Map<string, {itemId: string; quantidade: number}[]>
    }
    ```

- [ ] **Step 1: Escrever os testes que falham**

`dia-servico.spec.ts`:
```ts
it('03:00 de sábado em SP ainda é sexta', () => {
  expect(inicioDoDiaDeServico(new Date('2026-11-14T06:00:00Z')).toISOString()).toBe('2026-11-13T08:00:00.000Z')
})
it('05:00 em SP começa o dia', () => {
  expect(inicioDoDiaDeServico(new Date('2026-11-14T08:00:00Z')).toISOString()).toBe('2026-11-14T08:00:00.000Z')
})
it('virada de mês', () => {
  expect(inicioDoDiaDeServico(new Date('2026-12-01T03:00:00Z')).toISOString()).toBe('2026-11-30T08:00:00.000Z')
})
```

`quantidade.spec.ts`:
- `formatarQuantidade(1500,'G')` → `'1,5 kg'`
- `(800,'G')` → `'800 g'`
- `(2000,'ML')` → `'2 L'`
- `(1250,'ML')` → `'1,25 L'`
- `(30,'UN')` → `'30 un'`
- `(-5,'UN')` → `'0 (conferir)'`
- `embalagensPara(45, 30)` → `2`
- `formatarCompra(60,'UN',{nome:'Cartela',quantidade:30})` → `'2 Cartela (60 un)'`
- `formatarCompra(45,'UN',{nome:'Cartela',quantidade:30})` → `'2 Cartela (60 un)'` (arredonda para cima)
- `formatarCompra(500,'G',null)` → `'500 g'`

`consumo.spec.ts`. Fixtures:
- receita da base da pizza = massa 300 g;
- sabor Margherita = queijo 200 g; sabor Calabresa = calabresa 150 g;
- opção G `multiplicadorPct: 150`; adicional Bacon = bacon 50 g;
- Chopp = chopp 500 ml.

Casos:
- **Pizza G meio a meio Margherita/Calabresa + Bacon, quantidade 2:** massa 900, queijo 300, calabresa 225, bacon 100.
  - massa = 2 × 1,5 × 300;
  - queijo = 2 × 1,5 × 100;
  - calabresa = 2 × 1,5 × 75;
  - bacon = 2 × 50.
- **Pizza M** (opção sem multiplicador, 100%) **só Margherita, quantidade 1:** massa 300, queijo 200.
- **Duas linhas do mesmo prato somam:** 2 Chopps em linhas separadas → chopp 1000.
- **Prato sem receita** → mapa vazio.
- **Opção da seleção que não está em `receitas.opcao`** (apagada) → ignorada, sem lançar erro.
- **Arredondamento só no fim:** 3 sabores de 100 g, quantidade 1 → 100, não 99.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter api test -- dia-servico quantidade consumo`
Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Schema e migração**

Editar o schema conforme Interfaces. Rodar `pnpm --filter api exec prisma migrate dev --name estoque`. A migração tem que ser só `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE … ADD COLUMN` e índices. Conferir o SQL antes de aplicar: nenhum `DROP`.

- [ ] **Step 4: Implementar as três funções**

`inicioDoDiaDeServico`: ler data e hora locais com `Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo', hourCycle:'h23', …})`. Se a hora < 5, voltar um dia. Devolver `Date.UTC(a, m, d, 8)` (05:00 em −03:00; SP sem horário de verão desde 2019, comentar isso).

`consumoDaRodada`, algoritmo:
```
total = Map<itemId, número real>
para cada item vendido:
  mult = produto de (opcao.multiplicadorPct/100) das opções escolhidas cujo tipoGrupo = UNICA
  base = receitas.prato[pratoId] ?? []                       → soma q × mult
  sabores = opções escolhidas com tipoGrupo SABORES; n = quantas
  para cada sabor: linhasOpcao[sabor] → soma q × mult / n
  demais opções escolhidas (UNICA e MULTIPLA): linhasOpcao[op] → soma q (sem mult)
  tudo × item.quantidade
no fim: Math.round em cada valor; remove os zeros
```

`formatarQuantidade`:
- G ≥ 1000 → kg; ML ≥ 1000 → L;
- até 3 casas decimais, sem zeros à direita, vírgula como separador.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter api test -- dia-servico quantidade consumo`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma apps/api/src/comum/dia-servico* apps/api/src/estoque
git commit -m "feat(api): stock schema, service day, quantity format and recipe consumption"
```

---

### Task 2: API — itens, fornecedores, movimentos, perdas e avisos

**Files:**
- Create: `apps/api/src/estoque/movimentos.ts`, `avisos-estoque.service.ts`, `estoque.service.ts`, `estoque.controller.ts`, `estoque.module.ts`
- Modify:
  - `apps/api/src/app.module.ts`
  - `apps/api/src/equipe/papel.ts` (`exigirDono`)
  - `apps/api/src/push/push.service.ts` (`notificarGerentes`)
  - `apps/api/src/eventos/eventos.types.ts`
- Test: `apps/api/test/estoque.e2e-spec.ts`

**Interfaces:**
- Consumes: modelos da Task 1, `inicioDoDiaDeServico`.
- Produces:
  - `exigirDono(usuario: UsuarioToken): void`: 403 `{mensagem:'Acesso só para o gerente'}`.
  - `type NovoMovimento = { itemId: string; tipo: TipoMovimento; quantidade: number; motivo?: MotivoPerda; observacao?: string; rodadaId?: string }`
  - `type AvisoEstoque = { tipo: 'ACABANDO'|'ZERADO'; itemId: string; nome: string } | { tipo: 'PERDA'; itemId: string; nome: string; quantidade: number; unidade: UnidadeEstoque; motivo: MotivoPerda }`
  - `aplicarMovimentos(tx: Tx, restauranteId: string, usuarioId: string | null, movimentos: NovoMovimento[]): Promise<AvisoEstoque[]>`
    - um `lote` (uuid) por chamada;
    - `quantidade: { increment }`;
    - depois relê o item e atualiza `nivel`;
    - devolve os avisos de cruzamento e de `PERDA`.
  - `AvisosEstoqueService.enviar(restauranteId: string, avisos: AvisoEstoque[]): Promise<void>`
    - `paraEquipe(restauranteId,'estoque-mudou',{})`, sempre;
    - push por aviso, via `PushService.notificarGerentes(restauranteId, msg)`:
      - ACABANDO "Acabando: Ovos" / "Está no mínimo";
      - ZERADO "Acabou: Ovos" / "Marque os pratos como esgotados se precisar";
      - PERDA "Perda: 30 un de Ovos" / "Acidente";
      - todos com url `/estoque`;
    - publica `EstoqueAcabando` ou `PerdaRegistrada`;
    - erros de push só vão para o log.
  - `PushService.notificarGerentes(restauranteId: string, msg: MensagemPush): Promise<void>`: usuários `papel: 'DONO'`.
  - Rotas, todas `equipe/estoque`, com o guard de equipe existente:

| Método e rota | Quem | Corpo | Resposta |
|---|---|---|---|
| `GET /equipe/estoque` | DONO | — | `ResumoEstoque` |
| `GET /equipe/estoque/itens` | qualquer papel | — | `ItemEstoqueDto[]` |
| `POST /equipe/estoque/itens` | DONO | `{nome, unidade, minimo, cheio, fornecedorId?, embalagemNome?, embalagemQuantidade?, quantidade?}` | 201 item |
| `PATCH /equipe/estoque/itens/:id` | DONO | mesmos campos, parciais | item |
| `DELETE /equipe/estoque/itens/:id` | DONO | — | 204 |
| `GET /equipe/estoque/itens/:id/movimentos` | DONO | — | 50 últimos |
| `POST /equipe/estoque/itens/:id/contagem` | DONO | `{quantidade}` | — |
| `POST /equipe/estoque/entradas` | DONO | `{itens:[{itemId, quantidade>0}]}` (≥ 1) | — |
| `POST /equipe/estoque/perdas` | GARCOM, COZINHA, DONO | `{itemId, quantidade>0, motivo, observacao?}` | — |
| `GET /equipe/estoque/desfazer` | qualquer papel | — | `{lote, descricao, ate} \| null` |
| `POST /equipe/estoque/desfazer` | qualquer papel | — | — |
| `GET / POST / PATCH / DELETE /equipe/estoque/fornecedores[/:id]` | DONO | `{nome, telefone?, observacao?}` | — |

  Regras das rotas:
  - **Itens:**
    - `GET /itens` traz só `ativo`, em ordem alfabética, e é usado pelo "Avisar perda";
    - `POST /itens`: nome duplicado → 409 "Já existe um item com esse nome"; `quantidade` cria a quantidade inicial via `ENTRADA`;
    - `PATCH /itens/:id`: mudar `unidade` com movimentos → 409 "Não dá para mudar a unidade de um item que já tem movimentos";
    - `DELETE /itens/:id` arquiva (`ativo:false`) e apaga as linhas `ReceitaItem` do item.
  - **Contagem:** grava `CONTAGEM` com `quantidade = informada − atual`.
  - **Perdas:** motivo `OUTRO` sem observação → 422 "Conte o que aconteceu".
  - **Desfazer:**
    - `GET` devolve o último lote **não desfeito** do usuário, com tipo `ENTRADA`/`CONTAGEM`/`PERDA` e menos de 10 min;
    - `POST` desfaz esse lote: marca `desfeitoEm` e aplica o inverso direto no item (sem criar movimento novo), recalculando o nível;
    - sem lote válido → 409 "Nada para desfazer".
  - **Fornecedores:** `DELETE` com itens ligados → itens ficam sem fornecedor.
  - DTOs com zod. Quantidades são inteiros na unidade base; `minimo`/`cheio` são ≥ 0; `embalagemQuantidade` ≥ 1.
- `ItemEstoqueDto = {id, nome, unidade, quantidade, minimo, cheio, nivel, fornecedor: {id, nome} | null, embalagem: {nome, quantidade} | null}`
- `ResumoEstoque`:
  ```ts
  {
    acabando: ItemEstoqueDto[]                    // nivel ACABANDO
    acabou: (ItemEstoqueDto & { pratos: {id, nome, esgotado}[] })[]  // ZERADO + pratos ativos cuja receita (do prato ou de opção) usa o item
    perdasHoje: {itemId, nome, quantidade, unidade, motivo, observacao, criadoEm}[]  // sem usuário; desde inicioDoDiaDeServico; não desfeitas
    listaAberta: {id, criadaEm} | null            // ListaCompra mais recente sem chegouEm
  }
  ```

- [ ] **Step 1: Escrever os testes e2e que falham** (`test/estoque.e2e-spec.ts`)

Montagem:
- login de dono, ana e cozinha;
- `beforeEach` apaga `movimentoEstoque`, `receitaItem`, `listaCompra`, `itemEstoque`, `fornecedor` e `evento`.

Testes:
- `'garçom não cria item (403)'`
- `'dono cria item com quantidade inicial e ele aparece no resumo quando abaixo do mínimo'`: Ovos UN, quantidade 20, minimo 30 → `GET /equipe/estoque` tem `acabando[0].nome === 'Ovos'`.
- `'nome repetido dá 409'`
- `'contagem grava a diferença'`: quantidade 50, contagem 47 → movimento CONTAGEM −3, item 47.
- `'contagem 0 em item negativo grava diferença positiva'`: forçar `quantidade: -4` via prisma; contagem 0 → movimento +4.
- `'cozinha avisa perda: baixa, evento PerdaRegistrada e aparece em perdasHoje sem nome'`: corpo do resumo não contém `'Dani'`.
- `'perda OUTRO sem observação dá 422'`
- `'vendas seguidas abaixo do mínimo avisam uma vez só'`: chamar `aplicarMovimentos` duas vezes via `t.app.get(PrismaService).$transaction` com −5 e −5 (50 → 45 → 40; mínimo 46). A 1ª devolve `[ACABANDO]`, a 2ª `[]`. Chegando a 0 → `[ZERADO]`. Entrada para 100 → nível OK.
- `'acabou lista os pratos que usam o item'`: criar ReceitaItem do Mix da Casa com o item; zerar → `acabou[0].pratos[0].nome === 'Mix da Casa'`.
- `'desfazer volta a perda da própria pessoa e some do resumo'`
- `'desfazer não pega lote de outra pessoa nem depois de 10 min'`: (a) a cozinha desfaz com perda só da ana → 409; (b) `criadoEm` recuado 11 min → 409.
- `'arquivar item tira das receitas e do GET itens'`
- `'mudar unidade de item com movimento dá 409'`
- `'outro restaurante não vê nem mexe no item (404)'`

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter api test:e2e -- estoque`
Expected: FAIL (404 nas rotas).

- [ ] **Step 3: Implementar**

`movimentos.ts`, `avisos-estoque.service.ts`, `estoque.service.ts`, `estoque.controller.ts` e `estoque.module.ts`, conforme Interfaces. Detalhes:
- `PushService` é importado do módulo de push e `TempoRealService` do tempo-real, como no `ContaModule`.
- Item de outro restaurante → 404 "Item não encontrado".
- O serviço chama `avisos.enviar` depois do `$transaction`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter api test:e2e -- estoque`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src apps/api/test/estoque.e2e-spec.ts
git commit -m "feat(api): stock items, suppliers, counts, losses, undo and low-stock alerts"
```

---

### Task 3: API — receitas, esgotado e baixa pela venda

**Files:**
- Create: `apps/api/src/estoque/baixa.ts`, `receitas.service.ts`, `receitas.controller.ts`
- Modify:
  - `apps/api/src/estoque/estoque.module.ts` (exporta `AvisosEstoqueService`)
  - `apps/api/src/rodadas/rodadas-equipe.service.ts` (`confirmar`, `cancelar`)
  - `apps/api/src/rodadas/rodadas.service.ts` (rodada criada já `CONFIRMADA`)
  - `apps/api/src/rodadas/rodadas.module.ts` (importa `EstoqueModule`)
- Test: `apps/api/test/receitas.e2e-spec.ts`

**Interfaces:**
- Consumes: `consumoDaRodada`, `aplicarMovimentos`, `AvisosEstoqueService.enviar`.
- Produces:
  - `baixarRodada(tx: Tx, restauranteId: string, rodadaId: string, usuarioId: string | null): Promise<AvisoEstoque[]>`
    - lê os itens da rodada (`pratoId`, `selecao`, `quantidade`);
    - carrega as receitas dos pratos e das opções envolvidas, só com itens `ativo`;
    - chama `consumoDaRodada` e aplica `VENDA` (quantidade negativa) com `rodadaId`.
  - `estornarRodada(tx: Tx, restauranteId: string, rodadaId: string, usuarioId: string): Promise<AvisoEstoque[]>`
    - soma os movimentos `VENDA` da rodada por item e aplica `ESTORNO` positivo;
    - nada a estornar → `[]`.
  - Rotas, todas DONO:
    - `GET /equipe/estoque/receitas` → `PratoReceita[]`;
    - `PUT /equipe/estoque/receitas/pratos/:pratoId` `{itens:[{itemId, quantidade>0}]}` substitui a receita do prato;
    - `PUT /equipe/estoque/receitas/opcoes/:opcaoId` `{itens:[…], multiplicadorPct?: 10..500}`:
      - `multiplicadorPct` em opção de grupo que não é `UNICA` → 422 "Só tamanho tem multiplicador";
      - item repetido na lista → 422 "Item repetido na receita";
      - item de outro restaurante ou arquivado → 422 "Item de estoque inválido".
    - `PATCH /equipe/pratos/:id` `{esgotado: boolean}` → `{id, esgotado}`.
  - Tipos:
    ```ts
    type PratoReceita = {
      id, nome, categoria: string, esgotado: boolean,
      receita: LinhaReceita[],
      grupos: { id, nome, tipo, opcoes: { id, nome, multiplicadorPct, receita: LinhaReceita[] }[] }[],
    }
    type LinhaReceita = { itemId, nome, unidade, quantidade }
    ```
    Pratos ordenados por categoria e por `ordem`.
- Integração nos três pontos, dentro da transação, depois de mudar o status:
  - `confirmar`: `avisos = await baixarRodada(tx, …, usuario.id)`;
  - `rodadas.service` (CONFIRMADA direta): `baixarRodada(tx, …, null)`;
  - `cancelar`: `estornarRodada(tx, …, usuario.id)`;
  - depois do commit, em cada um: `await this.avisosEstoque.enviar(restauranteId, avisos)`;
  - `recusar` não mexe no estoque.

- [ ] **Step 1: Escrever os testes e2e que falham** (`test/receitas.e2e-spec.ts`)

Montagem: itens Massa (G), Queijo (G), Calabresa (G), Bacon (G) e Chopp (ML), todos com quantidade 10000 e mínimo 0.

Receitas:
- base da Pizza Margherita: Massa 300;
- sabor Margherita: Queijo 200;
- sabor Calabresa: Calabresa 150;
- opção G: `multiplicadorPct 150`;
- adicional Bacon: Bacon 50.

Testes:
- `'GET receitas traz pratos com grupos, opções e receita'`
- `'multiplicador em grupo que não é tamanho dá 422'`: opção do grupo Adicionais.
- `'pedido direto do cliente baixa o estoque pela receita'`: cliente com garçom e celular confirmado pede a pizza G Margherita/Calabresa + Bacon, quantidade 1 → Massa 9550, Queijo 9850, Calabresa 9887 (round(10000 − 112,5)), Bacon 9950.
- `'confirmar rodada pendente baixa; recusar não baixa'`
- `'cancelar na janela devolve o que a venda baixou mesmo se a receita mudou'`: confirmar, trocar a receita da base para Massa 999, cancelar → Massa volta a 10000.
- `'prato sem receita não gera movimento'`: Mix da Casa → 0 movimentos.
- `'opção apagada depois do pedido não quebra a confirmação'`: rodada pendente com seleção que inclui uma opção; apagar a opção via prisma; confirmar → 200.
- `'venda que cruza o mínimo manda estoque-mudou para a equipe'`: espiar `TempoRealService.paraEquipe`, como no `conta.e2e-spec`.
- `'dono marca prato esgotado e cardápio público mostra esgotado; garçom recebe 403'`
- `'esgotado nunca muda sozinho: zerar o item mantém esgotado false'`

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter api test:e2e -- receitas`
Expected: FAIL.

- [ ] **Step 3: Implementar** `baixa.ts`, receitas service e controller, e as três integrações.

- [ ] **Step 4: Rodar a suíte da API inteira**

Run: `pnpm --filter api test && pnpm --filter api test:e2e`
Expected: PASS em tudo, incluindo `rodadas`, `conta` e `producao` existentes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src apps/api/test/receitas.e2e-spec.ts
git commit -m "feat(api): dish recipes, sold-out toggle and stock deduction on confirmed rounds"
```

---

### Task 4: API — lista de compras, planilha e chegada

**Files:**
- Create: `apps/api/src/estoque/compras.service.ts`, `compras.controller.ts`, `planilha.ts`
- Modify: `apps/api/package.json` (`pnpm --filter api add exceljs`), `estoque.module.ts`
- Test: `apps/api/test/compras.e2e-spec.ts`

**Interfaces:**
- Consumes: `aplicarMovimentos`, `formatarCompra`, `embalagensPara`, `AvisosEstoqueService`.
- Produces (rotas, todas DONO):
  - `GET /equipe/estoque/compras/sugestao` → `GrupoCompra[]`.
    - Itens `ativo` com `quantidade <= minimo`.
    - Sugerida = `cheio − max(quantidade, 0)`. Se ≤ 0, usa `minimo − quantidade` (pelo menos 1).
    - Com embalagem, arredonda para embalagens inteiras: `embalagensPara(sugerida, emb) × emb`.
    - Agrupa por fornecedor (nome A→Z, "Sem fornecedor" por último).
  - `POST /equipe/estoque/compras` `{itens:[{itemId, quantidade>0}]}` (≥ 1) → `ListaCompraDto`.
  - `GET /equipe/estoque/compras/:id` → `ListaCompraDto`.
  - `GET /equipe/estoque/compras/:id/planilha` → `.xlsx`.
    - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
    - `Content-Disposition: attachment; filename="lista-de-compras-AAAA-MM-DD.xlsx"`.
    - Uma aba por fornecedor (nome cortado em 31 caracteres, sem `[]:*?/\`).
    - Linha 1, em negrito: `Item | Quantidade | Unidade | Observação`.
    - Quantidade com embalagem = nº de embalagens e Unidade = `"Cartela (30 un)"`; sem embalagem, Unidade = `kg`/`g`/`L`/`ml`/`un` pelo formato.
  - `POST /equipe/estoque/compras/:id/chegou` `{itens:[{itemId, quantidade>=0}]}`.
    - Aplica `ENTRADA` para quantidade > 0 (um lote) e marca `chegouEm`.
    - Já chegou → 409 "Esta compra já foi lançada".
  - Tipos:
    ```ts
    type LinhaCompra = { itemId, nome, unidade, quantidade, texto: string, embalagem: {nome, quantidade} | null }  // texto = formatarCompra(...)
    type GrupoCompra = { fornecedor: { id, nome, telefone } | null, itens: LinhaCompra[] }
    type ListaCompraDto = { id, criadaEm, chegouEm, grupos: GrupoCompra[] }
    ```
    `ListaCompraDto` reagrupa pelo fornecedor atual de cada item; item arquivado continua aparecendo.
- `gerarPlanilha(grupos: GrupoCompra[]): Promise<Buffer>` em `planilha.ts`.

- [ ] **Step 1: Escrever os testes e2e que falham** (`test/compras.e2e-spec.ts`)

Montagem:
- fornecedores Granja Boa (Ovos) e Bebidas SA (Chopp, ML);
- Ovos: quantidade 10, minimo 30, cheio 120, embalagem Cartela 30;
- Chopp: quantidade 5000, minimo 10000, cheio 50000;
- Sal: acima do mínimo.

Testes:
- `'sugestão agrupa por fornecedor, arredonda para cartelas e ignora item acima do mínimo'`: Ovos 120 (110 → 4 cartelas), texto `'4 Cartela (120 un)'`; Chopp 45000; sem Sal.
- `'salvar lista e baixar planilha com uma aba por fornecedor'`: ler o buffer com `new ExcelJS.Workbook().xlsx.load(res.body)`; abas `['Bebidas SA','Granja Boa']`; `getRow(1)` = cabeçalho; Ovos com quantidade 4 e unidade `'Cartela (30 un)'`. Usar `.buffer(true).parse(binário)` no supertest.
- `'compra chegou lança entrada, tira do acabando e não lança duas vezes'`: chegou → Ovos 130, nível OK; 2ª vez → 409.
- `'chegou com quantidade corrigida usa o valor informado'`
- `'garçom não acessa compras (403)'`

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter api test:e2e -- compras`
Expected: FAIL.

- [ ] **Step 3: Instalar o exceljs e implementar**

- [ ] **Step 4: Rodar e ver passar.** Depois `pnpm --filter api lint && pnpm --filter api build`, que deve sair limpo.

- [ ] **Step 5: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): shopping list with spreadsheet export and purchase arrival"
```

---

### Task 5: Equipe — início do estoque, itens e fornecedores

**Files:**
- Create:
  - `apps/equipe/src/estoque/unidades.ts` (+ `unidades.test.ts`)
  - `CampoQuantidade.tsx`, `TelaEstoque.tsx`, `TelaItens.tsx`, `TelaItem.tsx`, `TelaFornecedores.tsx`
  - `apps/equipe/src/api/estoque.ts`, `estilo/estoque.css`
  - `estoque/TelaEstoque.test.tsx`, `estoque/TelaItem.test.tsx`
- Modify:
  - `rotas.ts` (+ `rotas.test.ts`), `App.tsx`, `inicio/Inicio.tsx`, `api/tipos.ts`
  - `test/api-falsa.ts`, `test/fixtures.ts`

**Interfaces:**
- Consumes: rotas da Task 2 (formas exatas acima).
- Produces:
  - Rotas novas:
    ```ts
    | { nome: 'estoque' } | { nome: 'estoque-itens' } | { nome: 'estoque-item'; id: string } | { nome: 'estoque-fornecedores' }
    | { nome: 'estoque-receitas' } | { nome: 'estoque-receita'; pratoId: string } | { nome: 'estoque-compras' } | { nome: 'estoque-chegou'; listaId: string }
    ```
    Caminhos:
    - `/estoque`, `/estoque/itens`, `/estoque/itens/:id`, `/estoque/fornecedores`;
    - `/estoque/receitas`, `/estoque/receitas/:pratoId`;
    - `/estoque/compras`, `/estoque/compras/:id/chegou`.
    Rotas de estoque com papel ≠ DONO renderizam `Inicio`.
  - `unidades.ts`:
    - `type Unidade = 'UN'|'G'|'ML'`;
    - `type UnidadeDigitada = 'un'|'g'|'kg'|'ml'|'L'`;
    - `unidadesDe(u: Unidade): UnidadeDigitada[]` (G → `['g','kg']`; ML → `['ml','L']`; UN → `['un']`);
    - `paraBase(texto: string, digitada: UnidadeDigitada): number | null` (aceita vírgula ou ponto; ≤ 0 ou inválido → null; arredonda);
    - `formatarQuantidade(base, u)`, mesmas regras e casos da Task 1;
    - `falarQuantidade(base, u)`: "1,5 quilo", "800 gramas", "2 litros", "30 unidades", "1 unidade".
  - `<CampoQuantidade unidade={Unidade} rotulo={string} valorBase={number|null} onMudar={(base: number|null) => void} />`: input `inputMode="decimal"` + `<select>` de unidade, rotulados.
  - `api/estoque.ts`: uma função por rota da Task 2, retornando os tipos espelhados em `api/tipos.ts` (`ItemEstoque`, `ResumoEstoque`, `Fornecedor`, `MovimentoEstoque`, `MotivoPerda`, `Desfazivel`).

Telas:
- **`TelaEstoque`** (heading "Estoque"):
  - bloco "Acabando": nome + quantidade formatada + mínimo;
  - bloco "Acabou": cada prato com botão "Marcar como esgotado", ou "Esgotado ✓" desabilitado;
  - bloco "Perdas de hoje": "30 un de Ovos · Acidente";
  - botões grandes: "Gerar lista de compras" → `/estoque/compras`; "Chegou compra" → `/estoque/compras/:id/chegou`, só com `listaAberta`; "Itens", "Receitas", "Fornecedores";
  - vazio: "Tudo em dia ✓";
  - recarrega no socket `estoque-mudou`, usando o hook de tempo real que já existe.
- **`TelaItens`:** lista com selo de nível e botão "Novo item" (form: nome, unidade, mínimo, cheio, fornecedor, embalagem). Clique no item → `TelaItem`.
- **`TelaItem`:**
  - editar campos;
  - "Contar estoque" (CampoQuantidade);
  - se |nova − atual| > 20% de `cheio` → `confirm`-dialog "A diferença é grande (X). Confirmar?";
  - histórico (tipo, quantidade, quem, quando);
  - "Arquivar item".
- **`TelaFornecedores`:** lista, novo, editar e excluir; telefone com `inputMode="tel"`.
- **`Inicio`:** DONO ganha o botão "Estoque" (com " · N acabando" quando N > 0, a partir do resumo).

- [ ] **Step 1: Escrever os testes que falham**

`unidades.test.ts`:
- os casos de formato da Task 1;
- `paraBase('1,5','kg')` → 1500;
- `paraBase('2','L')` → 2000;
- `paraBase('abc','g')` → null;
- `paraBase('0','un')` → null;
- `paraBase('-3','un')` → null;
- `falarQuantidade(1500,'G')` → `'1,5 quilo'`.

`rotas.test.ts`: `lerRota('/estoque/itens/abc','')` → `{nome:'estoque-item', id:'abc'}`; e as demais rotas.

`TelaEstoque.test.tsx`:
- `'mostra Acabando, Acabou com Marcar como esgotado e Perdas de hoje'`: clicar no botão → `PATCH /api/equipe/pratos/p1` com `{esgotado:true}`, e o botão vira "Esgotado ✓".
- `'sem nada mostra Tudo em dia'`
- `'garçom em /estoque vê o início normal'`
- `'socket estoque-mudou recarrega'`

`TelaItem.test.tsx`:
- `'contar 1,5 kg manda 1500'`
- `'diferença grande pede confirmação e cancelar não envia'`
- `'quantidade inválida não envia e avisa "Digite uma quantidade maior que zero"'`

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter equipe test`
Expected: FAIL nos arquivos novos.

- [ ] **Step 3: Implementar** as telas, a api, as rotas, as entradas na api falsa e nas fixtures, e o CSS.

Usar as classes `.botao` e `.botao--secundario` que já existem. Botão ≥ 44 px de altura; selos de nível com texto, não só cor.

- [ ] **Step 4: Rodar e ver passar.** Também `pnpm --filter equipe lint && pnpm --filter equipe build`, que deve sair limpo.

- [ ] **Step 5: Commit**

```bash
git add apps/equipe
git commit -m "feat(equipe): stock home, items, suppliers and counts for the manager"
```

---

### Task 6: Equipe — receitas e esgotado

**Files:**
- Create: `apps/equipe/src/estoque/TelaReceitas.tsx`, `TelaReceita.tsx`, `TelaReceita.test.tsx`
- Modify: `api/estoque.ts`, `api/tipos.ts`, `test/api-falsa.ts`, `test/fixtures.ts`, `App.tsx`

**Interfaces:**
- Consumes:
  - `GET /equipe/estoque/receitas`;
  - `PUT …/receitas/pratos/:id`;
  - `PUT …/receitas/opcoes/:id`;
  - `PATCH /equipe/pratos/:id`;
  - `CampoQuantidade`, `formatarQuantidade`.
- Produces:
  - **`TelaReceitas`:** pratos por categoria, cada um com "Receita: 3 itens" ou "Sem receita" e um botão de alternar "Esgotado / Disponível" (`aria-pressed`).
  - **`TelaReceita`** (heading = nome do prato):
    - seção "Receita do prato": linhas `item + CampoQuantidade + Remover` e "Adicionar ingrediente" (select de itens ativos);
    - uma seção por grupo de opções: em cada opção, as linhas da receita e, se o grupo for `UNICA`, o campo "Multiplica a receita" (%), com padrão 100 e dica "G = 150 → usa 1,5× a massa e os sabores";
    - grupo `SABORES` com a dica "Cada sabor entra pela metade numa pizza meio a meio";
    - um botão "Salvar" por seção, que faz o PUT da seção;
    - erro 422 aparece em `role="alert"`.

- [ ] **Step 1: Escrever os testes que falham** (`TelaReceita.test.tsx`)
- `'adicionar Ovos 3 un na receita do prato e salvar manda PUT com quantidade 3'`
- `'multiplicador só aparece em grupo de escolha única'`
- `'salvar G com 150 manda multiplicadorPct 150'`
- `'esgotado alterna na lista de receitas'`
- `'422 mostra a mensagem do servidor'`

- [ ] **Step 2: Rodar e ver falhar.** Run: `pnpm --filter equipe test -- TelaReceita`. Expected: FAIL.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Rodar e ver passar.** Run: `pnpm --filter equipe test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/equipe
git commit -m "feat(equipe): recipe editor with size multiplier and sold-out toggle"
```

---

### Task 7: Equipe — Avisar perda, Desfazer, lista de compras e chegada

**Files:**
- Create:
  - `apps/equipe/src/estoque/AvisarPerda.tsx` (+ `AvisarPerda.test.tsx`)
  - `TelaCompras.tsx` (+ test), `TelaChegou.tsx`
  - `whatsapp.ts` (+ `whatsapp.test.ts`)
- Modify: `inicio/Topo.tsx` (+ `Topo.test.tsx`), `api/estoque.ts`, `test/api-falsa.ts`, `App.tsx`

**Interfaces:**
- Consumes:
  - `GET /itens`, `POST /perdas`, `GET|POST /desfazer`;
  - `GET /compras/sugestao`, `POST /compras`, `GET /compras/:id`, `GET /compras/:id/planilha`, `POST /compras/:id/chegou`.
- Produces:
  - **`<AvisarPerda aberto onFechar />`:** um `dialog` "Avisar perda" em 3 passos.
    1. Busca (input "Buscar item") e lista de itens; clicar escolhe.
    2. `CampoQuantidade` com a unidade do item.
    3. Chips de motivo (Acidente, Validade, Erro de preparo, Outro); Outro mostra o textarea "O que aconteceu?".
    - Botão "Avisar".
    - Sucesso → status "Perda avisada" + botão "Desfazer", que chama `POST /desfazer`.
    - Botões "Voltar" entre os passos.
  - **`Topo`:** botão "Avisar perda" para todos os papéis (inclusive COZINHA na tela da produção).
  - **`whatsapp.ts`:**
    - `linkWhatsApp(telefone: string | null, texto: string): string`: `https://wa.me/<dígitos>?text=<encodeURIComponent>`. Só dígitos; 10 ou 11 dígitos → prefixo `55`; telefone vazio → `https://wa.me/?text=…`.
    - `textoPedido(restaurante: string, fornecedor: string, linhas: {nome, texto}[]): string`:
      ```
      Olá, Granja Boa! Pedido do Cantina Demo:
      • Ovos: 4 Cartela (120 un)
      Obrigado!
      ```
  - **`TelaCompras`:**
    - carrega a sugestão;
    - um grupo por fornecedor, com linhas editáveis (CampoQuantidade; em item com embalagem, o campo conta embalagens) e "Tirar da lista";
    - "Adicionar item" para qualquer item ativo;
    - "Salvar lista" → POST, depois mostra por grupo os botões "Baixar planilha" (link `href` para `/api/equipe/estoque/compras/:id/planilha`, `download`) e "Mandar no WhatsApp" (`linkWhatsApp`, `target="_blank"`, `rel="noopener"`).
    - O nome do restaurante vem do usuário logado ou do cardápio que o app já lê; se não houver, "nosso restaurante".
  - **`TelaChegou`:** linhas da lista com a quantidade pré-preenchida e editável, e o botão "Confirmar chegada" → `POST chegou` → `/estoque`. Status 409 mostra a mensagem.

- [ ] **Step 1: Escrever os testes que falham**

`whatsapp.test.ts`:
- `linkWhatsApp('(11) 98888-7777', 'oi')` → `'https://wa.me/5511988887777?text=oi'`;
- `linkWhatsApp('5511988887777', 'a b')` → `'https://wa.me/5511988887777?text=a%20b'`;
- `textoPedido`, com o texto exato acima.

`AvisarPerda.test.tsx`:
- `'cozinha avisa 1 cartela… : escolhe Ovos, 30 un, Acidente e manda POST perdas com {itemId, quantidade:30, motivo:"ACIDENTE"}'`
- `'Outro exige texto antes de Avisar'`
- `'Desfazer depois de avisar chama POST desfazer'`
- `'busca filtra itens'`

`Topo.test.tsx`: `'botão Avisar perda aparece para a cozinha'`.

`TelaCompras.test.tsx`:
- `'mostra sugestão por fornecedor e Salvar lista manda as quantidades ajustadas'`: mudar Ovos para 5 cartelas → corpo `{itens:[{itemId:'ovos', quantidade:150}, …]}`.
- `'depois de salvar mostra Baixar planilha e Mandar no WhatsApp com o link certo'`
- `'Tirar da lista remove a linha do envio'`

- [ ] **Step 2: Rodar e ver falhar.** Run: `pnpm --filter equipe test`. Expected: FAIL nos novos.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Rodar e ver passar.** Também lint e build da equipe, que devem sair limpos.

- [ ] **Step 5: Commit**

```bash
git add apps/equipe
git commit -m "feat(equipe): report losses from any role, undo, shopping list with spreadsheet and WhatsApp"
```

---

### Task 8: Demo, roteiro e verificação final

**Files:**
- Create: `apps/api/scripts/dev-estoque.mjs`
- Modify: `apps/api/package.json` (script `"dev:estoque": "node scripts/dev-estoque.mjs"`), `README.md` (seção "Estoque")

**Interfaces:**
- Consumes: modelos da Task 1.
- Produces: o script `dev:estoque` no banco dev. Modelo: `scripts/dev-conta.mjs`, que lê o `.env`. Ele é idempotente (upsert por nome) e **não apaga nada**. Cria:
  - fornecedores Granja Boa, Bebidas SA e Hortifrúti Central (telefones fictícios `11900000001`…);
  - itens:

    | Item | Unidade | Quantidade | Mínimo | Cheio | Fornecedor e embalagem |
    |---|---|---|---|---|---|
    | Ovos | UN | 60 | 30 | 180 | Granja Boa, Cartela 30 |
    | Massa de pizza | G | 6000 | 3000 | 15000 | — |
    | Queijo muçarela | G | 4000 | 2000 | 10000 | — |
    | Calabresa | G | 1500 | 1000 | 5000 | — |
    | Bacon | G | 800 | 500 | 3000 | — |
    | Chopp Pilsen | ML | 30000 | 10000 | 50000 | Bebidas SA, Barril 30 L |
    | Picanha | G | 3000 | 2000 | 8000 | — |

  - receitas:
    - Pizza Margherita (base Massa 300; sabores Margherita = Queijo 200, Calabresa = Calabresa 150 + Queijo 100, Quatro Queijos = Queijo 300; P 70%, M 100%, G 150%; Bacon 50);
    - Chopp 500ml = Chopp 500;
    - Picanha na Chapa = Picanha 400.
  - Busca o restaurante pelo slug da demo e as opções pelo nome dentro do prato.

README, seção "Estoque": como rodar `dev:estoque` e um roteiro curto de teste:
1. dono → Estoque;
2. pedido de 2 pizzas G → Massa baixa 900;
3. cozinha → Avisar perda de Ovos;
4. dono vê em Perdas de hoje;
5. Gerar lista de compras → planilha e WhatsApp;
6. Chegou compra;
7. Desfazer.

- [ ] **Step 1: Escrever o script e rodar no banco dev duas vezes** (idempotência).

Run: `pnpm --filter api dev:estoque && pnpm --filter api dev:estoque`
Expected: as duas rodadas terminam com "Estoque de demo pronto", sem erro e sem itens duplicados.

- [ ] **Step 2: Suíte completa**

Run:
```bash
pnpm --filter api test && pnpm --filter api test:e2e && pnpm --filter equipe test && pnpm --filter cliente test && pnpm --filter @cardapio/opcoes test && pnpm -r lint && pnpm -r build
```
Expected: tudo verde.

- [ ] **Step 3: Smoke no app real**

Com a API e a equipe no ar:
- login dono → `/estoque` mostra os blocos;
- `GET /api/equipe/estoque/compras/sugestao` → 200;
- o download da planilha abre no Excel ou no LibreOffice.

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/dev-estoque.mjs apps/api/package.json README.md
git commit -m "chore: stock demo data script and test walkthrough"
```

# Etapa 3B — Conta da mesa e fechamento — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O garçom abre a conta da mesa, marca 10% e couvert, escolhe a forma de pagamento e fecha. A mesa é liberada, o cliente vê "Conta fechada" com o "Avalie no Google" em destaque, e o evento `ContaFechada` fica gravado.

**Architecture:**
- **Cálculo:** a conta é calculada por uma função pura `calcularConta`, escrita duas vezes com os mesmos casos de teste: no servidor (`apps/api/src/conta/calcular-conta.ts`) e no pacote compartilhado do front (`packages/opcoes/src/conta.ts`). É o mesmo padrão já usado em `preco.ts`: o front mostra, o servidor cobra.
- **Fechar:** `POST /equipe/mesas/:token/fechar` trava a mesa, recalcula e compara com o total que o garçom viu. Depois encerra a sessão, resolve os chamados e limpa o carrinho. Só depois do commit publica o evento e avisa por socket.
- **Celular antigo:** o celular que estava na sessão fechada recebe 403 `CONTA_FECHADA`, em vez de entrar sozinho numa sessão nova.

**Tech Stack:** NestJS 11, Prisma 6 (Postgres), zod, Socket.IO, React 19 + Vite, Vitest, Jest (e2e).

**Spec:** `docs/superpowers/specs/2026-11-04-cardapio-digital-design.md`. Seções usadas:
- §4 Avaliação;
- §5 passo 7, "Fechar a conta";
- §8.1, nos itens "Acesso pela URL da mesa", "Conta da mesa" e "Pagamento e divisão".

## Global Constraints

- "o preço dos itens é **imutável**; o garçom não altera valor de item". A conta soma os `precoUnitarioCentavos × quantidade` já congelados nas rodadas `CONFIRMADA`.
- "dois checkboxes: "10% de serviço" e "Couvert", que somam ao total quando marcados".
- "cada restaurante habilita ou desabilita essas opções no painel e define o valor do couvert". O painel é da Etapa 4. Aqui a configuração entra pelo script `dev:conta` e pelo seed.
- "o couvert é **por pessoa**, e o garçom informa quantas pessoas".
- "os 10% incidem só sobre os itens, não sobre o couvert".
- "o padrão de cada checkbox (marcado ou não) é configurável".
- "pagamento e divisão da conta são feitos **na maquininha**". O sistema "só mostra o total e o garçom **dá baixa** (registra forma de pagamento e fecha). Não há divisão de conta dentro do sistema".
- As formas de pagamento são exatamente três: cartão, Pix, dinheiro (`CARTAO`, `PIX`, `DINHEIRO`).
- "A mesa é liberada e o garçom volta a contar como "livre"". Isso já acontece sozinho: `escolher-garcom` conta só sessões `ABERTA`.
- "existe uma sessão de mesa, criada no primeiro acesso e encerrada no `ContaFechada`". "Quando a sessão fecha, os dispositivos antigos perdem o acesso".
- "O botão [Avalie no Google] ganha destaque depois que a conta é fechada".
- O evento persistido se chama `ContaFechada`.
- Regras que continuam valendo:
  - textos em pt-BR;
  - a API usa prettier e eslint; os fronts usam oxlint, sem ponto e vírgula e com aspas simples;
  - nunca rodar o seed no banco de dev;
  - migração só acrescenta, nunca apaga.

## Review Focus

1. **Pedido confirmado (ou cancelado) entre abrir a tela da conta e tocar "Fechar".** O servidor responde 409 `A conta mudou. Confira o novo total.`, não fecha nada, e a tela mostra o total novo.
2. **Dois garçons fecham a mesma mesa ao mesmo tempo, ou há toque duplo.** Um fecha. O outro recebe 409 `Esta mesa já foi fechada`. Só um `ContaFechada` é gravado.
3. **Rodada `AGUARDANDO_GARCOM` na hora de fechar.** A resposta é 409 `Confirme ou recuse os pedidos pendentes antes de fechar`, e a tela já avisa antes de deixar tocar.
4. **Celular do cliente bloqueado durante o fechamento.** Ao voltar, ele vê "Conta fechada" e não cai calado numa sessão nova. Tocar "Voltar ao cardápio" entra numa sessão nova, e o primeiro pedido dela pede confirmação do garçom.
5. **Corpo ruim, recusado com 422.** Os casos são:
   - `pessoas` igual a 0, negativo ou fracionado com couvert marcado;
   - forma de pagamento fora das três;
   - serviço ou couvert marcado num restaurante que desligou a opção.

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `apps/api/prisma/schema.prisma` + migração `conta` | config da conta no restaurante; enum `FormaPagamento`; dados do fechamento na sessão |
| `apps/api/src/conta/calcular-conta.ts` (+ `.spec.ts`) | cálculo puro (servidor) |
| `packages/opcoes/src/conta.ts` (+ `conta.test.ts`) | o mesmo cálculo, exportado em `index.ts` (front) |
| `apps/api/src/conta/{conta.service,conta.controller,conta.module}.ts` | fechar a conta |
| `apps/api/src/rodadas/rodadas-equipe.service.ts`, `rodadas.types.ts` | `MesaEquipe` ganha `aberta` e `conta` |
| `apps/api/src/sessao-mesa/sessao-mesa.service.ts` | 403 `CONTA_FECHADA` |
| `apps/api/scripts/dev-conta.mjs`, `prisma/seed.ts`, `scripts/garcom.mjs` | config de demo; comando `fechar` |
| `apps/equipe/src/mesa/ContaMesa.tsx` (+ teste), `TelaMesa.tsx`, `api/*` | tela da conta |
| `apps/cliente/src/pedido/ContaFechada.tsx` (+ teste), `api/mesa.ts`, `tempo-real/useMesaAoVivo.ts`, `pedido/useRodadas.ts`, `lista/ListaCardapio.tsx` | tela "Conta fechada" |
| `apps/api/test/conta.e2e-spec.ts` | e2e do fechamento |

---

### Task 1: Configuração da conta, cálculo e a conta na tela da mesa (API + pacote)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`. Create a migração com `pnpm --filter api exec prisma migrate dev --name conta`, rodando contra o banco de **teste** ou aplicando no dev com `migrate deploy`. A migração é aditiva.
- Create: `apps/api/src/conta/calcular-conta.ts`, `apps/api/src/conta/calcular-conta.spec.ts`
- Create: `packages/opcoes/src/conta.ts`, `packages/opcoes/src/conta.test.ts`; Modify: `packages/opcoes/src/index.ts`
- Modify: `apps/api/src/rodadas/rodadas.types.ts`, `apps/api/src/rodadas/rodadas-equipe.service.ts` (`mesa()`)
- Create: `apps/api/scripts/dev-conta.mjs`. Script `"dev:conta"` em `apps/api/package.json`.
- Modify: `apps/api/prisma/seed.ts`, `apps/api/test/seed.e2e-spec.ts`, `apps/api/test/rodadas.e2e-spec.ts`

**Interfaces:**
- Produces, schema:
  - `Restaurante`:
    - `servicoHabilitado Boolean @default(true)`
    - `servicoPadrao Boolean @default(true)`
    - `couvertHabilitado Boolean @default(false)`
    - `couvertPadrao Boolean @default(false)`
    - `couvertCentavos Int @default(0)`
  - `enum FormaPagamento { CARTAO PIX DINHEIRO }`
  - `SessaoMesa`:
    - `formaPagamento FormaPagamento?`
    - `subtotalCentavos Int?`
    - `servicoCentavos Int?`
    - `couvertCentavos Int?`
    - `pessoas Int?`
    - `totalCentavos Int?`
    - `fechadaPorId String?`
- Produces, cálculo (com a mesma assinatura nos dois lados):
  ```ts
  type EntradaConta = { subtotalCentavos: number; servico: boolean; couvert: boolean; pessoas: number; couvertUnitarioCentavos: number }
  type Conta = { subtotalCentavos: number; servicoCentavos: number; couvertCentavos: number; totalCentavos: number }
  calcularConta(e: EntradaConta): Conta
  ```
  - `servicoCentavos = servico ? Math.round(subtotalCentavos / 10) : 0`
  - `couvertCentavos = couvert ? couvertUnitarioCentavos * pessoas : 0`
- Produces, `MesaEquipe` ganha dois campos:
  - `aberta: boolean` (há sessão `ABERTA`);
  - `conta: { servico: { habilitado: boolean; padrao: boolean }; couvert: { habilitado: boolean; padrao: boolean; valorCentavos: number } }`.

- [ ] **Step 1: Testes do cálculo, iguais em `calcular-conta.spec.ts` e `conta.test.ts`.**
  - `5990`, com serviço e sem couvert → `{ subtotalCentavos: 5990, servicoCentavos: 599, couvertCentavos: 0, totalCentavos: 6589 }`.
  - `12345`, com serviço e couvert, 3 pessoas a 1500 → serviço `1235` (arredonda 1234,5 para cima), couvert `4500`, total `18080`.
  - `0`, com serviço e couvert, 2 pessoas a 1500 → `{ 0, 0, 3000, 3000 }`.
  - Sem serviço e sem couvert → `total === subtotal`.
  - Couvert desmarcado com `pessoas: 4` → `couvertCentavos: 0`.
- [ ] **Step 2: Rodar e ver falhar.**
  - Comando: `pnpm --filter api test -- calcular-conta` e `cd packages/opcoes && pnpm test < /dev/null`.
  - Esperado: FAIL, módulo inexistente.
- [ ] **Step 3: Implementar os dois `calcularConta`.** Exportar no `index.ts` do pacote: `export { calcularConta, type Conta, type EntradaConta } from './conta'`.
- [ ] **Step 4: Teste e2e em `rodadas.e2e-spec.ts`: `mesa da equipe traz aberta e a configuração da conta`.**
  - Com o seed de teste, `GET /equipe/mesas/:token` de uma mesa sem sessão → `aberta: false`.
  - Depois de um pedido → `aberta: true` e `conta` igual a `{ servico: { habilitado: true, padrao: true }, couvert: { habilitado: true, padrao: false, valorCentavos: 1500 } }`.
  - Para isso, o seed passa a gravar `couvertHabilitado: true, couvertCentavos: 1500` no restaurante demo.
- [ ] **Step 5: Ver falhar e implementar.**
  - Schema, migração, seed e `mesa()`: ler a config do restaurante na mesma consulta que já busca `janelaCancelamentoSegundos`.
  - `scripts/dev-conta.mjs`: idempotente; grava as mesmas cinco configurações da demo no restaurante `demo`. Imprimir o que ficou.
  - Atualizar `seed.e2e-spec.ts` se ele confere campos do restaurante.
- [ ] **Step 6: Suíte da API, do pacote e do tsc.**
  - Comando: `pnpm --filter api test`, `pnpm --filter api test:e2e`, `cd packages/opcoes && pnpm test < /dev/null`, `npx tsc --noEmit` (api).
  - Esperado: tudo verde.
- [ ] **Step 7: Aplicar no dev e commitar.**
  - Rodar `pnpm --filter api exec prisma migrate deploy` e depois `pnpm --filter api dev:conta` (duas vezes, para ver que é idempotente).
  - Commit: `feat(api): bill settings, shared bill calculation, bill config on table view`.

### Task 2: Fechar a conta (API)

**Files:**
- Create: `apps/api/src/conta/conta.service.ts`, `conta.controller.ts`, `conta.module.ts`; Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/sessao-mesa/sessao-mesa.service.ts` (`exigirParticipante`)
- Test: `apps/api/test/conta.e2e-spec.ts`

**Interfaces:**
- Consumes: `calcularConta` (Task 1), `travarMesa(tx, mesaId)`, `exigirSalao(usuario)`, `lerCorpo(schema, corpo)`, `EventosService.publicar`, `TempoRealService.paraSessao/paraEquipe`.
- Produces: `POST /equipe/mesas/:token/fechar`.
  - Corpo:
    ```ts
    { servico: boolean; couvert: boolean; pessoas?: number /* inteiro 1..99, obrigatório se couvert */; formaPagamento: 'CARTAO' | 'PIX' | 'DINHEIRO'; totalCentavos: number /* o que o garçom viu */ }
    ```
  - Resposta 200: `{ mesa: { numero: number }, totalCentavos: number, formaPagamento }`.
- Produces: o cliente da sessão recebe o socket `conta-fechada` (`{}`).
- Produces: `exigirParticipante` responde 403 `{ mensagem: 'Conta fechada', codigo: 'CONTA_FECHADA' }` quando:
  - o dispositivo não está na sessão aberta;
  - e esteve numa sessão `FECHADA` desta mesa com `fechadaEm` nas últimas **2 horas**.
  - Fora disso, continua `FORA_DA_SESSAO`. O `POST /entrar` não muda: entrar de propósito abre ou entra na sessão nova.

- [ ] **Step 1: Testes em `conta.e2e-spec.ts`.** Use os helpers de `rodadas.e2e-spec.ts`/`producao.e2e-spec.ts` (pedido e confirmação pela Ana).
  - `fecha a conta: grava a sessão, o evento ContaFechada e libera a mesa`.
    - Mesa com uma rodada confirmada de `5990`. A Ana fecha com `{ servico: true, couvert: true, pessoas: 2, formaPagamento: 'PIX', totalCentavos: 9589 }`.
    - Esperado: 200 com `{ mesa: { numero }, totalCentavos: 9589, formaPagamento: 'PIX' }`.
    - A sessão fica `FECHADA`, com `fechadaEm` preenchido, `subtotalCentavos 5990`, `servicoCentavos 599`, `couvertCentavos 3000`, `pessoas 2` e `fechadaPorId` igual ao id da Ana.
    - Existe 1 `Evento` `ContaFechada` com `dados.sessaoId`.
    - `GET /equipe/mesas` mostra a mesa com `aberta: false`.
  - `conta mudou entre ver e fechar → 409 e nada fecha`: `totalCentavos` diferente do calculado → 409 `A conta mudou. Confira o novo total.`, e a sessão continua `ABERTA`.
  - `segundo fechamento → 409 Esta mesa já foi fechada`. O total de eventos `ContaFechada` continua 1.
  - `rodada aguardando bloqueia o fechamento`: 409 `Confirme ou recuse os pedidos pendentes antes de fechar`.
  - `corpo inválido → 422`. Rodar com `it.each`:
    - `pessoas: 0` com couvert;
    - `pessoas: 1.5`;
    - couvert sem `pessoas`;
    - `formaPagamento: 'CHEQUE'`.
  - `opção desligada no restaurante → 422`: com `servicoHabilitado` falso, `servico: true` responde 422 `Serviço ou couvert desligado neste restaurante`.
  - `cozinha não fecha conta (403)` e `mesa de outro restaurante → 404`.
  - `fechar resolve os chamados da sessão e limpa o carrinho`: os chamados `ABERTO`/`LIDO` viram `RESOLVIDO`, e não sobra `ItemCarrinho` da sessão.
  - `celular da sessão fechada recebe CONTA_FECHADA; entrar de novo abre sessão nova que pede confirmação`.
    - Depois de fechar, `GET /publico/mesas/:token/rodadas` com o cookie antigo responde 403 `{ codigo: 'CONTA_FECHADA' }`.
    - `POST /entrar` com o mesmo cookie responde 2xx. Enviar uma rodada depois disso → `status: 'AGUARDANDO_GARCOM'`, porque a sessão nova não tem garçom.
  - `fechar avisa a sessão (conta-fechada) e a equipe`: com `jest.spyOn` em `TempoRealService`, conferir que `paraSessao` foi chamado com o id da sessão e `'conta-fechada'`, e `paraEquipe` com `'mesa-mudou'`.
  - `itens ainda na produção continuam na fila da cozinha depois de fechar`: rodada confirmada sem marcar pronto, fechar, depois `GET /equipe/producao?estacao=Cozinha` (como Dani) ainda traz a rodada.
- [ ] **Step 2: Rodar e ver falhar.**
  - Comando: `pnpm --filter api test:e2e -- conta`.
  - Esperado: FAIL, rota 404.
- [ ] **Step 3: Implementar `ContaService.fechar(token: string, corpo: unknown, usuario: UsuarioToken)`.**
  - **Ordem:**
    1. `exigirSalao`;
    2. `lerCorpo` com zod, usando `superRefine` para exigir `pessoas` quando há couvert;
    3. buscar a mesa `{ token, restauranteId }` (404 `Mesa não encontrada`);
    4. abrir a transação e chamar `travarMesa`;
    5. buscar a sessão `ABERTA`. Se não houver: 409 `Esta mesa já foi fechada`;
    6. checar se há rodada `AGUARDANDO_GARCOM` (409);
    7. checar a config do restaurante (422);
    8. calcular o subtotal pelas rodadas `CONFIRMADA` (`somarConfirmadas`) e chamar `calcularConta`;
    9. comparar com `totalCentavos` (409);
    10. atualizar a sessão;
    11. passar os chamados da sessão com status `ABERTO`/`LIDO` para `RESOLVIDO`;
    12. apagar o `ItemCarrinho` da sessão.
  - **Depois do commit:**
    - publicar `ContaFechada` com `{ sessaoId, mesaId, mesaNumero, garcomId, fechadaPorId, formaPagamento, subtotalCentavos, servicoCentavos, couvertCentavos, pessoas, totalCentavos }`;
    - mandar `paraSessao(sessaoId, 'conta-fechada', {})`;
    - mandar `paraEquipe(restauranteId, 'mesa-mudou', {})` e `paraEquipe(restauranteId, 'chamados-mudaram', {})`.
  - **Quem pode fechar:** qualquer garçom ou o dono, não só o responsável (ver Decisões).
  - **`exigirParticipante`:** acrescentar a checagem de `CONTA_FECHADA` antes de lançar `FORA_DA_SESSAO`.
- [ ] **Step 4: Rodar e ver passar.**
  - Comando: `pnpm --filter api test:e2e`, `pnpm --filter api test`, `npx tsc --noEmit`, `pnpm --filter api lint`.
  - Esperado: verde.
- [ ] **Step 5: Commit** `feat(api): close the table bill with payment method, service and cover charge`.

### Task 3: Tela da conta no app do garçom

**Files:**
- Create: `apps/equipe/src/mesa/ContaMesa.tsx`, `apps/equipe/src/mesa/ContaMesa.test.tsx`
- Modify:
  - `apps/equipe/src/mesa/TelaMesa.tsx`
  - `apps/equipe/src/api/tipos.ts`
  - `apps/equipe/src/api/equipe.ts`
  - `apps/equipe/src/test/fixtures.ts`
  - `apps/equipe/src/test/api-falsa.ts`
  - `apps/equipe/src/estilo/app.css`

**Interfaces:**
- Consumes: `calcularConta`, `formatarReais` de `@cardapio/opcoes`; rota `POST /api/equipe/mesas/:token/fechar` (Task 2); `MesaEquipe.aberta`/`conta` (Task 1).
- Produces:
  - `fecharConta(token: string, corpo: { servico: boolean; couvert: boolean; pessoas?: number; formaPagamento: FormaPagamento; totalCentavos: number }): Promise<{ mesa: { numero: number }; totalCentavos: number }>`
  - `type FormaPagamento = 'CARTAO' | 'PIX' | 'DINHEIRO'`.

**Tela:**
- **Botão de abrir:** `TelaMesa` mostra `Fechar conta` (`botao--secundario`) quando `mesa.aberta`. Tocar abre `ContaMesa` no lugar das rodadas. `Voltar` volta para a mesa.
- **Conteúdo do `ContaMesa`** (`section aria-label="Conta da mesa"`):
  - linha `Itens` com o subtotal (`totalConfirmadoCentavos`);
  - checkbox `Serviço (10%)` com o valor, só se `conta.servico.habilitado`, marcado conforme `padrao`;
  - checkbox `Couvert`, só se habilitado. Quando marcado, aparece `Pessoas` com `−`/`+`, número inicial 1, mínimo 1, máximo 99, e a linha `Couvert (n × R$ 15,00)`;
  - linha `Total`, em destaque;
  - grupo `Forma de pagamento` com botões `Cartão`, `Pix` e `Dinheiro` (`aria-pressed`);
  - botão `Fechar conta · R$ X` (`botao--sucesso`), desligado sem forma de pagamento.
- **Rodada `AGUARDANDO_GARCOM` na mesa:** o botão de fechar fica desligado, com o aviso `Confirme ou recuse os pedidos pendentes antes de fechar`.
- **Sucesso:** `navegar('/')`.
- **Erro:** usa o `agir` da `TelaMesa`, que mostra o aviso com a mensagem do servidor e recarrega a mesa. O total na tela se recalcula com os dados novos.

- [ ] **Step 1: Testes em `ContaMesa.test.tsx`, rodando pela `TelaMesa`.**
  - **Fixture:** `mesa7` ganha `aberta: true`, `totalConfirmadoCentavos: 2380` e `conta: { servico: { habilitado: true, padrao: true }, couvert: { habilitado: true, padrao: false, valorCentavos: 1500 } }`. A rodada pendente `r1` deve ser removida ou marcada `CONFIRMADA` nos testes que fecham.
  - `Fechar conta mostra itens, 10% marcado e total`: `Itens` é `reais(2380)`, `Serviço (10%)` está marcado com `reais(238)`, e `Total` é `reais(2618)`.
  - `desmarcar serviço e marcar couvert com 3 pessoas recalcula`: dois toques em `+` deixam `Pessoas` em 3, e o `Total` passa a `reais(2380 + 4500)`.
  - `sem forma o botão fica desligado; com Pix fecha e volta ao início`.
    - O corpo do POST é `{ servico: true, couvert: false, formaPagamento: 'PIX', totalCentavos: 2618 }` (`pessoas` ausente ou ignorado).
    - Depois, `window.location.pathname === '/'`.
  - `restaurante sem couvert não mostra a opção`: com `couvert.habilitado: false`, não existe checkbox `Couvert`.
  - `rodada aguardando bloqueia o fechamento`: com `r1` pendente, o aviso aparece e o botão de fechar fica desligado.
  - `conta mudou (409) avisa`: com `api.uma` 409 `A conta mudou. Confira o novo total.`, `findByRole('status')` mostra o texto.
  - `mesa sem sessão não mostra Fechar conta`.
- [ ] **Step 2: Rodar e ver falhar.**
  - Comando: `cd apps/equipe && pnpm test < /dev/null`.
  - Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - Tipos, `fecharConta`, a rota falsa `POST /api/equipe/mesas/:token/fechar` e o `ContaMesa`.
  - Na rota falsa: a mesa fica `aberta: false`, `rodadas: []`. Ela responde 409 se o `totalCentavos` não bate com o `calcularConta` dos dados falsos.
  - CSS: linhas com valor à direita (`tabular-nums`) e total em `--t-xl`.
- [ ] **Step 4: Verificar.**
  - Comando: `pnpm test < /dev/null`, `pnpm exec tsc -b`, `pnpm lint`, `pnpm build` (equipe).
  - Esperado: verde.
- [ ] **Step 5: Commit** `feat(equipe): bill screen with service, cover charge and payment method`.

### Task 4: Cliente vê "Conta fechada", script do garçom, README e fumaça

**Files:**
- Create: `apps/cliente/src/pedido/ContaFechada.tsx`, `apps/cliente/src/pedido/ContaFechada.test.tsx`
- Modify:
  - `apps/cliente/src/api/mesa.ts` (+ `mesa.test.ts`)
  - `apps/cliente/src/tempo-real/useMesaAoVivo.ts`
  - `apps/cliente/src/pedido/useRodadas.ts`
  - `apps/cliente/src/lista/ListaCardapio.tsx`
  - `apps/cliente/src/lista/lista.css`
  - `apps/cliente/src/test/api-falsa.ts`
- Modify: `apps/api/scripts/garcom.mjs`, `README.md`

**Interfaces:**
- Consumes:
  - o socket `conta-fechada` e o 403 `CONTA_FECHADA` (Task 2);
  - `entrarNaMesa(token)`, que já existe.
- Produces:
  - `class ErroContaFechada extends Error`. `naMesa` **não** tenta entrar de novo quando recebe esse erro.
  - `AoMudarMesa.contaFechada: () => void`.
  - `useRodadas(token, aoFechar?: () => void)`. Quando a busca falha com `ErroContaFechada`, chama `aoFechar`.

**Tela** (`ContaFechada`, `role="dialog"`, `aria-label="Conta fechada"`, tela cheia por cima da lista):
- título `Conta fechada`;
- texto `Obrigado pela visita!`;
- link `⭐ Avalie no Google`, com classe `avaliar avaliar--destaque`, só se houver URL;
- botão `Voltar ao cardápio`: chama `entrarNaMesa(token)`, fecha a tela e recarrega o carrinho e as rodadas;
- depois de fechar a tela, o `Avalie no Google` da lista mantém `avaliar--destaque` até recarregar a página.

- [ ] **Step 1: Testes.**
  - `mesa.test.ts`: `CONTA_FECHADA não tenta entrar de novo` (`buscarRodadas` rejeita com `ErroContaFechada`, e não há chamada a `/entrar`).
  - `ContaFechada.test.tsx`, rodando pela `ListaCardapio`:
    - `conta-fechada pelo socket mostra Obrigado e Avalie no Google em destaque`: o diálogo `Conta fechada` aparece, e o link `Avalie no Google` tem a classe `avaliar--destaque`.
    - `voltando com a conta já fechada (403 CONTA_FECHADA) mostra a tela sem entrar sozinho`: a API falsa responde `CONTA_FECHADA` nas rodadas; ao reconectar o socket, o diálogo aparece, e o número de `POST /entrar` não aumenta.
    - `Voltar ao cardápio entra de novo e fecha a tela`: 1 `POST /entrar` a mais, e o diálogo some.
- [ ] **Step 2: Rodar e ver falhar.**
  - Comando: `cd apps/cliente && pnpm test < /dev/null`.
  - Esperado: FAIL.
- [ ] **Step 3: Implementar** nos arquivos listados. A API falsa ganha a opção de responder `CONTA_FECHADA` e o socket falso ganha o evento `conta-fechada`.
- [ ] **Step 4: Script do garçom.** `pnpm garcom fechar 7 pix [--couvert N] [--sem-servico]`.
  - Lê a mesa, calcula o total com as mesmas regras (servico/couvert da `conta` da resposta), faz o POST e imprime `Mesa 7 fechada · R$ X · Pix`.
  - Atualizar o comentário de uso e a lista de comandos.
- [ ] **Step 5: README.** Seção `Conta e fechamento`:
  - rodar `pnpm --filter api dev:conta` uma vez;
  - na mesa: `Fechar conta`, marcar 10% e couvert, escolher a forma e fechar;
  - o cliente vê "Conta fechada";
  - `pnpm garcom fechar 7 pix` faz o mesmo pelo terminal.
- [ ] **Step 6: Todas as suítes.**
  - Rodar `opcoes`, `cliente` e `equipe` (test, tsc, lint) e a API (unit, e2e, tsc, lint). Rodar também os builds do cliente e da equipe.
  - Esperado: verde.
- [ ] **Step 7: Fumaça pelos proxies, na mesa 11.**
  1. O cliente pede.
  2. A Ana confirma.
  3. `GET /equipe/mesas/:token` traz `aberta: true` e a `conta`.
  4. Fechar com total errado → 409.
  5. Fechar com total certo e Pix → 200.
  6. O socket do cliente recebe `conta-fechada`.
  7. `GET rodadas` com o cookie antigo → 403 `CONTA_FECHADA`.
  8. `POST /entrar` → sessão nova, cujo primeiro pedido fica `AGUARDANDO_GARCOM`.
- [ ] **Step 8: Commit** `feat: customer sees closed bill with review prompt; waiter script and docs`.

---

## Decisões (do executor, para o dono revisar)

- **Quem fecha:** qualquer garçom em turno ou o dono, não só o responsável. Cobre o colega que saiu. O cancelamento da 3A continua restrito ao responsável.
- **Itens ainda na cozinha** ao fechar continuam na fila. A conta já os inclui: rodada confirmada é cobrada.
- **Fechar com rodada aguardando** é bloqueado: o garçom precisa decidir se cobra ou não.
- **Mesa sem nada consumido** pode ser fechada (total 0, ou só couvert). Serve para liberar uma mesa aberta por engano.
- **Celular antigo:** recebe `CONTA_FECHADA` por **2 horas** depois do fechamento. Depois disso volta ao comportamento atual (`FORA_DA_SESSAO`, que entra sozinho). Recarregar a página entra numa sessão nova na hora, como já acontece hoje.
- **Arredondamento dos 10%:** `Math.round` em centavos (meio centavo para cima).
- **Valores da demo** (via `dev:conta` e seed):
  - 10% habilitado e marcado por padrão;
  - couvert habilitado, desmarcado por padrão, R$ 15,00 por pessoa.

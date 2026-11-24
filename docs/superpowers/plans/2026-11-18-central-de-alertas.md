# Central de alertas do gerente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao dono uma tela ao vivo que lista o que está errado agora (alertas por gravidade), mostra a carga por garçom e por estação e dá o contexto do dia.

**Architecture:** Regras puras e testáveis em `apps/api/src/paineis/` (alertas, carga, estabilização) alimentadas por um `CentralService` que lê o Prisma. Um agendador a cada 30 s recalcula por restaurante e emite `central-mudou` quando o conjunto de alertas muda. O app da equipe busca `GET equipe/painel/central` e refaz a busca a cada aviso.

**Tech Stack:** NestJS 11, Prisma 6, zod, socket.io, Jest + supertest (API); React + Vite + Vitest (equipe); SVG simples para o gráfico (sem biblioteca nova).

**Spec:** `docs/superpowers/specs/2026-11-18-central-de-alertas-design.md` (branch `central-alertas`, base `origin/deploy`).

## Global Constraints

- Só `DONO` acessa (`exigirDono` de `../equipe/papel`); tudo filtrado por `restauranteId`.
- Dia de serviço: `inicioDoDiaDeServico` de `../comum/dia-servico`; horas no fuso `America/Sao_Paulo`.
- Nada de ranking nem cor vermelha para desempenho de pessoa. Cartões de garçom em ordem alfabética, barra de carga neutra (azul), faixas de texto "tranquilo", "cheio", "sobrecarregado".
- Estabilização: o alerta só aparece depois de 1 min com a condição ativa; some sozinho quando ela acaba.
- Verificação do servidor a cada 30 s (`CENTRAL_VERIFICAR_MS`, 0 desliga, como `CHAMADOS_VERIFICAR_MS`); sem `@nestjs/schedule`.
- Sem push, sem dependência nova.
- Padrões: mesa sem atendimento 10 min; chamado sem resposta 3 min; atrasado = esperado × 1,10; esquecido = esperado × 2 (`FOLGA_NO_TEMPO`, `FATOR_ESQUECIDO` de `pedidos-estacao.ts`); fila acumulada 6 pedidos; carga alta = média dos colegas + 3 (`MESAS_A_MAIS`); sem pausa = `Restaurante.horasSemPausa` (padrão 4); movimento = 1,4 × média, mínimo 10 pedidos na última hora e 1 semana de histórico com movimento naquela hora.
- Chamado pendente = `ABERTO` atribuído ao garçom; `paraTodos` não conta na carga de ninguém.
- Carga do garçom = mesas abertas + chamados pendentes × 2; carga da estação = NA_FILA + EM_PREPARO.
- Testes e e2e seguem o padrão existente (`apps/api/test/paineis.e2e-spec.ts`, `apps/equipe/src/paineis/PainelEquipe.test.tsx` com `criarApiFalsa`).

## Review Focus

- Restaurante sem garçom em turno e sem mesas: mostra "Tudo certo agora", não erro. (Task 1, Task 5)
- Um só garçom em turno: sem alerta de carga alta e sem divisão por zero na média. (Task 1)
- Condição que dura menos de 1 min (ou some e volta): não pisca na lista. (Task 3)
- Dados de outro restaurante nunca entram nos alertas nem nos limites. (Task 4, Task 5)
- Tipo de alerta desligado nos limites: não aparece mesmo com a condição ativa. (Task 1, Task 4)

---

## Mapa de arquivos

API (`apps/api`):
- Criar `src/paineis/alertas.ts` — tipos e `calcularAlertas` (regras puras).
- Criar `src/paineis/carga.ts` — `cargaGarcom`, `cargaEstacao`, `faixaDeCarga`.
- Criar `src/paineis/estado-alertas.ts` — `EstadoAlertas` (estabilização, duração, mudança).
- Criar `src/paineis/limites.service.ts`, `src/paineis/central.controller.ts`, `src/paineis/central.service.ts`, `src/paineis/central.agendador.ts`, `src/paineis/central.types.ts`.
- Modificar `prisma/schema.prisma` (+ migration), `src/paineis/paineis.module.ts`, `src/config/env.ts`, `.env.test.example`.
- Testes: `src/paineis/*.spec.ts`, `test/central.e2e-spec.ts`.

Equipe (`apps/equipe/src`):
- Modificar `api/tipos.ts`, `api/paineis.ts`, `tempo-real/useEquipeAoVivo.ts`, `rotas.ts`, `App.tsx`, `paineis/PainelEquipe.tsx` (atalho).
- Criar `central/Central.tsx`, `central/ListaAlertas.tsx`, `central/CartoesCarga.tsx`, `central/LinhaPorHora.tsx`, `central/TelaLimites.tsx`, `central/TelaGarcomCentral.tsx`, `estilo/central.css` e os testes ao lado.

---

### Task 1: Regras de alerta (puras)

**Files:**
- Create: `apps/api/src/paineis/alertas.ts`
- Test: `apps/api/src/paineis/alertas.spec.ts`

**Interfaces:**
- Produces:
  - `type TipoAlerta = 'MESA_SEM_ATENDIMENTO' | 'CHAMADO_SEM_RESPOSTA' | 'PEDIDO_ATRASADO' | 'PEDIDO_ESQUECIDO' | 'FILA_ACUMULADA' | 'GARCOM_CARGA_ALTA' | 'GARCOM_SEM_PAUSA' | 'ESTOQUE_CRITICO' | 'MOVIMENTO_ALTO' | 'SEM_GARCOM' | 'CHAMADO_PARA_TODOS'`
  - `type Gravidade = 'ALTA' | 'MEDIA' | 'BAIXA'`
  - `type AlertaBruto = { chave: string; tipo: TipoAlerta; gravidade: Gravidade; titulo: string; detalhe: string; desde: Date | null; link: string | null }` (`chave` = `tipo:alvo`, estável entre execuções; `desde` null = usar a primeira vez vista).
  - `type LimitesAlerta = Record<TipoAlerta, { ativo: boolean; valor: number | null }>` e `LIMITES_PADRAO: LimitesAlerta` (valores da seção Global Constraints; unidades: minutos, pedidos, percentual 140).
  - `type EntradaAlertas` com: `agora: Date`; `mesas: { sessaoId: string; numero: number; ultimaAtividade: Date; temProblemaMaior: boolean }[]` (só sessões ABERTAS); `chamados: { id: string; mesa: number; garcomId: string | null; paraTodos: boolean; criadoEm: Date }[]` (só ABERTO); `pedidos: { rodadaId: string; estacao: string; mesa: number; confirmadaEm: Date; esperadoMin: number }[]` (ainda não prontos); `filas: { estacao: string; naFila: number }[]`; `garcons: { id: string; nome: string; emTurnoDesde: Date | null; mesasAbertas: number; chamadosPendentes: number }[]` (em turno); `horasSemPausa: number`; `estoqueCritico: { id: string; nome: string; zerado: boolean }[]`; `movimento: { ultimaHora: number; mediaHistorica: number | null; semanasComDados: number }`; `mesasAbertasTotal: number`.
  - `calcularAlertas(entrada: EntradaAlertas, limites: LimitesAlerta): AlertaBruto[]`

- [ ] **Step 1: Escrever os testes que falham** (`alertas.spec.ts`), um `it` por linha, com fábrica `entrada(parcial)` de entrada vazia:
  - mesa com `ultimaAtividade` 11 min atrás gera `MESA_SEM_ATENDIMENTO` MEDIA com `chave === 'MESA_SEM_ATENDIMENTO:<sessaoId>'`; 9 min não gera; `temProblemaMaior: true` não gera.
  - chamado ABERTO há 4 min gera `CHAMADO_SEM_RESPOSTA` ALTA; há 2 min não; `paraTodos: true` há 4 min gera `CHAMADO_PARA_TODOS` e não `CHAMADO_SEM_RESPOSTA`.
  - pedido com esperado 10 min: 12 min gera `PEDIDO_ATRASADO` MEDIA; 21 min gera só `PEDIDO_ESQUECIDO` ALTA (substitui o atrasado); 10 min não gera.
  - fila: `naFila: 7` gera `FILA_ACUMULADA` MEDIA; 6 não.
  - garçons em turno [Ana 9 mesas, Bruno 2, Caio 2]: Ana gera `GARCOM_CARGA_ALTA` com link `/central/garcom/<id>`; com um só garçom não gera nada (Review Focus).
  - `emTurnoDesde` há 5 h com `horasSemPausa: 4` gera `GARCOM_SEM_PAUSA` BAIXA.
  - `estoqueCritico` não vazio gera `ESTOQUE_CRITICO` MEDIA, ALTA se algum `zerado`.
  - `mesasAbertasTotal: 3` e `garcons: []` gera `SEM_GARCOM` ALTA; com `mesasAbertasTotal: 0` não gera (Review Focus).
  - movimento: `ultimaHora: 15, mediaHistorica: 10, semanasComDados: 2` gera `MOVIMENTO_ALTO` BAIXA; `ultimaHora: 9` não; `semanasComDados: 0` não; `mediaHistorica: null` não.
  - com `limites.PEDIDO_ESQUECIDO.ativo = false` o pedido esquecido não gera alerta (nem cai para atrasado) (Review Focus).
  - entrada toda vazia devolve `[]`.
- [ ] **Step 2: Rodar e ver falhar:** `pnpm --filter api exec jest src/paineis/alertas.spec.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** `alertas.ts` com as assinaturas acima. Importar `FOLGA_NO_TEMPO`, `FATOR_ESQUECIDO` de `./pedidos-estacao` e `MESAS_A_MAIS` de `./cuidado`. Uma função pequena por tipo, juntadas em `calcularAlertas`. Textos dizem a situação, sem julgar a pessoa (ex.: `Ana: 9 mesas abertas, 2 chamados pendentes`).
- [ ] **Step 4: Rodar e ver passar:** mesmo comando → PASS.
- [ ] **Step 5: Commit:** `git add apps/api/src/paineis/alertas.ts apps/api/src/paineis/alertas.spec.ts && git commit -m "feat(api): pure alert rules for the manager center"`

### Task 2: Carga por garçom e por estação (puras)

**Files:**
- Create: `apps/api/src/paineis/carga.ts`
- Test: `apps/api/src/paineis/carga.spec.ts`

**Interfaces:**
- Produces:
  - `type FaixaCarga = 'TRANQUILO' | 'CHEIO' | 'SOBRECARREGADO'`
  - `cargaGarcom(g: { mesasAbertas: number; chamadosPendentes: number }): number` (mesas + chamados × 2)
  - `cargaEstacao(e: { naFila: number; emPreparo: number }): number`
  - `faixaDeCarga(carga: number, cargasColegas: number[]): FaixaCarga` — com um só garçom (lista vazia) usa tetos fixos (≤ 4 tranquilo, ≤ 8 cheio, acima sobrecarregado); com colegas: `SOBRECARREGADO` se carga > média dos colegas + 3 e ≥ 8, `CHEIO` se > média dos colegas, senão `TRANQUILO`.

- [ ] **Step 1: Testes que falham:** `cargaGarcom({mesasAbertas: 3, chamadosPendentes: 2}) === 7`; `cargaEstacao({naFila: 4, emPreparo: 2}) === 6`; `faixaDeCarga(3, []) === 'TRANQUILO'`, `faixaDeCarga(9, []) === 'SOBRECARREGADO'`; `faixaDeCarga(12, [4, 4]) === 'SOBRECARREGADO'`; `faixaDeCarga(6, [4, 4]) === 'CHEIO'`; `faixaDeCarga(3, [4, 4]) === 'TRANQUILO'`.
- [ ] **Step 2: Rodar:** `pnpm --filter api exec jest src/paineis/carga.spec.ts` → FAIL.
- [ ] **Step 3: Implementar** `carga.ts` conforme as assinaturas.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit:** `feat(api): load measures for waiters and stations`

### Task 3: Estabilização e mudança do conjunto de alertas

**Files:**
- Create: `apps/api/src/paineis/estado-alertas.ts`
- Test: `apps/api/src/paineis/estado-alertas.spec.ts`

**Interfaces:**
- Consumes: `AlertaBruto`, `Gravidade` de `./alertas`.
- Produces:
  - `type Alerta = Omit<AlertaBruto, 'desde'> & { desde: Date }`
  - `class EstadoAlertas { atualizar(restauranteId: string, candidatos: AlertaBruto[], agora: Date): { visiveis: Alerta[]; mudou: boolean } }` — estado em memória por restaurante: mapa `chave → primeira vez vista`. Um candidato só é visível quando `agora − primeiraVez ≥ 60 000 ms`; `desde` = `candidato.desde ?? primeiraVez`. Chaves ausentes nesta chamada são esquecidas (a condição acabou, a contagem recomeça se voltar). Ordenação: gravidade (ALTA, MEDIA, BAIXA) e depois `desde` mais antigo primeiro. `mudou` = a assinatura (lista ordenada de `chave:gravidade` dos visíveis) difere da retornada na chamada anterior do mesmo restaurante (a primeira chamada com lista vazia não conta como mudança).

- [ ] **Step 1: Testes que falham:** (a) candidato visto agora não é visível, 59 s depois ainda não, 60 s depois sim; (b) candidato que some em t+30 s e volta em t+90 s recomeça a contagem (Review Focus); (c) ordem ALTA antes de MEDIA e, na mesma gravidade, o mais antigo primeiro; (d) `desde` usa o do candidato quando existe; (e) `mudou` é true quando um alerta entra e false na chamada seguinte igual; (f) restaurantes diferentes têm estados separados.
- [ ] **Step 2: Rodar:** `pnpm --filter api exec jest src/paineis/estado-alertas.spec.ts` → FAIL.
- [ ] **Step 3: Implementar** a classe com `Map<string, { vistos: Map<string, Date>; assinatura: string }>`.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit:** `feat(api): alert stabilization and change detection`

### Task 4: Limites configuráveis (schema, serviço e rotas)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (modelo `LimiteAlerta`), criar migration `apps/api/prisma/migrations/20261118120000_limites_alerta/migration.sql` com `pnpm --filter api exec prisma migrate dev --name limites_alerta`
- Create: `apps/api/src/paineis/limites.service.ts`, `apps/api/src/paineis/central.controller.ts` (rotas de limites, o restante vem na Task 5)
- Modify: `apps/api/src/paineis/paineis.module.ts`
- Test: `apps/api/test/central.e2e-spec.ts` (bloco "limites")

**Interfaces:**
- Consumes: `LIMITES_PADRAO`, `LimitesAlerta`, `TipoAlerta` de `./alertas`.
- Produces:
  - Modelo `LimiteAlerta { id, restauranteId (→ Restaurante, onDelete Cascade), tipo String, ativo Boolean @default(true), valor Int?, @@unique([restauranteId, tipo]) }`.
  - `LimitesService.ler(restauranteId: string): Promise<LimitesAlerta>` (padrões mesclados com as linhas gravadas) e `LimitesService.gravar(usuario: UsuarioToken, tipo: TipoAlerta, v: { ativo: boolean; valor: number | null }): Promise<LimitesAlerta>`.
  - `GET /equipe/painel/central/limites` → `LimitesAlerta`; `PUT /equipe/painel/central/limites/:tipo` com corpo `{ ativo: boolean, valor: number|null }` (zod; `valor` só aceito nos tipos que têm valor configurável: MESA_SEM_ATENDIMENTO 1–60, CHAMADO_SEM_RESPOSTA 1–30, FILA_ACUMULADA 1–50, MOVIMENTO_ALTO 110–300; nos demais, `valor` deve ser null; 400 caso contrário). Tipo desconhecido → 404. Só dono (`exigirDono`).

- [ ] **Step 1: Testes e2e que falham** (`central.e2e-spec.ts`, padrão de `paineis.e2e-spec.ts`): garçom recebe 403 em GET e PUT; dono sem gravações recebe os padrões; PUT `MESA_SEM_ATENDIMENTO {ativo: true, valor: 15}` é lido de volta; PUT `PEDIDO_ESQUECIDO {ativo: false, valor: null}` é lido de volta; PUT `PEDIDO_ESQUECIDO` com `valor: 5` → 400; PUT `MESA_SEM_ATENDIMENTO` com `valor: 0` → 400; PUT `FOO` → 404; limite gravado por um restaurante não aparece para o dono de outro (cria `outro-central` como o spec de painéis faz, e limpa no `afterAll`) (Review Focus).
- [ ] **Step 2: Rodar:** `pnpm --filter api test:e2e -- central` → FAIL.
- [ ] **Step 3: Implementar** schema, migration, serviço (upsert por `restauranteId_tipo`) e as duas rotas; registrar serviço e controller no módulo.
- [ ] **Step 4: Rodar** o mesmo comando → PASS.
- [ ] **Step 5: Commit:** `feat(api): configurable alert limits`

### Task 5: `CentralService` e `GET equipe/painel/central`

**Files:**
- Create: `apps/api/src/paineis/central.service.ts`, `apps/api/src/paineis/central.types.ts`
- Modify: `apps/api/src/paineis/central.controller.ts`, `apps/api/src/paineis/paineis.module.ts`
- Test: `apps/api/test/central.e2e-spec.ts` (blocos "central")

**Interfaces:**
- Consumes: `calcularAlertas`/`EntradaAlertas` (Task 1), `cargaGarcom`/`cargaEstacao`/`faixaDeCarga` (Task 2), `EstadoAlertas` (Task 3), `LimitesService.ler` (Task 4), `inicioDoDiaDeServico`.
- Produces:
  - `type CentralResposta = { verificadoEm: string; alertas: { chave: string; tipo: TipoAlerta; gravidade: Gravidade; titulo: string; detalhe: string; desde: string; link: string | null }[]; cargaGarcons: { id: string; nome: string; mesasAbertas: number; chamadosPendentes: number; carga: number; faixa: FaixaCarga; emTurnoDesde: string | null }[]; cargaEstacoes: { estacao: string; naFila: number; emPreparo: number; carga: number; maisAntigoMin: number | null }[]; grupo: { garconsEmTurno: number; cargaTotal: number; cargaMedia: number | null }; contexto: { faturamentoCentavos: number; ticketMedioCentavos: number | null; porHora: { hora: number; hoje: number; media: number }[] } }` (em `central.types.ts`).
  - `CentralService.calcular(restauranteId: string, agora: Date): Promise<{ resposta: CentralResposta; mudou: boolean }>` (lê o Prisma, monta `EntradaAlertas`, aplica `EstadoAlertas.atualizar`) e `CentralService.central(usuario: UsuarioToken, agora = new Date()): Promise<CentralResposta>` (`exigirDono` + `calcular`).
  - `GET /equipe/painel/central` → `CentralResposta`.
  - `contexto.porHora`: horas 0–23 com movimento hoje ou na média; `media` = rodadas confirmadas por hora nas 4 semanas anteriores, no mesmo dia da semana, divididas pelo nº de semanas com dados.
  - Fontes: sessões ABERTAS (`ultimaAtividade` = maior entre `abertaEm`, último `Rodada.criadoEm` e último `Chamado.resolvidoEm`; `temProblemaMaior` quando a mesa tem pedido esquecido ou chamado ABERTO além do limite); chamados ABERTO; `ItemRodada` não PRONTO/ENTREGUE de rodadas CONFIRMADAS (agrupar por rodada+estação como `medirPedidos`, usando o maior `tempoEsperadoMin`); itens NA_FILA/EM_PREPARO por estação; garçons com `emTurno`; `ItemEstoque` com `nivel` ACABANDO ou ZERADO; `Restaurante.horasSemPausa`.

- [ ] **Step 1: Testes e2e que falham:** garçom → 403; restaurante recém-semeado sem atividade → `alertas: []`, `cargaGarcons` vazio ou com carga 0, status 200 (Review Focus); mesa aberta há mais de 10 min (ajustar `abertaEm` direto no banco) aparece só depois de a condição valer 60 s: usar `CentralService.calcular(restauranteId, agora)` com `agora` injetado em duas chamadas (t0 e t0+61 s) e checar que só a segunda lista o alerta; chamado ABERTO com `criadoEm` há 4 min gera `CHAMADO_SEM_RESPOSTA`; item NA_FILA 7 vezes numa estação gera `FILA_ACUMULADA`; `cargaGarcons` traz Ana com `mesasAbertas` e `carga` coerentes e ordem alfabética; dados de `outro-central` não aparecem; tipo desligado via limites some; `contexto.faturamentoCentavos` soma contas fechadas do dia de serviço.
- [ ] **Step 2: Rodar:** `pnpm --filter api test:e2e -- central` → FAIL.
- [ ] **Step 3: Implementar** `CentralService` seguindo o padrão de consultas de `paineis.service.ts` (helpers `confirmadasEm`, `fechadasEm`, `periodoDe('DIA', agora)`); reaproveitar ou extrair para função compartilhada o que já existe em vez de duplicar. O controller expõe a rota.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit:** `feat(api): central endpoint with alerts, load and context`

### Task 6: Verificação periódica e aviso em tempo real

**Files:**
- Create: `apps/api/src/paineis/central.agendador.ts`
- Modify: `apps/api/src/paineis/paineis.module.ts`, `apps/api/src/config/env.ts`, `apps/api/.env.test.example`
- Test: `apps/api/test/central.e2e-spec.ts` (bloco "tempo real"), padrão de `tempo-real.e2e-spec.ts`

**Interfaces:**
- Consumes: `CentralService.calcular`, `TempoRealService.paraEquipe(restauranteId, evento, dados)`.
- Produces: `CentralAgendador` (mesmo molde de `ChamadosAgendador`: `OnModuleInit`/`OnModuleDestroy`, sem sobreposição) com método público `verificar(agora: Date): Promise<void>` que percorre os restaurantes e emite `paraEquipe(restauranteId, 'central-mudou', {})` só quando `mudou`. Variável `CENTRAL_VERIFICAR_MS` (padrão 30000; 0 no `.env.test.example`).

- [ ] **Step 1: Teste e2e que falha:** com um socket de equipe conectado (helper do spec de tempo real), chamar `agendador.verificar(t0)` e `verificar(t0 + 61 s)` com um chamado ABERTO velho no banco; o socket recebe `central-mudou` exatamente uma vez e uma terceira chamada igual não emite outra.
- [ ] **Step 2: Rodar:** `pnpm --filter api test:e2e -- central` → FAIL.
- [ ] **Step 3: Implementar** o agendador, o campo no schema de env (`z.coerce.number()` seguindo `CHAMADOS_VERIFICAR_MS`) e registrar como provider.
- [ ] **Step 4: Rodar** → PASS; rodar também `pnpm --filter api test` para checar o spec de env.
- [ ] **Step 5: Commit:** `feat(api): periodic check emits central-mudou`

### Task 7: Detalhe do garçom na API

**Files:**
- Modify: `apps/api/src/paineis/central.service.ts`, `apps/api/src/paineis/central.controller.ts`, `apps/api/src/paineis/central.types.ts`
- Test: `apps/api/test/central.e2e-spec.ts` (bloco "detalhe")

**Interfaces:**
- Produces: `type DetalheGarcom = { id: string; nome: string; emTurno: boolean; emTurnoDesde: string | null; horasEmTurno: number | null; mesasAbertas: { numero: number; abertaEm: string }[]; chamadosPendentes: { id: string; mesa: number; criadoEm: string }[] }`; `CentralService.detalheGarcom(usuario: UsuarioToken, id: string): Promise<DetalheGarcom>`; `GET /equipe/painel/central/garcom/:id` (dono; 404 se o garçom não for do restaurante do dono, mesmo se existir em outro).

- [ ] **Step 1: Testes e2e que falham:** dono lê o detalhe da Ana com mesas abertas atribuídas a ela; id de garçom de `outro-central` → 404 (Review Focus); garçom → 403.
- [ ] **Step 2: Rodar** `pnpm --filter api test:e2e -- central` → FAIL.
- [ ] **Step 3: Implementar** serviço e rota.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit:** `feat(api): waiter detail for the central`

### Task 8: Base do app da equipe (tipos, API, evento, rotas)

**Files:**
- Modify: `apps/equipe/src/api/tipos.ts`, `apps/equipe/src/api/paineis.ts`, `apps/equipe/src/tempo-real/useEquipeAoVivo.ts`, `apps/equipe/src/rotas.ts`, `apps/equipe/src/rotas.test.ts`, `apps/equipe/src/test/api-falsa.ts`, `apps/equipe/src/test/socket-falso.ts` (se precisar)
- Test: `apps/equipe/src/rotas.test.ts`, `apps/equipe/src/tempo-real/` (teste do evento, no padrão do existente)

**Interfaces:**
- Produces:
  - Em `tipos.ts`: espelhos de `CentralResposta`, `DetalheGarcom`, `LimitesAlerta`, `TipoAlerta`, `Gravidade`, `FaixaCarga`.
  - Em `paineis.ts`: `buscarCentral(): Promise<CentralResposta>`, `buscarDetalheGarcom(id: string): Promise<DetalheGarcom>`, `buscarLimites(): Promise<LimitesAlerta>`, `salvarLimite(tipo: TipoAlerta, v: { ativo: boolean; valor: number | null }): Promise<object>`.
  - `AoMudarEquipe.central?: () => void`, acionado por `central-mudou` e por `connect`/`aoVoltar` (como `painel`).
  - Rotas: `{ nome: 'central' }` em `/`, `{ nome: 'dia' }` em `/dia` (o painel atual), `{ nome: 'central-garcom'; id }` em `/central/garcom/:id`, `{ nome: 'limites' }` em `/limites`. `voltaDe`: `central-garcom` e `limites` → `/`; `dia` → `/`.

- [ ] **Step 1: Testes que falham:** `lerRota('/dia')`, `/limites`, `/central/garcom/abc` (com id codificado) e `/` (continua `inicio`; o App decide mostrar a Central para o dono); `voltaDe` dessas rotas; hook chama `central` ao receber `central-mudou`.
- [ ] **Step 2: Rodar:** `pnpm --filter equipe exec vitest run src/rotas.test.ts` → FAIL.
- [ ] **Step 3: Implementar** tipos, chamadas, evento e rotas; estender `api-falsa` com os quatro endpoints novos e um `centralVazia()` (alertas `[]`).
- [ ] **Step 4: Rodar** `pnpm --filter equipe exec vitest run` → PASS.
- [ ] **Step 5: Commit:** `feat(equipe): central routes, calls and live event`

### Task 9: Tela da Central (alertas, carga e contexto)

**Files:**
- Create: `apps/equipe/src/central/Central.tsx`, `ListaAlertas.tsx`, `CartoesCarga.tsx`, `LinhaPorHora.tsx`, `apps/equipe/src/estilo/central.css`
- Modify: `apps/equipe/src/App.tsx` (dono em `inicio` vê `Central`; `dia` vê `PainelEquipe`), `apps/equipe/src/paineis/PainelEquipe.tsx` (remover o bloco de atalhos duplicado só se a Central o assumir; manter o conteúdo como "Detalhes do dia")
- Test: `Central.test.tsx`, `ListaAlertas.test.tsx`, `CartoesCarga.test.tsx`, `LinhaPorHora.test.tsx` na mesma pasta

**Interfaces:**
- Consumes: `buscarCentral`, `useMaisRecente`, `useEquipeAoVivo({ central })`, `CentralResposta`.
- Produces: `Central` (default export, sem props) com, de cima para baixo: `ListaAlertas` (`{ alertas: CentralResposta['alertas'] }`), `CartoesCarga` (`{ garcons, estacoes, grupo }`, garçom clicável → `navegar('/central/garcom/<id>')`), bloco de contexto (faturamento, ticket) com `LinhaPorHora` (`{ pontos: { hora: number; hoje: number; media: number }[] }`, SVG com duas linhas: hoje cheia, média tracejada, rótulos de hora e `aria-label`) e atalhos (Estoque, Metas, Tempo de preparo, Limites, "Detalhes do dia").

- [ ] **Step 1: Testes que falham:** `ListaAlertas` sem alertas mostra "Tudo certo agora"; com três alertas mostra na ordem recebida, o de gravidade ALTA com o rótulo "Urgente" (texto, não só cor), e o `link` vira botão que chama `navegar`. `CartoesCarga` renderiza garçons na ordem recebida, a faixa em texto ("sobrecarregado") e nenhuma classe de cor vermelha; clicar na Ana navega para `/central/garcom/u-ana`. `LinhaPorHora` desenha duas `<polyline>` e não quebra com lista vazia (mostra "Sem movimento ainda"). `Central` busca ao montar, mostra o erro de rede com `role="alert"` mantendo os dados anteriores, e busca de novo quando o socket falso emite `central-mudou`.
- [ ] **Step 2: Rodar:** `pnpm --filter equipe exec vitest run src/central` → FAIL.
- [ ] **Step 3: Implementar** as quatro telas e o CSS (mobile primeiro, tokens de `estilo/tokens.css`, barra de carga em azul neutro); ligar no `App.tsx`.
- [ ] **Step 4: Rodar** `pnpm --filter equipe exec vitest run` e `pnpm --filter equipe exec tsc -b` → PASS, sem erros de tipo; `pnpm --filter equipe lint` limpo.
- [ ] **Step 5: Commit:** `feat(equipe): central screen with alerts, load and context`

### Task 10: Tela de limites e detalhe do garçom

**Files:**
- Create: `apps/equipe/src/central/TelaLimites.tsx`, `apps/equipe/src/central/TelaGarcomCentral.tsx` e os testes ao lado
- Modify: `apps/equipe/src/App.tsx` (rotas `limites` e `central-garcom` para o dono)

**Interfaces:**
- Consumes: `buscarLimites`, `salvarLimite`, `buscarDetalheGarcom`, `DetalheGarcom`, `LimitesAlerta`.
- Produces: `TelaLimites` (sem props; uma linha por tipo com nome em português, interruptor ligado/desligado e, nos 4 tipos que têm valor, um campo numérico com a unidade; salva ao mudar e mostra erro com `role="alert"`); `TelaGarcomCentral` (`{ id: string }`; mesas abertas, chamados pendentes e horas em turno, sem ranking nem comparação com colegas).

- [ ] **Step 1: Testes que falham:** `TelaLimites` mostra os 11 tipos; desligar "Pedido esquecido" chama `salvarLimite('PEDIDO_ESQUECIDO', { ativo: false, valor: null })`; mudar mesa sem atendimento para 15 chama `salvarLimite('MESA_SEM_ATENDIMENTO', { ativo: true, valor: 15 })`; erro do servidor aparece. `TelaGarcomCentral` lista as mesas e os chamados do detalhe e mostra "Nenhum chamado pendente" quando vazio.
- [ ] **Step 2: Rodar:** `pnpm --filter equipe exec vitest run src/central` → FAIL.
- [ ] **Step 3: Implementar** as duas telas e ligar no `App.tsx`.
- [ ] **Step 4: Rodar** `pnpm --filter equipe exec vitest run`, `pnpm --filter equipe exec tsc -b` e `pnpm --filter equipe lint` → verdes.
- [ ] **Step 5: Commit:** `feat(equipe): alert limits and waiter detail screens`

### Task 11: Dados de demonstração e verificação final

**Files:**
- Modify: o script de demo dos painéis da `deploy` (commit "dashboards demo data"; localizar com `git log --stat --grep "demo data"`) para criar uma situação com mesa parada, chamado velho e fila.
- Modify: `README.md` (seção curta "Central do gerente").

- [ ] **Step 1:** Rodar a suíte inteira: `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter equipe exec vitest run`, `pnpm --filter cliente exec vitest run`. Esperado: tudo verde.
- [ ] **Step 2:** Subir API e equipe, logar como `dono@demo.com`, carregar os dados de demo e conferir na tela que os alertas aparecem após ~1 min, somem quando a condição acaba e que `central-mudou` atualiza sem recarregar a página (viewport de celular).
- [ ] **Step 3: Commit:** `docs: central do gerente demo data and readme`

# Etapa 2 — Pedido chega ao garçom: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O cliente monta um carrinho compartilhado da mesa, envia o pedido e chama o atendente. O garçom certo recebe na hora (com app aberto ou por Push), vai à mesa, confirma ou edita a rodada, e o cliente vê o status.

**Architecture:**
- A API NestJS ganha os módulos `equipe`, `sessao-mesa`, `carrinho`, `rodadas`, `chamados`, `tempo-real`, `eventos` e `push`. Os serviços publicam eventos de domínio pelo `@nestjs/event-emitter`. Um listener persiste esses eventos e outro manda pelo socket.io e pelo Web Push.
- O app `cliente` troca o carrinho local pelo carrinho da sessão (REST + socket).
- O app novo `apps/equipe` (React + Vite, PWA) traz login, turno, chamados, mesas e a tela da mesa.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL 17, `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io-client`, `@nestjs/jwt`, `cookie-parser`, `@nestjs/event-emitter`, `web-push`. React 19 + Vite 8 + Vitest nos dois fronts.

**Spec:** `docs/superpowers/specs/2026-11-04-cardapio-digital-design.md` (§4 Pedido e chamado, §5, §6 App do garçom, §7, §8 linha da Etapa 2, §8.1)

## Global Constraints

- Dinheiro sempre em **centavos inteiros**. Toda tabela de negócio tem `restauranteId`, e toda consulta filtra por ele.
- **Valor da conta nunca diferente do preço que o cliente viu**: o servidor recalcula o preço ao adicionar, e o item da rodada **congela** o preço com as opções no envio (§5.8, §8.1).
- **Um cliente nunca vê nem mexe na sessão de outra mesa**: tudo do cliente passa pelo cookie `dispositivo` e pelo participante da sessão aberta da mesa. Id de outra sessão ou de outro restaurante → 404, nunca o dado.
- **O garçom não perde chamado**: sem leitura em `janelaChamadoSegundos` (padrão **60**) o chamado vai para o próximo garçom. Depois da 2ª tentativa vai para todos os garçons em turno e o dono. Chamado nunca some até ser resolvido (§8.1).
- Escolha do garçom (§5.2), nesta ordem: responsável da mesa → em turno e livre → quem atendeu menos mesas no turno → empate: mais tempo sem receber chamado.
- Confirmação presencial: a 1ª rodada da mesa **e** a 1ª rodada de cada dispositivo novo (§8.1). As demais rodadas ficam `CONFIRMADA` direto. A cozinha recebe na Etapa 3.
- O garçom não altera preço de item: só quantidade, remove ou adiciona.
- Cliente sem login: identificado pelo token da mesa e pelo cookie `dispositivo` (§7). Equipe: JWT em cookie httpOnly `equipe`.
- Estilo do código: o padrão atual de cada app (api: prettier + eslint; fronts: oxlint, sem ponto e vírgula, aspas simples). Textos da interface em pt-BR.
- Fora desta etapa: cozinha/estações, conta e fechamento, janela de cancelamento (Etapa 3); exceções por valor ou prato "exige confirmação" e leitor de QR no app (Etapa 4).

## Review Focus

1. **Dois celulares mexendo no mesmo carrinho ao mesmo tempo:** os dois veem o mesmo carrinho em segundos. Remover item que o outro já removeu devolve o carrinho atual, não erro.
2. **Toque duplo:** em "Enviar pedido" gera uma rodada só. Confirmar duas vezes dá 409, sem duplicar evento.
3. **Ninguém em turno quando o cliente chama:** o chamado é criado para todos (`paraTodos`), o cliente vê sucesso e o chamado aparece assim que alguém entra em turno.
4. **Prato que esgotou entre adicionar e enviar:** o envio é recusado com o nome do prato e o item sai do carrinho. Nada é cobrado em silêncio.
5. **Celular que dormiu ou perdeu a conexão:** ao reconectar o socket, ou ao voltar a aba para frente, cliente e garçom buscam o estado de novo e não ficam com tela velha.

---

### Task 1: Modelo de dados e equipe da demo

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/test/seed.e2e-spec.ts`
- Create: migração `apps/api/prisma/migrations/<data>_etapa_2/`, `apps/api/src/equipe/senha.ts`, `apps/api/src/equipe/senha.spec.ts`

**Interfaces:**
- Produces (Prisma):
  - `Restaurante.janelaChamadoSegundos Int @default(60)`
  - `enum PapelUsuario { DONO GARCOM COZINHA }`
  - `Usuario { id, restauranteId, nome, email @unique, senhaHash, papel, emTurno Boolean @default(false), emTurnoDesde DateTime?, ultimoChamadoEm DateTime?, criadoEm }`
  - `enum StatusSessao { ABERTA FECHADA }`
  - `SessaoMesa { id, restauranteId, mesaId, status, garcomId String?, garcomDesde DateTime?, abertaEm, fechadaEm DateTime? }`
  - `DispositivoSessao { id, restauranteId, sessaoId, dispositivoId, confirmado Boolean @default(false), entrouEm; @@unique([sessaoId, dispositivoId]) }`
  - `ItemCarrinho { id, restauranteId, sessaoId, pratoId, selecao Json, observacao String @default(""), quantidade Int, adicionadoPor String, criadoEm }`
  - `enum StatusRodada { AGUARDANDO_GARCOM CONFIRMADA CANCELADA }`
  - `Rodada { id, restauranteId, sessaoId, dispositivoId, status, totalCentavos, criadoEm, confirmadaEm DateTime?, confirmadaPorId String? }`
  - `ItemRodada { id, restauranteId, rodadaId, pratoId, nome, resumoOpcoes, selecao Json, observacao, quantidade, precoUnitarioCentavos }`
  - `enum TipoChamado { ATENDENTE CONFIRMAR_RODADA }`, `enum StatusChamado { ABERTO LIDO RESOLVIDO }`
  - `Chamado { id, restauranteId, mesaId, sessaoId, tipo, rodadaId String?, garcomId String?, status, tentativas Int @default(1), paraTodos Boolean @default(false), criadoEm, atribuidoEm, lidoEm DateTime?, resolvidoEm DateTime? }`
  - `Evento { id, restauranteId, tipo String, dados Json, criadoEm }`
  - `InscricaoPush { id, restauranteId, usuarioId, endpoint @unique, p256dh, auth, criadoEm }`
- Produces (senha.ts): `hashSenha(senha: string): Promise<string>` e `conferirSenha(senha: string, hash: string): Promise<boolean>`. Usam `scrypt` do `node:crypto` com sal aleatório de 16 bytes, no formato `scrypt$<sal b64>$<hash b64>`, e comparam com `timingSafeEqual`.

- [ ] **Step 1: Testes que falham**
  - `senha.spec.ts`:
    - `confere a senha certa e recusa a errada`: `conferirSenha('demo1234', h)` → true; `'outra'` → false.
    - `dois hashes da mesma senha são diferentes`.
    - `hash malformado devolve false, sem exceção`.
  - `seed.e2e-spec.ts` › `cria a equipe da demo com senha`:
    - 3 usuários: `ana@demo.com` e `bruno@demo.com` (GARCOM) e `dono@demo.com` (DONO);
    - `conferirSenha('demo1234', ana.senhaHash)` → true;
    - rodar o seed 2× mantém 3 usuários.
- [ ] **Step 2:** `pnpm --filter api test -- senha` e `pnpm --filter api test:e2e`. Expected: FAIL (módulo e tabela inexistentes).
- [ ] **Step 3:** Escrever schema e `senha.ts`. Rodar `pnpm --filter api exec prisma migrate dev --name etapa_2`, que só adiciona tabelas e colunas. No seed, os usuários entram por upsert pelo e-mail. As tabelas novas que dependem da mesa são limpas antes de recriar o catálogo, junto com o que o seed já limpa hoje.
- [ ] **Step 4:** Mesmos comandos. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): data model for table sessions, orders, calls and staff`.

### Task 2: Login da equipe e turno

**Files:**
- Create: `apps/api/src/equipe/{equipe.module,auth.controller,auth.service,equipe.guard,usuario-atual.decorator}.ts`, `apps/api/test/equipe-auth.e2e-spec.ts`, `apps/api/test/app-teste.ts`
- Modify: `apps/api/src/config/env.ts` (+`JWT_SEGREDO` com no mínimo 32 caracteres, `CHAMADOS_VERIFICAR_MS` coerce int com padrão 5000), `apps/api/src/main.ts` (`cookie-parser`), `.env.example`, `.env.test.example`, `app.module.ts`

**Interfaces:**
- Produces:
  - `POST /equipe/login {email, senha}`:
    - sucesso → 200 `UsuarioEquipe` e cookie `equipe` (JWT `{sub, restauranteId, papel}`, httpOnly, sameSite lax, 12 h);
    - falha → 401 `{mensagem:'E-mail ou senha inválidos'}`.
  - `POST /equipe/logout` → 204 e apaga o cookie. `GET /equipe/eu` → 200 `UsuarioEquipe`, ou 401.
  - `PATCH /equipe/turno {emTurno: boolean}` → 200 `UsuarioEquipe`. Ao ligar, grava `emTurnoDesde = agora`.
  - `type UsuarioEquipe = { id: string; nome: string; papel: 'DONO'|'GARCOM'|'COZINHA'; emTurno: boolean }`
  - `EquipeGuard` (preenche `req.usuario: UsuarioToken = { id, restauranteId, papel }`) e o decorator `@UsuarioAtual()`.
  - `test/app-teste.ts`: `criarAppTeste(): Promise<{ app, prisma, restauranteId }>`. Roda `seedDemo`, aplica `cookie-parser` como o `main.ts` e serve para todos os e2e daqui em diante. Também `loginComo(app, email): Promise<string>`, que devolve o header `Cookie`.

- [ ] **Step 1: Testes (e2e) que falham**
  - `login certo devolve o usuário e o cookie httpOnly`: o body bate com `{nome:'Ana', papel:'GARCOM', emTurno:false}`, e `set-cookie` contém `equipe=` e `HttpOnly`.
  - `senha errada e e-mail inexistente dão a mesma resposta 401`.
  - `GET /equipe/eu sem cookie → 401; com cookie → Ana`.
  - `cookie adulterado → 401`.
  - `PATCH /equipe/turno liga e grava emTurnoDesde`.
  - `logout apaga o cookie`.
- [ ] **Step 2:** `pnpm --filter api test:e2e -- equipe-auth`. Expected: FAIL 404.
- [ ] **Step 3:** Implementar. A mensagem 401 tem de ser idêntica nos dois casos.
- [ ] **Step 4:** Expected: PASS. Rodar também a suíte e2e inteira.
- [ ] **Step 5:** Commit `feat(api): staff login with httpOnly cookie and shift toggle`.

### Task 3: Sessão de mesa e dispositivo

**Files:**
- Create: `apps/api/src/sessao-mesa/{sessao-mesa.module,sessao-mesa.service,sessao-mesa.controller,participante.ts}.ts`, `apps/api/test/sessao-mesa.e2e-spec.ts`

**Interfaces:**
- Consumes: `buscarPorToken`, ou a mesma regra de formato de token do `cardapio-publico.service.ts`. Mover `FORMATO_TOKEN` para `apps/api/src/mesas/token.ts` e exportar.
- Produces:
  - `POST /publico/mesas/:token/entrar`:
    - se não houver cookie `dispositivo`, cria um (UUID, httpOnly, 1 ano);
    - entra na sessão `ABERTA` da mesa, ou cria uma, numa transação. Nunca deixa duas abertas na mesma mesa;
    - resposta 200 `{ dispositivoConfirmado: boolean }`.
  - `SessaoMesaService.exigirParticipante(token: string, dispositivoId: string | undefined): Promise<Participante>`:
    - `type Participante = { restauranteId; mesa: {id, numero}; sessao: {id, garcomId: string|null}; dispositivo: {id, dispositivoId, confirmado} }`;
    - token inexistente → 404 `{mensagem:'Mesa não encontrada'}`;
    - sem cookie, ou dispositivo fora da sessão aberta → 403 `{mensagem:'Entre na mesa novamente', codigo:'FORA_DA_SESSAO'}`.

- [ ] **Step 1: Testes que falham**
  - `primeiro acesso cria a sessão e o cookie dispositivo`.
  - `segundo celular na mesma mesa entra na mesma sessão`: 2 agentes supertest e 1 sessão no banco com 2 dispositivos.
  - `reabrir com o mesmo cookie não duplica o dispositivo`.
  - `entradas simultâneas não criam duas sessões abertas`: `Promise.all` de 5 `entrar`, e `count(status ABERTA) === 1`.
  - `exigirParticipante recusa cookie de outra mesa com 403`.
  - `token inexistente → 404`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar. A unicidade da sessão aberta vem de um `pg_advisory_xact_lock(hashtext(mesaId))` dentro da transação, porque o Prisma não faz índice único parcial. Registrar como Ruling no ledger.
- [ ] **Step 4:** Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): table session joined by device cookie`.

### Task 4: Preço no servidor e carrinho compartilhado

**Files:**
- Create: `apps/api/src/pedidos/preco.ts` + `preco.spec.ts`, `apps/api/src/carrinho/{carrinho.module,carrinho.service,carrinho.controller}.ts`, `apps/api/test/carrinho.e2e-spec.ts`

**Interfaces:**
- Produces (`preco.ts`):
  - `precoUnitario(prato: PratoComGrupos, selecao: Selecao): number`
  - `validarSelecao(prato, selecao): string[]`
  - `resumirOpcoes(prato, selecao): string`
  - Portam fielmente as regras de `apps/cliente/src/preco/preco.ts`, nos mesmos casos (UNICA com preço define a base, R$ 0 não define; SABORES cobra o mais caro; MULTIPLA soma; promo vale só se `0 < promo < preço`). Os tipos `PratoComGrupos` e `Selecao` ficam nesse arquivo.
- Produces (REST; todos exigem participante e devolvem `CarrinhoPublico`):
  - `GET /publico/mesas/:token/carrinho`
  - `POST /publico/mesas/:token/carrinho/itens {pratoId, selecao, observacao, quantidade}` → 201
  - `PATCH /publico/mesas/:token/carrinho/itens/:id {quantidade}`, onde 0 remove
  - `DELETE /publico/mesas/:token/carrinho/itens/:id` (item que não existe mais → 200 com o carrinho atual)
  - `type CarrinhoPublico = { itens: ItemCarrinhoPublico[]; totalCentavos: number }`
  - `ItemCarrinhoPublico` tem os mesmos campos do `ItemCarrinho` do cliente: `id, pratoId, nome, resumoOpcoes, selecao, observacao, quantidade, precoUnitarioCentavos`. O preço é calculado na leitura, com valores atuais.
  - Validação → 422 `{mensagem}`:
    - prato de outro restaurante ou inexistente → 'Prato não encontrado';
    - esgotado → '<nome> está esgotado';
    - seleção inválida → primeira mensagem de `validarSelecao`;
    - quantidade fora de 1..20;
    - observação com mais de 140 caracteres.
  - `CarrinhoService.mudou(sessaoId)`: hook vazio aqui. A Task 5 liga ao socket.

- [ ] **Step 1: Testes que falham**
  - `preco.spec.ts` replica os casos de `apps/cliente/src/preco/preco.test.ts` (pizza G + meio a meio com Quatro Queijos + borda = 8990+1000+1200).
  - e2e:
    - `dois celulares veem o mesmo carrinho`: A adiciona Mix, e o GET de B traz 1 item a 5990.
    - `preço vem do servidor, não do cliente`: um body com `precoUnitarioCentavos: 1` é ignorado.
    - `prato esgotado → 422 'Pastel de Carne Seca está esgotado'`.
    - `pizza sem tamanho → 422 'Escolha Tamanho'`.
    - `PATCH quantidade 0 remove`.
    - `DELETE de item já removido devolve 200 com o carrinho atual`.
    - `cookie de outra mesa → 403`.
    - `item de outra sessão → 404`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): shared table cart with server-side pricing`.

### Task 5: Tempo real e eventos persistidos

**Files:**
- Create: `apps/api/src/tempo-real/{tempo-real.module,tempo-real.gateway,tempo-real.service}.ts`, `apps/api/src/eventos/{eventos.module,eventos.service,eventos.types}.ts`, `apps/api/test/tempo-real.e2e-spec.ts`
- Modify: `carrinho.service.ts` (`mudou` emite)

**Interfaces:**
- Produces:
  - `EventosService.publicar(e: EventoDominio): Promise<void>`: grava em `Evento` e emite no `EventEmitter2` com o nome `e.tipo`.
  - `type EventoDominio = { restauranteId: string; tipo: 'ChamadoCriado'|'PedidoCriado'|'PedidoConfirmado'|'PedidoCancelado'; dados: Record<string, unknown> }`
  - Gateway socket.io no path padrão `/socket.io`:
    - na conexão, se o cookie `equipe` for válido, entra nas salas `equipe:<restauranteId>` e `garcom:<usuarioId>`;
    - mensagem do cliente `entrar-mesa {token}` → valida `dispositivo` com `exigirParticipante` e entra em `sessao:<id>`. Responde (ack) `{ok:true}` ou `{ok:false, mensagem}`.
  - `TempoRealService.paraSessao(sessaoId, evento, dados)`, `.paraGarcom(usuarioId, evento, dados)`, `.paraEquipe(restauranteId, evento, dados)`
  - Eventos enviados ao cliente:
    - `carrinho` (`CarrinhoPublico`);
    - `rodadas-mudaram` (`{}`);
    - `chamado-atendido` (`{}`, que a tela usa para o aviso).
  - Eventos enviados à equipe:
    - `chamados-mudaram` (`{}`);
    - `mesa-mudou` (`{token}`).
  - Ruling da etapa: o socket só **avisa**, e a tela busca o estado por REST. É mais simples e cobre a reconexão.

- [ ] **Step 1: Testes (e2e com `socket.io-client`, app ouvindo em porta 0) que falham**
  - `celular B recebe o carrinho quando A adiciona`.
  - `entrar-mesa com cookie de outra mesa recebe ok:false e não recebe eventos`.
  - `socket com cookie equipe entra na sala do garçom`: `paraGarcom` chega.
  - `publicar grava Evento com tipo e dados`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar. O socket.io aceita o cookie do handshake (`socket.handshake.headers.cookie`).
- [ ] **Step 4:** Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): realtime gateway and persisted domain events`.

### Task 6: Escolha do garçom, chamados e repasse

**Files:**
- Create: `apps/api/src/chamados/{escolher-garcom.ts,escolher-garcom.spec.ts,chamados.module.ts,chamados.service.ts,chamados.controller.ts,chamados-agendador.ts}`, `apps/api/test/chamados.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `escolherGarcom(candidatos: CandidatoGarcom[], responsavelId: string | null, excluir: string[]): string | null`
    - `type CandidatoGarcom = { id: string; mesasAbertas: number; mesasAtendidasNoTurno: number; ultimoChamadoEm: Date | null }`
    - Candidatos são só os garçons em turno.
    - Ordem de decisão: o responsável, se está entre os candidatos e não está excluído → livres (`mesasAbertas === 0`) → todos. Dentro de um grupo, desempata por menos `mesasAtendidasNoTurno` e depois por `ultimoChamadoEm` mais antigo (`null` = mais antigo).
  - `ChamadosService.abrir({restauranteId, mesaId, sessaoId, tipo, rodadaId?}): Promise<ChamadoEquipe>`:
    - escolhe o garçom; sem ninguém em turno, fica com `garcomId:null, paraTodos:true`;
    - grava `atribuidoEm`, atualiza `ultimoChamadoEm`, publica `ChamadoCriado` e avisa `chamados-mudaram`.
  - `ChamadosService.verificarVencidos(agora: Date): Promise<void>`, que olha os chamados `ABERTO` com `atribuidoEm + janela < agora` e `paraTodos=false`:
    - na 1ª tentativa, repassa excluindo o atual (`tentativas=2`, novo `atribuidoEm`);
    - na 2ª tentativa, ou se não houver outro garçom, marca `paraTodos=true`.
    - Cada repasse emite o evento interno `chamado.repassado` (`{chamadoId}`) no `EventEmitter2`, sem persistir; a Task 8 consome esse evento.
  - `chamados-agendador.ts`: `setInterval(verificarVencidos, CHAMADOS_VERIFICAR_MS)` no `onModuleInit`. Com `0` fica desligado (`.env.test`).
  - `POST /publico/mesas/:token/chamados`:
    - abre `ATENDENTE` → 201 `{ok:true}`;
    - se já existe um `ATENDENTE` não resolvido na sessão → 200 `{ok:true}`, sem criar outro.
  - `GET /equipe/chamados` → `ChamadoEquipe[]` não resolvidos com `garcomId = eu` **ou** `paraTodos`, do meu restaurante, mais antigos primeiro.
    - `type ChamadoEquipe = { id; tipo; status; mesa: {numero, token}; criadoEm; paraTodos: boolean; tentativas: number }`
  - `POST /equipe/chamados/:id/lido` → `LIDO`, o que para o repasse.
  - `POST /equipe/chamados/:id/resolver` → `RESOLVIDO`. Só vale para `ATENDENTE`; o `CONFIRMAR_RODADA` é resolvido na Task 7. Avisa a sessão com `chamado-atendido`.
  - Chamado de outro restaurante → 404.

- [ ] **Step 1: Testes que falham**
  - `escolher-garcom.spec.ts`:
    - `responsável em turno recebe`;
    - `responsável excluído cai para a regra`;
    - `livre ganha de ocupado`;
    - `ninguém livre: quem atendeu menos`;
    - `empate: quem está há mais tempo sem chamado (null primeiro)`;
    - `sem candidatos → null`.
  - e2e:
    - `cliente chama e o chamado vai para o garçom livre em turno` (Ana em turno, Bruno fora).
    - `sem ninguém em turno vira paraTodos e aparece quando alguém entra em turno`.
    - `chamar duas vezes não duplica`.
    - `verificarVencidos repassa depois de 60 s e depois manda para todos`. O `agora` é injetado: +61 s → Bruno; +122 s → `paraTodos`.
    - `chamado lido não é repassado`.
    - `garçom de outro restaurante recebe 404` (criar um 2º restaurante no teste).
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): waiter selection, calls and unanswered-call escalation`.

### Task 7: Rodadas — enviar, confirmar, editar, recusar

**Files:**
- Create: `apps/api/src/rodadas/{rodadas.module,rodadas.service,rodadas-publico.controller,rodadas-equipe.controller,mesas-equipe.controller}.ts`, `apps/api/test/rodadas.e2e-spec.ts`

**Interfaces:**
- Consumes: `exigirParticipante`, `precoUnitario`/`resumirOpcoes`, `ChamadosService.abrir`, `EventosService.publicar`, `TempoRealService`.
- Produces (cliente):
  - `POST /publico/mesas/:token/rodadas` → 201 `RodadaPublica`. Numa transação, congela o carrinho em `Rodada` + `ItemRodada` e esvazia o carrinho.
    - Carrinho vazio → 422 `{mensagem:'Carrinho vazio'}`.
    - Item esgotado → 409 `{mensagem:'<nome> esgotou', pratoIds}`. Remove esses itens do carrinho e não cria rodada.
    - `precisaConfirmar = !sessao.garcomId || !dispositivo.confirmado`:
      - se sim → `AGUARDANDO_GARCOM` e `ChamadosService.abrir({tipo:'CONFIRMAR_RODADA', rodadaId})`;
      - se não → `CONFIRMADA`, com `confirmadaEm=agora`, e avisa `paraGarcom(sessao.garcomId,'chamados-mudaram')`.
    - Publica `PedidoCriado`, e `PedidoConfirmado` quando for direto.
  - `GET /publico/mesas/:token/rodadas` → `{ rodadas: RodadaPublica[]; totalParcialCentavos }`, que soma só as `CONFIRMADA`.
    - `type RodadaPublica = { id; status: 'AGUARDANDO_GARCOM'|'CONFIRMADA'|'CANCELADA'; criadoEm; totalCentavos; itens: {nome, resumoOpcoes, observacao, quantidade, precoUnitarioCentavos}[] }`
- Produces (equipe; papel GARCOM ou DONO, mesmo restaurante):
  - `GET /equipe/mesas` → `{numero, token, aberta: boolean, garcomNome: string|null, pendentes: number}[]` por número.
  - `GET /equipe/mesas/:token` → `MesaEquipe = { mesa:{numero, token}; garcomNome: string|null; rodadas: RodadaEquipe[]; totalConfirmadoCentavos }`
    - `RodadaEquipe = RodadaPublica & { dispositivoNovo: boolean; itens: (… & {id, pratoId})[] }`
    - Sem sessão aberta → `rodadas: []`.
  - `PATCH /equipe/rodadas/:id/itens/:itemId {quantidade}`: 0 remove, recalcula o total. Só em `AGUARDANDO_GARCOM`, senão 409.
  - `POST /equipe/rodadas/:id/itens {pratoId, selecao, observacao, quantidade}` adiciona, com o preço calculado agora.
  - `POST /equipe/rodadas/:id/confirmar`:
    - `CONFIRMADA`, `confirmadaPorId`;
    - na sessão, `garcomId ??= eu` com `garcomDesde`;
    - o dispositivo da rodada passa a `confirmado=true`;
    - resolve o chamado `CONFIRMAR_RODADA`;
    - publica `PedidoConfirmado` e avisa `rodadas-mudaram`.
    - Rodada vazia → 422. Rodada que não está aguardando → 409.
  - `POST /equipe/rodadas/:id/recusar` → `CANCELADA`, resolve o chamado e publica `PedidoCancelado`.
  - Toda mudança avisa `mesa-mudou` à equipe.

- [ ] **Step 1: Testes que falham**
  - `primeira rodada aguarda garçom e abre chamado CONFIRMAR_RODADA para Ana`.
  - `rodada congela o preço`: depois de enviar, alterar `prato.precoCentavos` no banco não muda `itens[0].precoUnitarioCentavos`.
  - `envio duplo simultâneo gera uma rodada só` (`Promise.all` de 2 → um 201 e um 422).
  - `prato esgotado depois de adicionar → 409 e o item sai do carrinho`.
  - `garçom confirma: mesa ganha responsável e a rodada seguinte do mesmo celular entra CONFIRMADA`.
  - `celular novo na mesa aberta: 1ª rodada aguarda confirmação`.
  - `confirmar duas vezes → 409 e só um Evento PedidoConfirmado`.
  - `garçom remove item e o total é recalculado`.
  - `garçom não altera preço`: o PATCH com `precoUnitarioCentavos` é ignorado.
  - `recusar cancela e o cliente vê CANCELADA`.
  - `totalParcial soma só confirmadas`.
  - `garçom de outro restaurante → 404 em /equipe/mesas/:token e nas rodadas`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar. O envio trava a sessão com o mesmo advisory lock da Task 3, para o toque duplo.
- [ ] **Step 4:** Expected: PASS, mais a suíte e2e inteira.
- [ ] **Step 5:** Commit `feat(api): order rounds with waiter confirmation and editing`.

### Task 8: Web Push

**Files:**
- Create: `apps/api/src/push/{push.module,push.service,push.controller,push.listener}.ts`, `apps/api/src/push/push.service.spec.ts`, `apps/api/scripts/gerar-vapid.mjs`
- Modify: `env.ts` (`VAPID_PUBLICA`, `VAPID_PRIVADA`, `VAPID_CONTATO`, todos opcionais), `.env.example`, `apps/api/package.json` (script `vapid`)

**Interfaces:**
- Produces:
  - `GET /equipe/push/chave` → `{chavePublica: string|null}`
  - `POST /equipe/push/inscricoes {endpoint, keys:{p256dh, auth}}` → 204, com upsert pelo endpoint
  - `PushService.enviar(usuarioId, msg: {titulo, corpo, url}): Promise<void>`:
    - sem as chaves VAPID, não faz nada e loga uma vez;
    - resposta 404 ou 410 do serviço apaga a inscrição;
    - outro erro só é logado e nunca derruba a requisição.
  - Listener do `ChamadoCriado` e de repasse:
    - envia para o garçom atribuído, ou para todos em turno + DONO quando `paraTodos`;
    - título `Mesa <n>`;
    - corpo `Chamou o atendente` / `Novo pedido para confirmar`;
    - url `/mesa/<token>`.
  - `ChamadosService` publica também um evento interno `chamado.repassado` para o listener.

- [ ] **Step 1: Testes (unit, `web-push` mockado) que falham**
  - `envia para cada inscrição do usuário`.
  - `inscrição 410 é apagada`.
  - `erro 500 não lança`.
  - `sem VAPID não chama web-push`.
  - `chamado paraTodos notifica todos em turno e o dono`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar. `scripts/gerar-vapid.mjs` imprime as duas chaves no formato do `.env`.
- [ ] **Step 4:** Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): web push to waiters on new and escalated calls`.

### Task 9: Cliente — sessão, carrinho da mesa, pedido e chamado

**Files:**
- Create: `apps/cliente/src/api/mesa.ts` + `mesa.test.ts`, `apps/cliente/src/tempo-real/useMesaAoVivo.ts`, `apps/cliente/src/carrinho/useCarrinhoMesa.ts` + teste, `apps/cliente/src/pedido/PedidosSheet.tsx` + teste, `apps/cliente/src/equipe-url.ts` + teste
- Modify: `App.tsx`, `ListaCardapio.tsx`, `CarrinhoSheet.tsx`, `vite.config.ts` (proxy `/socket.io` com `ws:true`; `allowedHosts: ['.ts.net']`), testes atuais
- Delete: carrinho em `localStorage` (`carregarCarrinho`/`salvarCarrinho` e testes); o tipo `ItemCarrinho` fica.

**Interfaces:**
- Consumes: os endpoints das Tasks 3, 4, 6 e 7 e os eventos da Task 5.
- Produces:
  - `api/mesa.ts`, com `fetch` em `/api/...`:
    - `entrarNaMesa(token)`, `buscarCarrinho(token)`;
    - `adicionarAoCarrinho(token, item)`, `alterarQuantidade(token, id, q)`, `removerDoCarrinho(token, id)`;
    - `enviarPedido(token)`, `buscarRodadas(token)`, `chamarAtendente(token)`, `souEquipe()`.
    - Lança `ErroForaDaSessao` (403 com `codigo`), `ErroPedido(mensagem)` (409/422) e `ErroRede`.
  - `useMesaAoVivo(token, aoMudar: {carrinho, rodadas, atendido})`:
    - conecta o socket e emite `entrar-mesa`;
    - ao reconectar, ou no `visibilitychange` para visível, chama `aoMudar.carrinho()` e `aoMudar.rodadas()`.
  - `useCarrinhoMesa(token)` → `{ itens, total, quantidade, despachar, enviar, erro }`, com a mesma forma de `despachar` (`AcaoCarrinho`) usada hoje pelo `CarrinhoSheet` e pelo `SeletorOpcoes`. O estado vem sempre da resposta do servidor ou do evento `carrinho`.
  - `urlEquipe(loc: {protocol, hostname, port}): string`:
    - porta 5173 → `:5174`;
    - porta '' ou 443 → `:8443`;
    - `VITE_EQUIPE_URL` sobrepõe.
  - `App`:
    - `souEquipe()` verdadeiro → `location.replace(urlEquipe(...) + '/mesa/' + token)`;
    - senão `entrarNaMesa` e `buscarCardapio`;
    - `ErroForaDaSessao` em qualquer chamada → entra de novo e repete uma vez.
  - Textos:
    - botão do carrinho `Enviar pedido`;
    - após o envio, aviso `Pedido enviado! O garçom vai confirmar na mesa.`;
    - chamado: `Garçom chamado! Ele já está a caminho.`;
    - evento `chamado-atendido`: some o aviso de espera.
  - `PedidosSheet`:
    - título `Seus pedidos`;
    - status `Aguardando garçom` / `Confirmado` / `Cancelado`;
    - rodapé `Total parcial` com `totalParcialCentavos`;
    - aberto pelo botão `Pedidos` no topo, que aparece quando há rodadas.

- [ ] **Step 1: Testes que falham** (fetch e socket mockados, no padrão de `App.test.tsx`)
  - `entra na mesa antes de buscar o cardápio`.
  - `com sessão de equipe redireciona para o app do garçom` (`location.replace` espiado com `http://localhost:5174/mesa/token-da-mesa`).
  - `adicionar chama a API e mostra o carrinho devolvido`.
  - `evento carrinho de outro celular atualiza a contagem de Realizar pedido`.
  - `voltar a aba recarrega carrinho e pedidos`.
  - `Enviar pedido esvazia o carrinho e mostra o aviso`.
  - `409 de esgotado mostra a mensagem e recarrega o carrinho`.
  - `Chamar atendente mostra 'Garçom chamado! Ele já está a caminho.'`.
  - `PedidosSheet mostra status e total parcial`.
  - `fora da sessão entra de novo e repete a ação`.
  - `urlEquipe` cobre os 3 casos.
- [ ] **Step 2:** `pnpm --filter cliente test < /dev/null`. Expected: FAIL.
- [ ] **Step 3:** Implementar. Adicionar `socket.io-client`.
- [ ] **Step 4:** Expected: PASS, mais `tsc -b`, `lint` e `build` limpos.
- [ ] **Step 5:** Commit `feat(cliente): shared table cart, send order, call waiter, order status`.

### Task 10: App da equipe — base, login e turno

**Files:**
- Create: `apps/equipe/` (mesmo setup do `apps/cliente`: Vite, React, TS, Vitest, oxlint, `vite.config.ts` com porta **5174**, `host:true`, proxy `/api` e `/socket.io`, `allowedHosts:['.ts.net']`), `src/rotas.ts` + teste, `src/api/equipe.ts`, `src/login/Login.tsx` + teste, `src/inicio/Topo.tsx` + teste, `src/estilo/tokens.css` (copiado do cliente)
- Modify: `package.json` da raiz (`dev:equipe`)

**Interfaces:**
- Produces:
  - `rotas.ts`: `useRota(): Rota` e `navegar(caminho)` com `history.pushState` + `popstate`.
    - `type Rota = {nome:'login'} | {nome:'inicio'} | {nome:'mesas'} | {nome:'mesa', token: string}`
    - caminhos: `/login`, `/`, `/mesas`, `/mesa/:token`.
  - `api/equipe.ts`:
    - `login`, `logout`, `eu`, `mudarTurno`;
    - `buscarChamados`, `marcarLido`, `resolverChamado`;
    - `buscarMesas`, `buscarMesa`;
    - `alterarItem`, `adicionarItem`, `confirmarRodada`, `recusarRodada`;
    - `chavePush`, `inscreverPush`.
    - 401 → `ErroNaoAutenticado`, que manda para `/login`.
  - `Topo`: nome do usuário, interruptor `Em turno` (aria `switch`) e `Sair`.

- [ ] **Step 1: Testes que falham**
  - `rotas reconhece /mesa/abc`.
  - `login certo vai para o início`.
  - `login errado mostra 'E-mail ou senha inválidos'`.
  - `sem sessão abre o login`.
  - `interruptor Em turno chama a API e reflete o estado`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar. Visual escuro, no mesmo tema do cliente.
- [ ] **Step 4:** Expected: PASS, mais `tsc`, `lint` e `build`.
- [ ] **Step 5:** Commit `feat(equipe): staff app shell with login and shift toggle`.

### Task 11: App da equipe — chamados e mesas ao vivo

**Files:**
- Create: `apps/equipe/src/inicio/{Inicio,ListaChamados,MinhasMesas}.tsx` + testes, `apps/equipe/src/mesas/TodasMesas.tsx` + teste, `apps/equipe/src/tempo-real/useEquipeAoVivo.ts`, `apps/equipe/src/nfc/lerEtiqueta.ts` + teste

**Interfaces:**
- Produces:
  - `ListaChamados`:
    - cada cartão mostra `Mesa <n>`, `Chamou o atendente` ou `Novo pedido para confirmar`, tempo desde a criação e o selo `Para todos` quando houver;
    - tocar marca lido;
    - `CONFIRMAR_RODADA` → `navegar('/mesa/'+token)`;
    - `ATENDENTE` tem o botão `Atendido`.
  - `MinhasMesas` / `TodasMesas`: a partir de `GET /equipe/mesas`, com o selo de `pendentes`.
  - `useEquipeAoVivo(aoMudar)`: socket, eventos `chamados-mudaram` e `mesa-mudou`, e refetch ao reconectar ou ao voltar a aba.
  - `lerEtiqueta(): Promise<string>`:
    - usa `NDEFReader` (Web NFC) e devolve o token extraído da URL `/m/<token>`;
    - sem suporte → `null`, e o botão `Ler etiqueta` some. No iPhone fica a lista `Todas as mesas`.

- [ ] **Step 1: Testes que falham**
  - `mostra os chamados do garçom com o tipo certo`.
  - `tocar no chamado marca lido`.
  - `chamado de pedido abre a mesa`.
  - `Atendido resolve`.
  - `evento chamados-mudaram recarrega a lista`.
  - `sem Web NFC não mostra Ler etiqueta`.
  - `lerEtiqueta extrai o token da URL lida` (`NDEFReader` falso).
  - `TodasMesas abre a mesa tocada`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS.
- [ ] **Step 5:** Commit `feat(equipe): live calls list, tables and NFC tag reading`.

### Task 12: App da equipe — tela da mesa

**Files:**
- Create: `apps/equipe/src/mesa/{TelaMesa,RodadaPendente,AdicionarItem}.tsx` + testes, `apps/equipe/src/preco.ts` (só `formatarReais`)

**Interfaces:**
- Consumes: `GET /equipe/mesas/:token`, os endpoints de rodada da Task 7 e `GET /api/publico/mesas/:token/cardapio` para listar pratos.
- Produces:
  - `TelaMesa`:
    - cabeçalho `Mesa <n>` e o responsável;
    - rodadas pendentes primeiro, com o selo `Celular novo` se `dispositivoNovo`;
    - depois as confirmadas e o `Total parcial`.
  - `RodadaPendente`:
    - cada item com nome, opções, observação em destaque, `−`/`+` e `Remover`;
    - botões `Confirmar pedido` (primário) e `Recusar`, este com confirmação `Recusar este pedido?`.
  - `AdicionarItem`:
    - lista de pratos não esgotados **sem grupo obrigatório**, com quantidade e observação;
    - Ruling: pratos com opções obrigatórias ficam fora nesta etapa (o cliente escolhe no próprio celular). Custo: o garçom não troca o tamanho da pizza.

- [ ] **Step 1: Testes que falham**
  - `mostra a rodada pendente com observação`.
  - `menos até zero remove o item`.
  - `Confirmar pedido chama a API e a rodada vai para confirmadas`.
  - `Recusar pede confirmação`.
  - `409 de rodada já confirmada recarrega a mesa sem erro feio`.
  - `AdicionarItem não lista a pizza nem o pastel esgotado`.
  - `mesa sem sessão mostra 'Mesa livre'`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS.
- [ ] **Step 5:** Commit `feat(equipe): table screen to confirm, edit or refuse a round`.

### Task 13: PWA, Push no celular e demo de ponta a ponta

**Files:**
- Create: `apps/equipe/public/{manifest.webmanifest,sw.js,icone-192.png,icone-512.png}`, `apps/equipe/src/push/ativarNotificacoes.ts` + teste
- Modify: `apps/equipe/index.html` (manifest, `theme-color`, `viewport-fit=cover`), `apps/cliente/index.html` (`viewport-fit=cover`, minor adiado da Etapa 1), `README.md`

**Interfaces:**
- Produces:
  - `sw.js`:
    - `push` → `showNotification(titulo, {body, data:{url}})`;
    - `notificationclick` → foca uma janela aberta ou abre `url`.
  - `ativarNotificacoes(): Promise<'ativado'|'negado'|'sem-suporte'|'sem-chave'>`: pede permissão no clique, assina com a `chavePublica` e envia a inscrição. Botão `Ativar notificações` no início enquanto não estiver ativado.
  - Ícones: PNG sólido com a letra, gerados por FFmpeg (comando no README).
  - README, seção "Celular com HTTPS (Tailscale)":
    - **ação do dono:** ativar HTTPS Certificates no admin do Tailscale;
    - `tailscale serve --bg --https=443 http://localhost:5173` e `tailscale serve --bg --https=8443 http://localhost:5174`;
    - abrir `https://<máquina>.<tailnet>.ts.net/m/<token>` e `https://…:8443`;
    - `pnpm --filter api vapid` e copiar as chaves para o `.env`.
  - Motivo: Push, service worker e Web NFC só funcionam em HTTPS.

- [ ] **Step 1: Testes que falham**
  - `sem PushManager → sem-suporte`.
  - `permissão negada → negado`.
  - `assina com a chave e envia a inscrição`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS. Rodar também todas as suítes: api unit + e2e, cliente e equipe (`test`, `tsc`, `lint`, `build`).
- [ ] **Step 5: Verificação manual (registrar o resultado no ledger)**
  1. Subir api, cliente e equipe.
  2. Ana loga e liga o turno.
  3. Dois navegadores na mesa 7 veem o mesmo carrinho.
  4. Enviar → Ana recebe o chamado ao vivo → confirma → o cliente vê `Confirmado`.
  5. Segunda rodada → entra `Confirmado` direto.
  6. Chamar atendente → `Atendido`.
  7. Sem resposta por 60 s → Bruno recebe.

  O Push e o NFC no celular de verdade ficam para o dono testar, porque precisam do HTTPS do Tailscale.
- [ ] **Step 6:** Commit `feat(equipe): installable PWA with push notifications; phone HTTPS docs`.

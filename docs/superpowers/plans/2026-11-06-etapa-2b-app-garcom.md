# Etapa 2B — App do garçom: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O app do garçom (PWA): login, turno, chamados ao vivo, mesas, leitura da etiqueta, tela da mesa com acesso total aos itens (quantidade, opções, tamanho, observação) e notificações Push.

**Parte de:** Etapa 2 dividida em duas [dono, 06/11]. Depende da 2A já na `main`: `docs/superpowers/plans/2026-11-06-etapa-2a-pedido-api-cliente.md` (rotas `/equipe/*`, eventos de socket, Push).

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
- O garçom não digita preço. Ele pode mudar quantidade, opções (inclusive tamanho) e observação, remover e adicionar qualquer prato; o preço é sempre recalculado pelas regras de `precoUnitario` [dono, 06/11].
- Cliente sem login: identificado pelo token da mesa e pelo cookie `dispositivo` (§7). Equipe: JWT em cookie httpOnly `equipe`.
- Estilo do código: o padrão atual de cada app (api: prettier + eslint; fronts: oxlint, sem ponto e vírgula, aspas simples). Textos da interface em pt-BR.
- Fora desta etapa: cozinha/estações, conta e fechamento, janela de cancelamento (Etapa 3); exceções por valor ou prato "exige confirmação" e leitor de QR no app (Etapa 4).

## Review Focus

1. **Dois garçons na mesma rodada:** Ana edita enquanto Bruno confirma. Quem chegar depois recebe 409, a tela recarrega e mostra o estado real, sem erro feio e sem confirmar uma versão velha.
2. **Celular do garçom no bolso (app em segundo plano ou fechado):** o Push chega e o toque abre direto a mesa certa. Se a notificação foi negada, o início mostra que ela está desligada.
3. **Sessão do garçom expirada (12 h) no meio do turno:** qualquer ação leva ao login e, depois dele, volta para a tela onde estava.
4. **Editar o tamanho de um item com adicionais e observação:** salvar mantém o que não foi mexido e recalcula o preço igual ao do cliente.
5. **Rede caindo e voltando:** a lista de chamados e a mesa se refazem ao reconectar ou ao voltar a aba, sem chamado fantasma nem chamado faltando.

---

### Task 1: Pacote compartilhado de opções e preço

**Files:**
- Create: `packages/opcoes/{package.json,tsconfig.json,src/index.ts}`; mover de `apps/cliente/src` para `packages/opcoes/src`: `preco/preco.ts` + teste, `pedido/SeletorOpcoes.tsx` + teste, o CSS do seletor e os tipos de prato que ele usa
- Modify: imports do `apps/cliente` (passam a vir de `@cardapio/opcoes`), `apps/cliente/package.json` (dependência `"@cardapio/opcoes": "workspace:*"`)

**Interfaces:**
- Produces: `@cardapio/opcoes`, pacote de código-fonte TS (`"exports": "./src/index.ts"`, sem build; Vite e Vitest compilam). Exporta:
  - `formatarReais`, `precoEfetivo`, `precoExibicao`, `precoUnitario`, `validarSelecao`, `resumirOpcoes`, `type Selecao`;
  - os tipos `PratoPublico`, `GrupoOpcaoPublico`, `OpcaoPublica`;
  - `SeletorOpcoes` com duas props novas opcionais: `inicial?: { selecao: Selecao; observacao: string; quantidade: number }` e `rotuloConfirmar?: string` (padrão o texto atual).
- O `apps/cliente` continua dono do `ItemCarrinho`. O seletor devolve `{pratoId, nome, resumoOpcoes, selecao, observacao, quantidade, precoUnitarioCentavos}`, com a mesma forma de hoje.

- [ ] **Step 1: Testes que falham** (no pacote)
  - `abre com a seleção inicial marcada`: pizza com `inicial.selecao.tam = ['g']` → rádio G marcado e preço 8990.
  - `rotuloConfirmar troca o texto do botão`.
  - Os testes atuais de `preco` e `SeletorOpcoes` mudam de lugar sem mudar as asserções.
- [ ] **Step 2:** `pnpm --filter @cardapio/opcoes test < /dev/null`. Expected: FAIL nos 2 novos.
- [ ] **Step 3:** Mover os arquivos (`git mv`), criar o pacote, implementar as duas props e trocar os imports do cliente.
- [ ] **Step 4:** Expected: PASS no pacote e no cliente (`test`, `tsc -b`, `lint`, `build`).
- [ ] **Step 5:** Commit `refactor: shared options picker and pricing package`.

### Task 2: App da equipe — base, login e turno

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

### Task 3: App da equipe — chamados e mesas ao vivo

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

### Task 4: App da equipe — tela da mesa

**Files:**
- Create: `apps/equipe/src/mesa/{TelaMesa,RodadaPendente,AdicionarItem}.tsx` + testes, nenhum arquivo de preço próprio: usa `@cardapio/opcoes`

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
  - Cada item pendente tem `Editar`, que abre o `SeletorOpcoes` (Task 1) com `inicial` preenchido e `rotuloConfirmar='Salvar'`; salvar chama o PATCH com `selecao`, `observacao` e `quantidade`.
  - `AdicionarItem`: lista os pratos não esgotados; prato com grupos abre o `SeletorOpcoes`, sem grupos adiciona direto com quantidade e observação.

- [ ] **Step 1: Testes que falham**
  - `mostra a rodada pendente com observação`.
  - `menos até zero remove o item`.
  - `Confirmar pedido chama a API e a rodada vai para confirmadas`.
  - `Recusar pede confirmação`.
  - `409 de rodada já confirmada recarrega a mesa sem erro feio`.
  - `AdicionarItem lista a pizza e abre as opções; não lista o pastel esgotado`.
  - `Editar troca o tamanho da pizza e o total da rodada muda` (API mockada devolve a rodada recalculada).
  - `mesa sem sessão mostra 'Mesa livre'`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS.
- [ ] **Step 5:** Commit `feat(equipe): table screen to confirm, edit or refuse a round`.

### Task 5: PWA, Push no celular e demo de ponta a ponta

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

# Etapa 2B — App do garçom: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O app do garçom (PWA): login, turno, chamados ao vivo, mesas, abrir a mesa pela etiqueta, tela da mesa com acesso total aos itens (quantidade, opções, tamanho, observação) e notificações Push.

**Parte de:** Etapa 2 dividida em duas [dono, 06/11]. A 2A está na `main` (merge `bdbcedf`): API completa da equipe, carrinho compartilhado, rodadas, chamados com repasse, Push no servidor, e o cliente ligado a tudo isso. Até aqui o garçom foi simulado pelo `pnpm garcom` (`apps/api/scripts/garcom.mjs`), que continua útil para testes.

**Architecture:**
- **Sem mudança de regra na API.** A 2B é só front: o app novo `apps/equipe` (React 19 + Vite 8, PWA, porta **5174**) consome as rotas `/equipe/*` e o socket que já existem.
- O seletor de opções e o cálculo de preço saem do `apps/cliente` para um pacote compartilhado `packages/opcoes`, usado pelos dois fronts. A API mantém a própria cópia de `preco.ts`, porque o jest dela é CJS e o pacote é TS sem build.
- **Abrir a mesa pela etiqueta, caminho principal:** o garçom encosta o celular na etiqueta e o sistema abre `/m/<token>` no app do cliente. O cliente já pergunta `souEquipe()` e redireciona para `<equipe>/mesa/<token>`. O cookie `equipe` vale para o host inteiro, sem distinguir porta, então isso funciona no Android e no iPhone sem nada além do login. O botão "Ler etiqueta" (Web NFC) é um extra que só aparece no Chrome do Android.

**Tech Stack:** React 19, Vite 8, Vitest + Testing Library, oxlint, `socket.io-client`. Service worker e Web Push escritos à mão, sem plugin de PWA.

**Spec:** `docs/superpowers/specs/2026-11-04-cardapio-digital-design.md` (§4 Pedido e chamado, §5, §6 App do garçom, §7, §8 linha da Etapa 2, §8.1)

## O que a API já entrega (consumir, não reescrever)

| Rota | Uso |
|---|---|
| `POST /equipe/login` `{email,senha}`, `POST /equipe/logout`, `GET /equipe/eu` | sessão (cookie httpOnly `equipe`, 12 h); 401 sem sessão |
| `PATCH /equipe/turno` `{emTurno}` | interruptor de turno |
| `GET /equipe/chamados`, `POST /equipe/chamados/:id/lido`, `POST /equipe/chamados/:id/resolver` | chamados do garçom (ou todos, para o dono); 403 `Este chamado é de outro garçom` |
| `GET /equipe/mesas`, `GET /equipe/mesas/:token` | lista (`aberta`, `garcomNome`, `pendentes`) e mesa (rodadas com `dispositivoNovo`, `totalConfirmadoCentavos`) |
| `PATCH /equipe/rodadas/:id/itens/:itemId` `{quantidade?,selecao?,observacao?}`, `POST /equipe/rodadas/:id/itens`, `POST …/confirmar`, `POST …/recusar` | rodada só muda em `AGUARDANDO_GARCOM`; senão 409 `Esta rodada já foi confirmada ou recusada` |
| `GET /equipe/push/chave`, `POST /equipe/push/inscricoes` | Web Push (chave vazia = push desligado) |
| socket (cookie `equipe` no handshake → salas `equipe:<rest>` e `garcom:<id>`) | eventos `chamados-mudaram` e `mesa-mudou` (sem payload útil: buscar de novo) |

## Global Constraints

- Dinheiro sempre em **centavos inteiros**. O garçom nunca digita preço: a tela mostra o que a API devolve, e o seletor calcula a prévia com o mesmo `precoUnitario` do cliente.
- O garçom pode mudar quantidade, opções (inclusive tamanho) e observação, remover e adicionar qualquer prato não esgotado [dono, 06/11].
- **O garçom não perde chamado:** a lista é sempre o que a API diz. Evento de socket só dispara uma nova busca.
- **Tempo real (lição da 2A):** toda conexão do socket, inclusive a primeira, busca o estado de novo. Ao voltar para a aba (`visibilitychange`) ou ao recuperar a rede (`online`), derrubar e refazer a conexão na hora. O celular bloqueado deixa uma conexão "zumbi".
- Sessão expirada: qualquer 401 leva a `/login?volta=<caminho>`, e depois do login volta para o caminho.
- Visual escuro, com os tokens do cliente. Textos em pt-BR. Botões grandes, porque o garçom usa com uma mão.
- Estilo do código igual ao `apps/cliente`: oxlint, sem ponto e vírgula, aspas simples. Testes com API falsa e socket falso, no padrão de `apps/cliente/src/test/`.
- Fora desta etapa: cozinha, conta e fechamento (Etapa 3); exceções por valor ou prato, e o painel do dono (Etapa 4).

## Review Focus

1. **Dois garçons na mesma rodada:** Ana edita enquanto Bruno confirma. Quem chegar depois recebe 409, a tela recarrega e mostra o estado real com o aviso `Este pedido já foi confirmado ou recusado`, sem confirmar uma versão velha.
2. **Celular do garçom no bolso (app em segundo plano ou fechado):** o Push chega e o toque abre direto a mesa certa. Se a notificação foi negada, o início mostra que ela está desligada.
3. **Sessão expirada (12 h) no meio do turno:** qualquer ação leva ao login e, depois dele, volta para a tela onde estava.
4. **Editar o tamanho de um item com adicionais e observação:** salvar mantém o que não foi mexido, e o preço bate com o do cliente.
5. **Celular bloqueado e desbloqueado:** a lista de chamados e a mesa se refazem sozinhas, sem chamado fantasma nem chamado faltando.

---

### Task 1: Pacote compartilhado de opções e preço

**Files:**
- Create: `packages/opcoes/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`
- Move (`git mv`) de `apps/cliente/src` para `packages/opcoes/src`:
  - `preco/preco.ts` + `preco.test.ts`;
  - `pedido/SeletorOpcoes.tsx` + teste;
  - as regras de CSS do seletor, separadas de `pedido/pedido.css` em `opcoes.css`;
  - os tipos `PratoPublico`, `GrupoOpcaoPublico` e `OpcaoPublica`, que saem de `api/tipos.ts`. O cliente passa a reexportá-los.
- Modify: imports do cliente (passam a vir de `@cardapio/opcoes`), `apps/cliente/package.json` (`"@cardapio/opcoes": "workspace:*"`), `pnpm-workspace.yaml` se precisar.

**Interfaces:**
- Produces: `@cardapio/opcoes`, pacote de código-fonte TS (`"exports": "./src/index.ts"`, sem build).
  - Exporta: `formatarReais`, `precoEfetivo`, `precoExibicao`, `precoUnitario`, `validarSelecao`, `resumirOpcoes`, `type Selecao`, os 3 tipos de prato e `SeletorOpcoes`.
  - `SeletorOpcoes` ganha duas props opcionais: `inicial?: { selecao: Selecao; observacao: string; quantidade: number }` e `rotuloConfirmar?: string` (padrão: o texto de hoje).
- O retorno do seletor mantém a forma atual: `{pratoId, nome, resumoOpcoes, selecao, observacao, quantidade, precoUnitarioCentavos}`.

- [ ] **Step 1: Testes que falham** (no pacote)
  - `abre com a seleção inicial marcada`: pizza com `inicial.selecao[tam] = [g]` → rádio G marcado e preço 8990.
  - `rotuloConfirmar troca o texto do botão`.
  - Os testes atuais de `preco` e `SeletorOpcoes` mudam de lugar sem mudar as asserções.
- [ ] **Step 2:** `pnpm --filter @cardapio/opcoes test < /dev/null`. Expected: FAIL nos 2 novos.
- [ ] **Step 3:** Mover, criar o pacote, implementar as props e trocar os imports.
- [ ] **Step 4:** Expected: PASS no pacote e no cliente (`test`, `tsc -b`, `lint`, `build`; cliente continua com 109+).
- [ ] **Step 5:** Commit `refactor: shared options picker and pricing package`.

### Task 2: App da equipe — base, login e turno

**Files:**
- Create:
  - `apps/equipe/`, com o mesmo setup do `apps/cliente`. O `vite.config.ts` usa porta **5174**, `host:true`, proxy `/api` (com rewrite) e `/socket.io` (`ws:true`) para a 3000, e `allowedHosts:['.ts.net']`.
  - `src/rotas.ts` + teste, `src/api/equipe.ts`, `src/login/Login.tsx` + teste, `src/inicio/Topo.tsx` + teste, `src/estilo/tokens.css` (copiado do cliente), `src/test/{api-falsa,socket-falso,setup}.ts`.
- Modify: `package.json` da raiz (`dev:equipe`).

**Interfaces:**
- Produces:
  - `rotas.ts`: `useRota(): Rota` e `navegar(caminho)`, com `history.pushState` + `popstate`.
    - `type Rota = {nome:'login', volta?: string} | {nome:'inicio'} | {nome:'mesas'} | {nome:'mesa', token: string}`
    - caminhos: `/login`, `/`, `/mesas`, `/mesa/:token`.
  - `api/equipe.ts`: uma função por rota da tabela acima. Qualquer 401 lança `ErroNaoAutenticado`, e o `App` leva para `/login?volta=<caminho atual>`.
  - `Topo`: nome do usuário, interruptor `Em turno` (aria `switch`) e `Sair`.

- [ ] **Step 1: Testes que falham**
  - `rotas reconhece /mesa/abc e /login?volta=/mesa/abc`.
  - `login certo vai para o início`.
  - `login certo com volta vai para a tela de antes`.
  - `login errado mostra 'E-mail ou senha inválidos'`.
  - `sem sessão abre o login`.
  - `401 no meio do uso leva ao login com volta`.
  - `interruptor Em turno chama a API e reflete o estado`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS, mais `tsc`, `lint` e `build`.
- [ ] **Step 5:** Commit `feat(equipe): staff app shell with login and shift toggle`.

### Task 3: App da equipe — chamados e mesas ao vivo

**Files:**
- Create: `apps/equipe/src/inicio/{Inicio,ListaChamados}.tsx` + testes, `apps/equipe/src/mesas/TodasMesas.tsx` + teste, `apps/equipe/src/tempo-real/useEquipeAoVivo.ts`, `apps/equipe/src/nfc/lerEtiqueta.ts` + teste

**Interfaces:**
- Produces:
  - `ListaChamados`:
    - cada cartão mostra `Mesa <n>`, `Chamou o atendente` ou `Novo pedido para confirmar`, o tempo desde a criação (`há 2 min`) e os selos `Para todos` e `Repassado` quando houver;
    - tocar marca lido;
    - `CONFIRMAR_RODADA` → `navegar('/mesa/'+token)`;
    - `ATENDENTE` tem o botão `Atendido`;
    - 403 de chamado de outro garçom → recarrega a lista.
  - `Inicio`: `Topo`, chamados, "Minhas mesas" (as abertas em que `garcomNome` sou eu, com o selo de `pendentes`) e o link `Todas as mesas`.
  - `TodasMesas`: todas as mesas, livres em cinza; tocar abre a mesa.
  - `useEquipeAoVivo(aoMudar: { chamados(): void; mesas(): void })`: socket com os eventos `chamados-mudaram` e `mesa-mudou`, mais a regra de reconexão das Global Constraints.
  - `lerEtiqueta(): Promise<string | null>`: `NDEFReader` → token extraído de `/m/<token>`. Sem suporte o botão `Ler etiqueta` some.

- [ ] **Step 1: Testes que falham**
  - `mostra os chamados do garçom com o tipo certo`.
  - `tocar no chamado marca lido`.
  - `chamado de pedido abre a mesa`.
  - `Atendido resolve`.
  - `evento chamados-mudaram recarrega a lista`.
  - `desbloquear o celular refaz a conexão e recarrega`.
  - `minhas mesas mostra só as minhas com pendentes`.
  - `sem Web NFC não mostra Ler etiqueta`.
  - `lerEtiqueta extrai o token da URL lida` (`NDEFReader` falso).
  - `TodasMesas abre a mesa tocada`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS.
- [ ] **Step 5:** Commit `feat(equipe): live calls list, tables and NFC tag reading`.

### Task 4: App da equipe — tela da mesa

**Files:**
- Create: `apps/equipe/src/mesa/{TelaMesa,RodadaPendente,AdicionarItem}.tsx` + testes. Nenhum arquivo de preço próprio: usa `@cardapio/opcoes`.

**Interfaces:**
- Consumes: `GET /equipe/mesas/:token`, as rotas de rodada e `GET /api/publico/mesas/:token/cardapio`, para listar os pratos e os grupos de opções.
- Produces:
  - `TelaMesa`:
    - cabeçalho `Mesa <n>` com o responsável;
    - rodadas pendentes primeiro, com o selo `Celular novo` se `dispositivoNovo`;
    - depois as confirmadas, as recusadas (riscadas) e o `Total parcial`;
    - recarrega no evento `mesa-mudou`.
  - `RodadaPendente`:
    - cada item com nome, opções, observação em destaque, `−`/`+` e `Remover`;
    - `Editar` abre o `SeletorOpcoes` com `inicial` e `rotuloConfirmar='Salvar'`, e salvar faz PATCH de `selecao`, `observacao` e `quantidade`;
    - botões `Confirmar pedido` (primário) e `Recusar` (pede `Recusar este pedido?`);
    - 409 → recarrega a mesa e mostra `Este pedido já foi confirmado ou recusado`.
  - `AdicionarItem`: pratos não esgotados, agrupados por categoria. Prato com grupos abre o seletor; sem grupos adiciona direto.
  - Mesa sem sessão: `Mesa livre`.

- [ ] **Step 1: Testes que falham**
  - `mostra a rodada pendente com observação e selo Celular novo`.
  - `menos até zero remove o item`.
  - `Confirmar pedido chama a API e a rodada vai para confirmadas`.
  - `Recusar pede confirmação`.
  - `409 recarrega a mesa e avisa sem erro feio`.
  - `AdicionarItem lista a pizza e abre as opções; não lista o pastel esgotado`.
  - `Editar troca o tamanho da pizza, mantém adicional e observação, e o total muda` (a API falsa devolve a rodada recalculada).
  - `evento mesa-mudou recarrega`.
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
    - `push` → `showNotification(titulo, {body, data:{url}})`, com o payload que o `PushService` já manda;
    - `notificationclick` → foca uma janela aberta e navega até `url`, ou abre `url`.
  - `ativarNotificacoes(): Promise<'ativado'|'negado'|'sem-suporte'|'sem-chave'>`: pede permissão no clique, assina com a chave e envia a inscrição. No início, o botão `Ativar notificações` aparece enquanto não estiver ativado, e o texto `Notificações bloqueadas no navegador` aparece se a permissão foi negada.
  - Ícones: PNG sólido com a letra, gerados por FFmpeg (o comando vai no README).
  - README, seção "Celular com HTTPS (Tailscale)", porque Push, service worker e Web NFC só funcionam em HTTPS:
    - **ação do dono:** ativar HTTPS Certificates no admin do Tailscale;
    - `tailscale serve --bg --https=443 http://localhost:5173` e `tailscale serve --bg --https=8443 http://localhost:5174`;
    - `pnpm --filter api vapid` e copiar as chaves para o `.env`.

- [ ] **Step 1: Testes que falham**
  - `sem PushManager → sem-suporte`.
  - `chave vazia → sem-chave`.
  - `permissão negada → negado`.
  - `assina com a chave e envia a inscrição`.
- [ ] **Step 2:** Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Expected: PASS. Rodar também todas as suítes: api unit + e2e, opcoes, cliente e equipe (`test`, `tsc`, `lint`, `build`).
- [ ] **Step 5: Verificação manual por script** (resultado no ledger): com api, cliente e equipe no ar, um script de fumaça faz este roteiro pelo proxy do 5174.
  1. Ana loga e entra em turno.
  2. Um cliente envia um pedido.
  3. O chamado aparece para a Ana.
  4. A Ana troca o tamanho e confirma.
  5. O cliente vê `CONFIRMADA`.
  6. O cliente chama o atendente, e a Ana resolve.

  No celular de verdade (Push, NFC, instalar o app), o dono testa depois de ligar o HTTPS do Tailscale.
- [ ] **Step 6:** Commit `feat(equipe): installable PWA with push notifications; phone HTTPS docs`.

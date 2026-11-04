# Etapa 1 — Cardápio do Cliente: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** Quem abrir `/m/<token>` no celular vê o cardápio da mesa como no mockup aprovado (lista, filtros, preço com desconto, vídeo estilo story), monta o pedido num carrinho local com opções e observação, conecta no Wi-Fi e avalia no Google.

**Arquitetura:**
- **API:** uma rota pública e somente leitura, `GET /publico/mesas/:token/cardapio`, devolve um DTO enxuto. Ela não expõe `restauranteId` nem o token.
- **Front:** novo app `apps/cliente` (React + Vite).
  - Regras de preço e carrinho são funções puras, testadas à parte.
  - Componentes testados com Testing Library.
  - Em desenvolvimento, o Vite faz proxy de `/api` para a API, então não há CORS.
- **Vídeos da demo:** arquivos estáticos em `apps/cliente/public/demo/videos/`, gerados por um script FFmpeg.

**Stack:** React 19, Vite, TypeScript (`strict`), Vitest + @testing-library/react + jsdom, CSS puro (portado do mockup), NestJS 11 / Prisma 6 (existentes), FFmpeg (já instalado na máquina).

**Spec:** `docs/superpowers/specs/2026-11-04-cardapio-digital-design.md` (§4 Experiência do cliente, §8 Etapa 1, §8.1 Variações)
**Mockup aprovado:** `.superpowers/brainstorm/633-1793804104/content/cardapio-v1.html`. O visual dos componentes segue esse arquivo.

## Restrições globais

- Dinheiro em **centavos inteiros**. Na tela, sempre via `formatarReais`, que gera `R$ 59,90` com `Intl` pt-BR (o espaço entre `R$` e o número é ` `).
- **Desconto:** preço promocional em destaque, original riscado e `-N%` (arredondado). Só aparece se `0 < promo < base`.
- **Pizza meio a meio:** cobra o acréscimo do **sabor mais caro** entre os escolhidos (regra "MAIOR" da spec).
- **Story:**
  - começa **mudo**, com botão de som;
  - tocar pausa e retoma;
  - o vídeo repete em loop;
  - deslizar **para cima avança**;
  - barra no topo com **um segmento por prato** da lista filtrada atual;
  - contador `N de T`;
  - pré-carrega o próximo vídeo.
- **Botões fixos embaixo:** "Chamar atendente" e **"Realizar pedido (N)"**.
  - Nesta etapa, "Chamar atendente" mostra o aviso `Em breve: o garçom receberá seu chamado por aqui.`
  - O carrinho existe só no aparelho. O envio fica desabilitado com o texto `O envio para o garçom chega na próxima versão.`
- **Carrinho:** fica em `localStorage`, com a chave `carrinho:<token>`. Toda leitura e escrita fica em try/catch. Sem storage, o carrinho funciona só em memória.
- Textos da interface em pt-BR. Nomes de domínio no código em português.
- Toda mensagem de commit termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Ao fim da etapa: parar para a revisão do dono do projeto.**

## Foco de revisão

1. **Vídeo ausente, quebrado ou lento:** o story mostra o poster ou um fundo, nunca tela preta, e continua navegável. → Task 6
2. **Promo maior ou igual ao preço, ou preço base 0 (pizza):** não mostra `-N%` nem preço riscado. → Task 2
3. **`localStorage` bloqueado (aba anônima):** o carrinho funciona em memória, sem quebrar a tela. → Task 3
4. **Token estranho** (aspas, `%`, 500 caracteres): 404 limpo `{ mensagem: 'Mesa não encontrada' }`, nunca 500. → Task 1
5. **Categoria sem pratos, ou restaurante sem nenhum destaque:** a categoria não aparece e o chip "Destaques" some. → Tasks 1 e 5

---

### Task 1: API — rota pública do cardápio

**Arquivos:**
- Criar: `apps/api/src/cardapio-publico/cardapio-publico.module.ts`, `.controller.ts`, `.service.ts`, `cardapio-publico.types.ts`
- Modificar: `apps/api/src/app.module.ts`
- Testes: `apps/api/test/cardapio-publico.e2e-spec.ts`

**Interfaces:**
- Produz `GET /publico/mesas/:token/cardapio`. Responde `200 CardapioPublico` ou `404 { mensagem: 'Mesa não encontrada' }`.
- Produz em `cardapio-publico.types.ts` (o front espelha em `apps/cliente/src/api/tipos.ts`, Task 4):

```ts
export type OpcaoPublica = { id: string; nome: string; precoCentavos: number; precoPromocionalCentavos: number | null };
export type GrupoOpcaoPublico = {
  id: string; nome: string; tipo: 'UNICA' | 'MULTIPLA' | 'SABORES';
  obrigatorio: boolean; min: number; max: number; opcoes: OpcaoPublica[];
};
export type PratoPublico = {
  id: string; nome: string; descricao: string;
  precoCentavos: number; precoPromocionalCentavos: number | null;
  destaque: boolean; esgotado: boolean; videoUrl: string | null; posterUrl: string | null;
  grupos: GrupoOpcaoPublico[];
};
export type CategoriaPublica = { id: string; nome: string; pratos: PratoPublico[] };
export type CardapioPublico = {
  restaurante: {
    nome: string; logoUrl: string | null; googleAvaliacaoUrl: string | null;
    wifi: { ssid: string; senha: string | null } | null; // null se wifiSsid vazio
  };
  mesa: { numero: number };
  categorias: CategoriaPublica[]; // ordenadas por ordem; categorias sem pratos omitidas
};
```

Pratos, grupos e opções vêm ordenados por `ordem`. Pratos esgotados **são incluídos** (com `esgotado: true`).

- [ ] **Passo 1:** Escrever o e2e que falha.
  - O `beforeAll` roda `seedDemo` e cria, no restaurante demo, uma categoria vazia `"Vazia"` (`ordem: 99`).
  - O `afterAll` apaga o restaurante `demo`.
  - Pegar o token da mesa 7 via Prisma.

```ts
it('devolve o cardápio da mesa sem vazar ids internos', async () => {
  const res = await request(app.getHttpServer()).get(`/publico/mesas/${token}/cardapio`).expect(200);
  expect(res.body.mesa).toEqual({ numero: 7 });
  expect(res.body.restaurante.nome).toBe('Cantina Demo');
  expect(res.body.restaurante.wifi).toEqual({ ssid: 'Cantina-Clientes', senha: 'bemvindo123' });
  expect(res.body.categorias.map((c) => c.nome)).toEqual(['Entradas', 'Pizzas', 'Pratos', 'Bebidas', 'Sobremesas']);
  expect(JSON.stringify(res.body)).not.toMatch(/restauranteId|"token"/);
});
it('mantém centavos, promo e esgotado', async () => {
  const res = await request(app.getHttpServer()).get(`/publico/mesas/${token}/cardapio`);
  const pratos = res.body.categorias.flatMap((c) => c.pratos);
  const mix = pratos.find((p) => p.nome === 'Mix da Casa');
  expect([mix.precoCentavos, mix.precoPromocionalCentavos, mix.destaque]).toEqual([6990, 5990, true]);
  expect(pratos.find((p) => p.nome === 'Pastel de Carne Seca').esgotado).toBe(true);
  const pizza = pratos.find((p) => p.nome === 'Pizza Margherita');
  expect(pizza.grupos.map((g) => g.nome)).toEqual(['Tamanho', 'Sabores', 'Adicionais']);
  expect(pizza.grupos[0].opcoes.map((o) => o.precoCentavos)).toEqual([4990, 6990, 8990]);
});
it.each(['nao-existe', "x'%3B--", 'a'.repeat(500)])('responde 404 limpo para token %s', async (t) => {
  await request(app.getHttpServer()).get(`/publico/mesas/${encodeURIComponent(t)}/cardapio`)
    .expect(404).expect({ mensagem: 'Mesa não encontrada' });
});
```

- [ ] **Passo 2:** Rodar `pnpm --filter api test:e2e`. Esperado: FAIL (404 da rota inexistente no primeiro teste).
- [ ] **Passo 3:** Implementar em `cardapio-publico.service.ts`: `CardapioPublicoService.buscarPorToken(token: string): Promise<CardapioPublico | null>`.
  - Fazer uma consulta Prisma com `include` aninhado e `orderBy: { ordem: 'asc' }` em cada nível.
  - Mapear explicitamente para o DTO, campo a campo (sem spread de entidades).
  - Rejeitar logo, sem consultar, tokens com mais de 64 caracteres.
- [ ] **Passo 4:** Implementar o controller. Quando o resultado for `null`, lançar `NotFoundException({ mensagem: 'Mesa não encontrada' })`. Registrar o módulo no `AppModule`.
- [ ] **Passo 5:** Rodar `pnpm --filter api test:e2e`. Esperado: PASS.
- [ ] **Passo 6:** Commit: `feat(api): public menu endpoint by table token`.

### Task 2: App `cliente` + regras de preço

**Arquivos:**
- Criar: `apps/cliente/` via `pnpm create vite@latest apps/cliente --template react-ts`.
  - Remover o conteúdo de exemplo.
  - Adicionar `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.
  - Script `test`: `vitest run`.
- Criar: `apps/cliente/vitest.setup.ts`, que importa jest-dom e faz stub de `HTMLMediaElement.prototype.play` (resolve) e `pause`.
- Criar: `apps/cliente/src/preco/preco.ts`
- Testes: `apps/cliente/src/preco/preco.test.ts`

**Interfaces:**
- Consome os tipos `PratoPublico`/`GrupoOpcaoPublico`. Nesta task, copiar o bloco de tipos da Task 1 para `apps/cliente/src/api/tipos.ts`.
- Produz:
  - `type Selecao = Record<string /*grupoId*/, string[] /*opcaoIds*/>`
  - `formatarReais(centavos: number): string`
  - `precoEfetivo(base: number, promo: number | null): number`
  - `descontoPercentual(base: number, promo: number | null): number | null`
  - `precoExibicao(prato: PratoPublico): { centavos: number; originalCentavos: number | null; desconto: number | null; aPartirDe: boolean }`
  - `precoUnitario(prato: PratoPublico, selecao: Selecao): number`
  - `validarSelecao(prato: PratoPublico, selecao: Selecao): string[]`

- [ ] **Passo 1:** Escrever os testes que falham. Usar fixture `pizza` igual ao seed (Tamanho P/M/G 4990/6990/8990, Sabores max 2 com Quatro Queijos +1000, Adicionais Borda 1200 / Bacon 800) e `mix` (6990 → 5990):

```ts
expect(formatarReais(5990)).toBe('R$ 59,90');
expect(descontoPercentual(6990, 5990)).toBe(14);
expect(descontoPercentual(6990, null)).toBeNull();
expect(descontoPercentual(5990, 5990)).toBeNull();
expect(descontoPercentual(5990, 6990)).toBeNull();
expect(descontoPercentual(0, 0)).toBeNull();
expect(precoExibicao(mix)).toEqual({ centavos: 5990, originalCentavos: 6990, desconto: 14, aPartirDe: false });
expect(precoExibicao(pizza)).toEqual({ centavos: 4990, originalCentavos: null, desconto: null, aPartirDe: true });
// M + meio Margherita / meio Quatro Queijos + Bacon = 6990 + 1000 (maior sabor) + 800
expect(precoUnitario(pizza, { [tam]: [m], [sab]: [margherita, quatroQueijos], [adic]: [bacon] })).toBe(8790);
expect(precoUnitario(mix, {})).toBe(5990);
expect(validarSelecao(pizza, {})).toEqual(['Escolha Tamanho', 'Escolha Sabores']);
expect(validarSelecao(pizza, { [tam]: [m], [sab]: [a, b, c] })).toEqual(['Escolha até 2 em Sabores']);
expect(validarSelecao(pizza, { [tam]: [p], [sab]: [margherita] })).toEqual([]);
```

- [ ] **Passo 2:** Rodar `pnpm --filter cliente test`. Esperado: FAIL (módulo inexistente).
- [ ] **Passo 3:** Implementar `preco.ts`.
  - O preço base é o efetivo da opção escolhida no grupo `UNICA`, ou, sem esse grupo, o efetivo do prato.
  - Somar o **maior** acréscimo entre os `SABORES` escolhidos.
  - Somar todos os `MULTIPLA` escolhidos.
  - `aPartirDe` é true quando existe grupo `UNICA` obrigatório. Nesse caso, `centavos` é o menor efetivo entre as opções desse grupo.
  - As mensagens de validação são exatamente: `Escolha <Grupo>` (obrigatório vazio ou abaixo de `min`) e `Escolha até <max> em <Grupo>`.
- [ ] **Passo 4:** Rodar `pnpm --filter cliente test`. Esperado: PASS.
- [ ] **Passo 5:** Commit: `feat(cliente): scaffold app and pricing rules`.

### Task 3: Carrinho local

**Arquivos:**
- Criar: `apps/cliente/src/carrinho/carrinho.ts`, `apps/cliente/src/carrinho/useCarrinho.ts`
- Testes: `apps/cliente/src/carrinho/carrinho.test.ts`

**Interfaces:**
- Produz:
  - `type ItemCarrinho = { id: string; pratoId: string; nome: string; resumoOpcoes: string; selecao: Selecao; observacao: string; quantidade: number; precoUnitarioCentavos: number }`
  - `type AcaoCarrinho = { tipo: 'adicionar'; item: Omit<ItemCarrinho, 'id'> } | { tipo: 'remover'; id: string } | { tipo: 'quantidade'; id: string; quantidade: number }`
  - `reduzirCarrinho(itens: ItemCarrinho[], acao: AcaoCarrinho): ItemCarrinho[]`
  - `totalCarrinho(itens: ItemCarrinho[]): number`
  - `contarItens(itens: ItemCarrinho[]): number` (soma as quantidades)
  - `carregarCarrinho(token: string, storage?: Storage): ItemCarrinho[]`
  - `salvarCarrinho(token: string, itens: ItemCarrinho[], storage?: Storage): void`
  - hook `useCarrinho(token: string): { itens: ItemCarrinho[]; despachar: (a: AcaoCarrinho) => void; total: number; quantidade: number }`

- [ ] **Passo 1:** Escrever os testes que falham:
  - adicionar gera `id` e soma no total (`2 × 5990 + 1 × 8790 = 20770`);
  - `quantidade` com 0 remove o item;
  - `remover` remove;
  - salvar e carregar faz ida e volta pela chave `carrinho:<token>`;
  - **storage que lança em `getItem` e `setItem`:** `carregarCarrinho` devolve `[]` e `salvarCarrinho` não lança;
  - JSON corrompido no storage → `[]`.
- [ ] **Passo 2:** Rodar `pnpm --filter cliente test carrinho`. Esperado: FAIL.
- [ ] **Passo 3:** Implementar. O `id` vem de `crypto.randomUUID()`. O hook usa `useReducer` e salva a cada mudança.
- [ ] **Passo 4:** Rodar os testes. Esperado: PASS.
- [ ] **Passo 5:** Commit: `feat(cliente): local cart with safe storage`.

### Task 4: Carregamento do cardápio e estados da tela

**Arquivos:**
- Criar: `apps/cliente/src/api/tipos.ts` (já criado na Task 2), `apps/cliente/src/api/cardapio.ts`, `apps/cliente/src/rota.ts`
- Modificar: `apps/cliente/src/App.tsx`, `apps/cliente/vite.config.ts`
- Testes: `apps/cliente/src/rota.test.ts`, `apps/cliente/src/App.test.tsx`

**Interfaces:**
- Produz:
  - `extrairToken(pathname: string): string | null` (casa `/m/<token>`, aceitando barra final);
  - `buscarCardapio(token: string): Promise<CardapioPublico>`, que chama `GET /api/publico/mesas/<token>/cardapio` e lança `ErroMesaNaoEncontrada` no 404 e `ErroRede` nos demais casos;
  - `App`, que renderiza `ListaCardapio` (Task 5) quando carrega.
- Configurar em `vite.config.ts`:
  - `server.host: true`, para abrir no celular pela rede local;
  - proxy `/api` → `http://localhost:3000`, com o rewrite que remove `/api`;
  - bloco `test` com `environment: 'jsdom'`, `setupFiles: ['./vitest.setup.ts']`.

- [ ] **Passo 1:** Escrever os testes que falham:
  - `extrairToken('/m/abc_-123')` → `'abc_-123'`;
  - `extrairToken('/m/abc/')` → `'abc'`;
  - `extrairToken('/')` → `null`.
- [ ] **Passo 2:** Escrever os testes do `App`, com `fetch` mockado via `vi.stubGlobal`:
  - 404 → texto `Mesa não encontrada` e `Peça ajuda ao atendente.`;
  - falha de rede → `Não foi possível carregar o cardápio` e um botão `Tentar novamente` que refaz o fetch;
  - sucesso → nome do restaurante na tela;
  - URL sem token → `Mesa não encontrada`, sem fetch.
- [ ] **Passo 3:** Rodar. Esperado: FAIL.
- [ ] **Passo 4:** Implementar. Enquanto `ListaCardapio` não existe, o `App` renderiza um `<h1>` com o nome; a Task 5 substitui.
- [ ] **Passo 5:** Rodar. Esperado: PASS.
- [ ] **Passo 6:** Commit: `feat(cliente): load menu by table token with error states`.

### Task 5: Lista do cardápio

**Arquivos:**
- Criar: `apps/cliente/src/lista/ListaCardapio.tsx`, `CartaoPrato.tsx`, `PrecoPrato.tsx`, `WifiSheet.tsx`, `lista.css`
- Criar: `apps/cliente/src/estilo/tokens.css`, com as cores do mockup (fundo `#0f0f10`, superfície `#1f1f22`, destaque `#ff5a1f`, preço `#4ade80`, selo `#facc15`)
- Modificar: `apps/cliente/src/App.tsx`
- Testes: `apps/cliente/src/lista/ListaCardapio.test.tsx`

**Interfaces:**
- Consome `CardapioPublico`, `precoExibicao`, `formatarReais` e `useCarrinho`.
- Produz:
  - `ListaCardapio({ cardapio, token }: { cardapio: CardapioPublico; token: string })`;
  - `pratosDoFiltro(cardapio: CardapioPublico, filtro: string): PratoPublico[]`, exportada e usada pela Task 6. O valor `'destaques'` filtra os destaques; qualquer outro valor é o id da categoria.

- [ ] **Passo 1:** Escrever os testes que falham, com o fixture do cardápio demo:
  - **chips:**
    - com algum destaque, o primeiro chip é `Destaques` e começa ativo, mostrando "Mix da Casa" e "Pizza Margherita";
    - clicar em `Bebidas` mostra "Chopp 500ml" e esconde "Mix da Casa";
    - num cardápio sem destaques, o chip `Destaques` não existe;
  - **preços:**
    - "Mix da Casa" mostra `R$ 59,90`, o original riscado `R$ 69,90` (elemento `<s>`) e `-14%`;
    - a pizza mostra `a partir de R$ 49,90`, sem `<s>`;
  - **esgotado:** "Pastel de Carne Seca" tem `aria-disabled="true"` e o texto `Esgotado`;
  - **cabeçalho:** `Mesa 7`;
  - **Wi-Fi:** o botão abre um painel com `Cantina-Clientes`, `bemvindo123` e o botão `Copiar senha`. Sem `wifi`, o botão não aparece;
  - **Google:** o link `Avalie no Google` tem o `href` do cardápio e `target="_blank"`. Sem URL, o link não aparece;
  - **botões fixos:**
    - "Chamar atendente" mostra `Em breve: o garçom receberá seu chamado por aqui.`;
    - o botão mostra `Realizar pedido (0)`.
- [ ] **Passo 2:** Rodar. Esperado: FAIL.
- [ ] **Passo 3:** Implementar, seguindo o mockup:
  - o logo usa a inicial do nome quando não há `logoUrl`;
  - a miniatura usa `posterUrl`, ou um gradiente quando não há;
  - o link do Google fica no fim da lista;
  - "Copiar senha" usa `navigator.clipboard.writeText`. Se falhar, seleciona o texto.
- [ ] **Passo 4:** Rodar. Esperado: PASS.
- [ ] **Passo 5:** Commit: `feat(cliente): menu list with filters, prices, wifi and review link`.

### Task 6: Visualizador estilo story

**Arquivos:**
- Criar: `apps/cliente/src/story/StoryViewer.tsx`, `story.css`
- Modificar: `apps/cliente/src/lista/ListaCardapio.tsx` (tocar no cartão abre o story no índice do prato dentro de `pratosDoFiltro`)
- Testes: `apps/cliente/src/story/StoryViewer.test.tsx`

**Interfaces:**
- Produz `StoryViewer({ pratos, indiceInicial, onFechar, onAdicionar }: { pratos: PratoPublico[]; indiceInicial: number; onFechar: () => void; onAdicionar: (prato: PratoPublico) => void })`.

- [ ] **Passo 1:** Escrever os testes que falham:
  - **contador:** mostra `2 de 5` com `indiceInicial=1` e 5 pratos;
  - **navegação:**
    - `ArrowDown` e deslizar para cima avançam para `3 de 5`;
    - `ArrowUp` volta;
    - no último prato, avançar não passa de `5 de 5`;
  - **deslize:** simular `pointerdown` em y=500 e `pointerup` em y=400 (−100 px) → avança;
  - **barra:** tem 5 segmentos;
  - **vídeo:** `muted` é true no início. O botão `Ativar som` muda para `Desativar som` e `muted` fica false;
  - **voltar:** chama `onFechar`;
  - **adicionar:** "+ Adicionar ao pedido" chama `onAdicionar` com o prato. Em prato esgotado, o botão fica desabilitado com o texto `Esgotado`;
  - **pré-carga:** existe um `<video preload="auto">` oculto com o `src` do próximo prato;
  - **falha do vídeo:** disparar `error` no `<video>` → o poster (`img` com `alt` = nome do prato), ou o fundo `data-testid="story-fundo"`, fica visível e o vídeo some;
  - **prato sem vídeo:** renderiza o poster ou o fundo diretamente.
- [ ] **Passo 2:** Rodar. Esperado: FAIL.
- [ ] **Passo 3:** Implementar:
  - `<video autoPlay muted loop playsInline poster={posterUrl}>`;
  - progresso do segmento atual por `timeupdate`;
  - toque simples (sem deslize) alterna play e pause;
  - limiar de deslize de 50 px;
  - **rodapé:**
    - selos "VÍDEO DO PRATO" e "DESTAQUE", este quando o prato for destaque;
    - nome e `PrecoPrato`;
    - descrição truncada em 2 linhas, com "ler mais" para expandir.
- [ ] **Passo 4:** Rodar. Esperado: PASS.
- [ ] **Passo 5:** Commit: `feat(cliente): story-style dish video viewer`.

### Task 7: Seleção de opções e carrinho

**Arquivos:**
- Criar: `apps/cliente/src/pedido/SeletorOpcoes.tsx`, `CarrinhoSheet.tsx`, `pedido.css`
- Modificar: `apps/cliente/src/lista/ListaCardapio.tsx`. "Adicionar" no story:
  - abre o `SeletorOpcoes` quando o prato tem grupos;
  - sem grupos, adiciona direto com quantidade 1 e mostra o aviso `Adicionado ao pedido`.

  "Realizar pedido (N)" abre o `CarrinhoSheet`.
- Testes: `apps/cliente/src/pedido/SeletorOpcoes.test.tsx`, `apps/cliente/src/pedido/CarrinhoSheet.test.tsx`

**Interfaces:**
- Consome `precoUnitario`, `validarSelecao`, `formatarReais` e `useCarrinho`.
- Produz:
  - `SeletorOpcoes({ prato, onConfirmar, onCancelar }: { prato: PratoPublico; onConfirmar: (item: Omit<ItemCarrinho, 'id'>) => void; onCancelar: () => void })`
  - `CarrinhoSheet({ itens, total, despachar, onFechar })`

- [ ] **Passo 1:** Escrever os testes que falham.
  - **`SeletorOpcoes`, com a pizza:**
    - o botão começa desabilitado, mostrando a lista de erros (`Escolha Tamanho`);
    - **tamanho e sabores:** escolher `M` e o sabor `Margherita` habilita `Adicionar · R$ 69,90`;
    - **meio a meio:** marcar também `Quatro Queijos` muda para `Adicionar · R$ 79,90`;
    - um terceiro sabor fica desabilitado, porque o máximo é 2;
    - **observação:** campo com no máximo 140 caracteres;
    - **quantidade:** `+` para 2 mostra `Adicionar · R$ 159,80`;
    - **confirmar:** `onConfirmar` recebe `quantidade: 2`, `precoUnitarioCentavos: 7990`, `observacao` e um `resumoOpcoes` igual a `M · Margherita / Quatro Queijos`.
  - **`CarrinhoSheet`:**
    - lista os itens com resumo, observação e subtotal;
    - o total sai em `formatarReais`;
    - `−` com quantidade 1 remove o item;
    - carrinho vazio mostra `Seu pedido está vazio`;
    - o botão `Enviar pedido` fica desabilitado, com o texto `O envio para o garçom chega na próxima versão.`
- [ ] **Passo 2:** Rodar. Esperado: FAIL.
- [ ] **Passo 3:** Implementar:
  - grupo `UNICA` vira radio;
  - `SABORES` e `MULTIPLA` viram checkbox, que desabilita as opções restantes ao atingir o `max`;
  - preço ao vivo via `precoUnitario × quantidade`.
- [ ] **Passo 4:** Rodar `pnpm --filter cliente test` (suíte inteira). Esperado: PASS.
- [ ] **Passo 5:** Commit: `feat(cliente): option picker and local cart sheet`.

### Task 8: Vídeos da demo e verificação no celular

**Arquivos:**
- Criar: `apps/cliente/scripts/preparar-videos.mjs`, `apps/cliente/videos-brutos/.gitkeep` (a pasta `videos-brutos/*.mp4` fica no gitignore)
- Criar: `apps/cliente/public/demo/videos/*.mp4` e `*.jpg` (gerados, commitados, com no máximo 3 MB cada)
- Modificar: `apps/api/prisma/seed.ts`. Os pratos com vídeo ganham `videoUrl: '/demo/videos/<slug>.mp4'` e `posterUrl: '/demo/videos/<slug>.jpg'`. Slugs: `mix-da-casa`, `pizza-margherita`, `parmegiana-da-casa`, `picanha-na-chapa`, `chopp-500ml`, `petit-gateau`.
- Modificar: `package.json` raiz, com os scripts `dev:api` e `dev:cliente`. Modificar também o `README.md`, com a seção "Ver no celular".
- Testes: `apps/api/test/seed.e2e-spec.ts` (novo caso)

**Interfaces:**
- Produz `node scripts/preparar-videos.mjs [--placeholder]`:
  - **para cada `videos-brutos/<slug>.mp4`:**
    - gera `public/demo/videos/<slug>.mp4` com `ffmpeg -i in -t 12 -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" -c:v libx264 -profile:v main -crf 28 -preset slow -c:a aac -b:a 96k -movflags +faststart`;
    - gera o poster `<slug>.jpg` com `-ss 1 -frames:v 1 -q:v 4`;
  - **`--placeholder`:** gera os 6 slugs com `-f lavfi -i gradients=s=720x1280:d=8:speed=0.02`, para a demo funcionar sem os vídeos reais.

- [ ] **Passo 1:** Escrever o caso que falha em `seed.e2e-spec.ts`: "Mix da Casa" tem `videoUrl === '/demo/videos/mix-da-casa.mp4'` e `posterUrl === '/demo/videos/mix-da-casa.jpg'`.
- [ ] **Passo 2:** Rodar `pnpm --filter api test:e2e`. Esperado: FAIL.
- [ ] **Passo 3:** Atualizar o seed com os 6 slugs. Rodar de novo. Esperado: PASS.
- [ ] **Passo 4:** Criar o script e rodar `node scripts/preparar-videos.mjs --placeholder`.
  - Verificar com `ls -la public/demo/videos`: devem existir 6 `.mp4` e 6 `.jpg`, cada `.mp4` com até 3 MB.
- [ ] **Passo 5:** Rodar `pnpm --filter api db:seed`, `pnpm dev:api` e `pnpm dev:cliente`. Abrir `http://<ip-da-máquina>:5173/m/<token-da-mesa-7>` num celular na mesma rede e conferir:
  - a lista bate com o mockup;
  - o story toca mudo, desliza, pausa e liga o som;
  - o seletor da pizza funciona;
  - o carrinho persiste ao recarregar.
  - Registrar o resultado no ledger.
- [ ] **Passo 6:** Commit: `feat: demo videos pipeline and seeded video urls`.

---

## Fim da etapa

- `pnpm --filter api test && pnpm --filter api test:e2e && pnpm --filter cliente test` — tudo verde.
- `pnpm --filter cliente build` sem erros de tipo.
- Entregar ao dono do projeto:
  - resumo para revisão;
  - como abrir no celular;
  - decisões tomadas;
  - pedido dos **vídeos reais**: colocar 6 vídeos verticais em `apps/cliente/videos-brutos/<slug>.mp4` (Pexels ou gravados) e rodar o script sem `--placeholder`.
- **Parar e aguardar aprovação.**

# Etapa 0 — Fundação: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** Criar a base do monorepo: API NestJS com healthcheck, Postgres via Docker, o schema de cardápio no Prisma e um restaurante de demonstração populado pelo seed.

**Arquitetura:**
- Monorepo pnpm, com `apps/api` (NestJS) por enquanto. Os apps de front entram na Etapa 1.
- Postgres roda em Docker Compose, com um banco de desenvolvimento e outro de teste.
- O Prisma cuida do schema, das migrations e do seed.
- Os testes e2e rodam contra o banco de teste real.

**Stack:** Node 24, pnpm (via corepack), TypeScript, NestJS 11, Prisma 6.x (versão fixada), PostgreSQL 17, Jest + Supertest, dotenv-cli.

**Spec:** `docs/superpowers/specs/2026-11-04-cardapio-digital-design.md`

## Restrições globais

- TypeScript em tudo, com `strict: true`.
- **Dinheiro sempre em centavos inteiros** (`Int`, sufixo `Centavos`). Nunca usar float. Ex.: R$ 59,90 vira `5990`.
- **Toda tabela de negócio tem `restauranteId`** (multi-tenant).
- **O token da mesa é aleatório e não sequencial:** 16 bytes de `crypto.randomBytes`, em base64url (22 caracteres), único no banco.
- Nomes de domínio em português (`Restaurante`, `Mesa`, `Prato`). Código técnico em inglês só quando for convenção do framework.
- Postgres exposto na **porta 5433 do host**, para evitar conflito com um Postgres local no Windows.
- Scripts têm de funcionar no Windows (PowerShell e Git Bash). Nada de `VAR=x cmd`; usar `dotenv-cli`.
- **Ao fim da etapa: parar para a revisão do dono do projeto.** Não seguir para a Etapa 1 sem aprovação.
- Toda mensagem de commit termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Foco de revisão

1. **Postgres fora do ar:** `GET /health` responde 503 com `{ status: 'erro', db: 'fora' }`, sem derrubar o processo. → Task 3
2. **Seed rodado duas vezes** não duplica restaurante, mesas nem pratos. → Task 4
3. **Faltando `DATABASE_URL`:** a API falha na subida com mensagem clara que cita a variável. → Task 2
4. **Preço com desconto e centavos exatos:** o seed guarda `5990` e `6990`, não `59.9`. → Task 4
5. **Tokens de mesa** únicos entre restaurantes e no formato `^[A-Za-z0-9_-]{22}$`. → Task 4

---

### Task 1: Monorepo, Docker e git

**Arquivos:**
- Criar: `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `docker-compose.yml`, `docker/postgres/init.sql`, `.env.example`, `README.md`

**Interfaces:**
- Produz:
  - Postgres em `localhost:5433`, usuário/senha `cardapio`/`cardapio`;
  - bancos `cardapio` (dev) e `cardapio_test` (teste);
  - workspace `apps/*`, `packages/*`.

- [ ] **Passo 1:** `git init`. O `.gitignore` cobre `node_modules`, `dist`, `.env`, `.env.test`, `coverage`.
- [ ] **Passo 2:** `corepack enable pnpm`.
  - Verificar: `pnpm -v` imprime uma versão.
  - Se corepack não existir, usar `npm i -g pnpm`.
- [ ] **Passo 3:** Criar o `package.json` raiz:
  - `"private": true`;
  - `packageManager` com a versão do pnpm instalada;
  - scripts `db:up` (`docker compose up -d`) e `db:down`.
- [ ] **Passo 4:** Criar o `docker-compose.yml`:
  - serviço `postgres` com imagem `postgres:17`, porta `5433:5432`, volume nomeado;
  - montar `docker/postgres/init.sql`, que roda `CREATE DATABASE cardapio_test;`.
- [ ] **Passo 5:** Rodar `pnpm db:up` e depois `docker compose exec postgres psql -U cardapio -c "\l"`.
  - Esperado: a lista contém `cardapio` e `cardapio_test`.
- [ ] **Passo 6:** Criar o `.env.example` com:
  - `DATABASE_URL=postgresql://cardapio:cardapio@localhost:5433/cardapio`
  - `PORT=3000`

  O `README.md` deve ter um "como rodar" de 5 linhas.
- [ ] **Passo 7:** Commit:
  - incluir `docs/` (spec, plano) e `first_preview.md`;
  - incluir `images/`;
  - mensagem: `chore: bootstrap monorepo with postgres docker`.

### Task 2: API NestJS com validação de ambiente e `/health`

**Arquivos:**
- Criar: `apps/api/` (estrutura padrão do Nest CLI, sem o exemplo `app.controller`)
- Criar: `apps/api/src/config/env.ts`
- Criar: `apps/api/src/health/health.module.ts`, `apps/api/src/health/health.controller.ts`
- Testes: `apps/api/src/config/env.spec.ts`, `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Produz `validarEnv(raw: Record<string, unknown>): Env`, com:
  - `Env = { DATABASE_URL: string; PORT: number }`;
  - `PORT` padrão `3000`;
  - usado em `ConfigModule.forRoot({ validate: validarEnv })`.
- Produz `GET /health`, que nesta task devolve `200 { status: 'ok' }`.

- [ ] **Passo 1:** Gerar o projeto com `pnpm dlx @nestjs/cli@11 new api --directory apps/api --package-manager pnpm --skip-git`. Remover o controller e o service de exemplo.
- [ ] **Passo 2:** Escrever o teste unitário que falha (`env.spec.ts`):

```ts
it('falha sem DATABASE_URL citando a variável', () => {
  expect(() => validarEnv({})).toThrow(/DATABASE_URL/);
});
it('aplica PORT padrão 3000', () => {
  expect(validarEnv({ DATABASE_URL: 'postgresql://x' }).PORT).toBe(3000);
});
it('converte PORT string em número', () => {
  expect(validarEnv({ DATABASE_URL: 'postgresql://x', PORT: '4000' }).PORT).toBe(4000);
});
```

- [ ] **Passo 3:** Rodar `pnpm --filter api test env`. Esperado: FAIL (`validarEnv` não existe).
- [ ] **Passo 4:** Implementar `validarEnv` com `zod`. A mensagem de erro deve listar o nome das variáveis inválidas.
- [ ] **Passo 5:** Rodar `pnpm --filter api test env`. Esperado: PASS.
- [ ] **Passo 6:** Escrever o e2e que falha (`health.e2e-spec.ts`): `GET /health` → `200`, corpo `{ status: 'ok' }`.
- [ ] **Passo 7:** Configurar as variáveis dos testes:
  - criar `apps/api/.env.test` (no gitignore) e o `.env.test.example`, apontando para `cardapio_test`;
  - o script `test:e2e` usa `dotenv -e .env.test -- jest --config test/jest-e2e.json`.
- [ ] **Passo 8:** Implementar o `HealthModule` e o `HealthController` e registrar no `AppModule` junto com o `ConfigModule`.
- [ ] **Passo 9:** Rodar `pnpm --filter api test:e2e`. Esperado: PASS.
- [ ] **Passo 10:** Commit: `feat(api): nest app with env validation and health endpoint`.

### Task 3: Prisma — schema do cardápio e healthcheck do banco

**Arquivos:**
- Criar: `apps/api/prisma/schema.prisma`, `apps/api/src/prisma/prisma.module.ts`, `apps/api/src/prisma/prisma.service.ts`
- Modificar: `apps/api/src/health/health.controller.ts`
- Testes: `apps/api/test/health.e2e-spec.ts`, `apps/api/src/health/health.controller.spec.ts`

**Interfaces:**
- Produz `PrismaService extends PrismaClient`:
  - fica num módulo `@Global()`;
  - `onModuleInit` **não** chama `$connect` (o Prisma conecta de forma lazy, então a API sobe mesmo com o banco fora).
- Produz `GET /health`:
  - `200 { status: 'ok', db: 'ok' }`;
  - ou `503 { status: 'erro', db: 'fora' }`;
  - a checagem é `SELECT 1` via `$queryRaw`.
- Produz os modelos abaixo, usados pela Task 4 e pela Etapa 1. Todos têm `id String @id @default(uuid())`, `criadoEm DateTime @default(now())` e `restauranteId` com relação:
  - `Restaurante`: `nome`, `slug @unique`, `logoUrl?`, `wifiSsid?`, `wifiSenha?`, `googleAvaliacaoUrl?` (é a raiz, então não tem `restauranteId`).
  - `Mesa`: `numero Int`, `token String @unique`. `@@unique([restauranteId, numero])`.
  - `Categoria`: `nome`, `ordem Int`.
  - `Prato`:
    - `categoriaId`, `nome`, `descricao`, `precoCentavos Int`, `precoPromocionalCentavos Int?`;
    - `destaque Boolean @default(false)`, `esgotado Boolean @default(false)`;
    - `videoUrl?`, `posterUrl?`, `ordem Int`.
  - `GrupoOpcao`:
    - `pratoId`, `nome`, `tipo TipoGrupoOpcao`, `obrigatorio Boolean`, `min Int`, `max Int`, `ordem Int`;
    - enum `TipoGrupoOpcao { UNICA MULTIPLA SABORES }`.
  - `Opcao`: `grupoId`, `nome`, `precoCentavos Int`, `precoPromocionalCentavos Int?`, `ordem Int`.
    - Em `UNICA`, o preço da opção é o preço do item.
    - Em `MULTIPLA`, é um acréscimo.
    - Em `SABORES`, é o preço do sabor.
  - Relações com `onDelete: Cascade` a partir de `Restaurante`.
  - Nomes dos campos de relação: `Restaurante.mesas/categorias/pratos`, `Categoria.pratos`, `Prato.grupos`, `GrupoOpcao.opcoes`.

- [ ] **Passo 1:** Instalar `prisma@6` (dev) e `@prisma/client@6`. Rodar `pnpm --filter api exec prisma init` e apontar para `env("DATABASE_URL")`.
- [ ] **Passo 2:** Escrever o schema acima. Rodar `pnpm --filter api exec prisma migrate dev --name cardapio_inicial`.
  - Esperado: migration criada e aplicada em `cardapio`.
- [ ] **Passo 3:** Atualizar o e2e: `GET /health` → `200 { status: 'ok', db: 'ok' }`.
  - Adicionar um `globalSetup` do jest-e2e que roda `prisma migrate reset --force --skip-seed` no banco de teste.
- [ ] **Passo 4:** Escrever o teste unitário que falha (`health.controller.spec.ts`):
  - usar um `PrismaService` mockado cujo `$queryRaw` rejeita;
  - esperar que a resposta tenha status `503` e corpo `{ status: 'erro', db: 'fora' }`.
- [ ] **Passo 5:** Rodar os testes. Esperado: FAIL.
- [ ] **Passo 6:** Implementar `PrismaModule`/`PrismaService` e a checagem no `HealthController`. O 503 sai via `@Res({ passthrough: true })` ou `ServiceUnavailableException` com esse corpo.
- [ ] **Passo 7:** Rodar `pnpm --filter api test` e `pnpm --filter api test:e2e`. Esperado: PASS.
- [ ] **Passo 8:** Commit: `feat(api): prisma menu schema and db health check`.

### Task 4: Token de mesa e seed do restaurante de demonstração

**Arquivos:**
- Criar: `apps/api/src/mesas/token.ts`, `apps/api/prisma/seed.ts`
- Modificar: `apps/api/package.json` (`"prisma": { "seed": "ts-node prisma/seed.ts" }`, script `db:seed`)
- Testes: `apps/api/src/mesas/token.spec.ts`, `apps/api/test/seed.e2e-spec.ts`

**Interfaces:**
- Produz `gerarTokenMesa(): string`, que devolve `randomBytes(16).toString('base64url')`.
- Produz `seedDemo(prisma: PrismaClient): Promise<{ restauranteId: string }>`. Ela é exportada de `seed.ts` e chamada pelo `main` do mesmo arquivo.
- Restaurante demo `slug: 'demo'`, com o conteúdo abaixo. A Etapa 1 usa esses dados.

- [ ] **Passo 1:** Escrever o teste que falha (`token.spec.ts`):

```ts
it('gera token base64url de 22 caracteres', () => {
  expect(gerarTokenMesa()).toMatch(/^[A-Za-z0-9_-]{22}$/);
});
it('não repete em 1000 gerações', () => {
  const s = new Set(Array.from({ length: 1000 }, gerarTokenMesa));
  expect(s.size).toBe(1000);
});
```

- [ ] **Passo 2:** Rodar, ver FAIL, implementar, ver PASS.
- [ ] **Passo 3:** Escrever o e2e que falha (`seed.e2e-spec.ts`), no banco de teste:

```ts
it('é idempotente e grava centavos exatos', async () => {
  await seedDemo(prisma);
  await seedDemo(prisma);
  expect(await prisma.restaurante.count({ where: { slug: 'demo' } })).toBe(1);
  expect(await prisma.mesa.count()).toBe(10);
  const mix = await prisma.prato.findFirstOrThrow({ where: { nome: 'Mix da Casa' } });
  expect(mix.precoCentavos).toBe(6990);
  expect(mix.precoPromocionalCentavos).toBe(5990);
  expect(mix.destaque).toBe(true);
  const tokens = (await prisma.mesa.findMany()).map((m) => m.token);
  tokens.forEach((t) => expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/));
});
it('pizza tem Tamanho (UNICA, obrigatório) e Sabores (SABORES, max 2)', async () => {
  const pizza = await prisma.prato.findFirstOrThrow({
    where: { nome: 'Pizza Margherita' }, include: { grupos: { include: { opcoes: true } } },
  });
  const tamanho = pizza.grupos.find((g) => g.nome === 'Tamanho')!;
  expect(tamanho.tipo).toBe('UNICA');
  expect(tamanho.obrigatorio).toBe(true);
  expect(tamanho.opcoes.map((o) => o.nome)).toEqual(['P', 'M', 'G']);
  expect(pizza.grupos.find((g) => g.nome === 'Sabores')!.max).toBe(2);
});
```

- [ ] **Passo 4:** Rodar, ver FAIL.
- [ ] **Passo 5:** Implementar `seedDemo`.
  - **Idempotência:** apagar o restaurante `slug: 'demo'` (cascade) e recriar tudo dentro de uma `$transaction`.
  - **Conteúdo:**
    - restaurante **"Cantina Demo"**, com Wi-Fi `Cantina-Clientes` / `bemvindo123` e `googleAvaliacaoUrl` `https://g.page/r/demo/review`;
    - **10 mesas** (1–10) com `gerarTokenMesa()`.
  - **Categorias:** Entradas, Pizzas, Pratos, Bebidas, Sobremesas.
  - **Pratos:** cerca de 12, sem vídeo por enquanto (`videoUrl` nulo). Incluir obrigatoriamente:
    - **"Mix da Casa"** (Entradas): `6990` com promocional `5990`, destaque;
    - **"Pizza Margherita"** (Pizzas):
      - `precoCentavos` `0`, porque o preço vem do tamanho;
      - grupo `Tamanho` (`UNICA`, obrigatório, min 1, max 1) com P `4990`, M `6990`, G `8990`;
      - grupo `Sabores` (`SABORES`, min 1, max 2) com 3 sabores;
      - grupo `Adicionais` (`MULTIPLA`, min 0, max 3) com Borda recheada `1200`, Bacon `800`;
    - pelo menos 1 prato `esgotado: true`;
    - pelo menos 1 bebida com promoção.
- [ ] **Passo 6:** Rodar `pnpm --filter api test:e2e`. Esperado: PASS.
- [ ] **Passo 7:** Rodar `pnpm --filter api db:seed` no banco de dev.
  - Depois, `docker compose exec postgres psql -U cardapio -d cardapio -c "select numero, token from \"Mesa\" order by numero"`.
  - Esperado: 10 linhas com tokens distintos.
- [ ] **Passo 8:** Commit: `feat(api): table token generator and demo restaurant seed`.

---

## Fim da etapa

- Rodar `pnpm --filter api test && pnpm --filter api test:e2e`. Tudo tem de passar.
- Subir a API com `pnpm --filter api start:dev` e chamar `curl localhost:3000/health`.
- Entregar ao dono do projeto um resumo para revisão: o que foi feito, como rodar, decisões tomadas durante a implementação. **Parar e aguardar aprovação.**

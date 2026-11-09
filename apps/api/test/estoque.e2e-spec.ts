import request from 'supertest';
import { aplicarMovimentos } from '../src/estoque/movimentos';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

type Item = { id: string; nome: string; quantidade: number; nivel: string };
type Corpo = {
  id: string;
  mensagem: string;
  perdasHoje: unknown[];
  desfazivel: unknown;
  fornecedor: unknown;
};
const corpo = (r: { body: unknown }) => r.body as Corpo;
const lista = (r: { body: unknown }) => r.body as (Item & Corpo)[];

describe('estoque', () => {
  let t: AppTeste;
  let dono: string;
  let ana: string;
  let cozinha: string;

  beforeAll(async () => {
    t = await criarAppTeste();
    dono = await loginComo(t.app, 'dono@demo.com');
    ana = await loginComo(t.app, 'ana@demo.com');
    cozinha = await loginComo(t.app, 'cozinha@demo.com');
  });

  beforeEach(async () => {
    await t.prisma.movimentoEstoque.deleteMany();
    await t.prisma.receitaItem.deleteMany();
    await t.prisma.listaCompra.deleteMany();
    await t.prisma.itemEstoque.deleteMany();
    await t.prisma.fornecedor.deleteMany();
    await t.prisma.evento.deleteMany();
  });

  afterAll(async () => {
    await t.prisma.restaurante.deleteMany({ where: { slug: 'outro-estoque' } });
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());
  const criar = async (corpo: Record<string, unknown>): Promise<Item> =>
    (
      await http()
        .post('/equipe/estoque/itens')
        .set('Cookie', dono)
        .send({ unidade: 'UN', minimo: 0, cheio: 0, ...corpo })
        .expect(201)
    ).body as Item;
  const item = (id: string) =>
    t.prisma.itemEstoque.findUniqueOrThrow({ where: { id } });
  const resumo = async () =>
    (await http().get('/equipe/estoque').set('Cookie', dono).expect(200))
      .body as {
      acabando: Item[];
      acabou: (Item & { pratos: { nome: string; esgotado: boolean }[] })[];
      perdasHoje: { nome: string; quantidade: number; motivo: string }[];
    };
  const perda = (cookie: string, corpo: Record<string, unknown>) =>
    http().post('/equipe/estoque/perdas').set('Cookie', cookie).send(corpo);

  it('garçom não cria item (403)', async () => {
    await http()
      .post('/equipe/estoque/itens')
      .set('Cookie', ana)
      .send({ nome: 'Ovos', unidade: 'UN', minimo: 0, cheio: 0 })
      .expect(403);
  });

  it('dono cria item com quantidade inicial e ele aparece no resumo quando abaixo do mínimo', async () => {
    const ovos = await criar({ nome: 'Ovos', quantidade: 20, minimo: 30 });
    expect(ovos.quantidade).toBe(20);
    const r = await resumo();
    expect(r.acabando.map((i) => i.nome)).toEqual(['Ovos']);
    const movs = await t.prisma.movimentoEstoque.findMany();
    expect(movs).toMatchObject([{ tipo: 'ENTRADA', quantidade: 20 }]);
  });

  it('nome repetido dá 409', async () => {
    await criar({ nome: 'Ovos' });
    const res = await http()
      .post('/equipe/estoque/itens')
      .set('Cookie', dono)
      .send({ nome: 'Ovos', unidade: 'UN', minimo: 0, cheio: 0 })
      .expect(409);
    expect(corpo(res).mensagem).toBe('Já existe um item com esse nome');
  });

  it('contagem grava a diferença', async () => {
    const ovos = await criar({ nome: 'Ovos', quantidade: 50 });
    await http()
      .post(`/equipe/estoque/itens/${ovos.id}/contagem`)
      .set('Cookie', dono)
      .send({ quantidade: 47 })
      .expect(200);
    expect((await item(ovos.id)).quantidade).toBe(47);
    const mov = await t.prisma.movimentoEstoque.findFirstOrThrow({
      where: { tipo: 'CONTAGEM' },
    });
    expect(mov.quantidade).toBe(-3);
  });

  it('contagem 0 em item negativo grava diferença positiva', async () => {
    const ovos = await criar({ nome: 'Ovos' });
    await t.prisma.itemEstoque.update({
      where: { id: ovos.id },
      data: { quantidade: -4 },
    });
    await http()
      .post(`/equipe/estoque/itens/${ovos.id}/contagem`)
      .set('Cookie', dono)
      .send({ quantidade: 0 })
      .expect(200);
    const mov = await t.prisma.movimentoEstoque.findFirstOrThrow({
      where: { tipo: 'CONTAGEM' },
    });
    expect(mov.quantidade).toBe(4);
    expect((await item(ovos.id)).quantidade).toBe(0);
  });

  it('cozinha avisa perda: baixa, evento PerdaRegistrada e aparece em perdasHoje sem nome', async () => {
    const ovos = await criar({ nome: 'Ovos', quantidade: 90 });
    await perda(cozinha, {
      itemId: ovos.id,
      quantidade: 30,
      motivo: 'ACIDENTE',
    }).expect(200);
    expect((await item(ovos.id)).quantidade).toBe(60);
    expect(
      await t.prisma.evento.count({ where: { tipo: 'PerdaRegistrada' } }),
    ).toBe(1);
    const res = await http()
      .get('/equipe/estoque')
      .set('Cookie', dono)
      .expect(200);
    expect(corpo(res).perdasHoje).toMatchObject([
      { nome: 'Ovos', quantidade: 30, motivo: 'ACIDENTE' },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('Dani');
  });

  it('perda OUTRO sem observação dá 422', async () => {
    const ovos = await criar({ nome: 'Ovos', quantidade: 10 });
    const res = await perda(ana, {
      itemId: ovos.id,
      quantidade: 1,
      motivo: 'OUTRO',
    }).expect(422);
    expect(corpo(res).mensagem).toBe('Conte o que aconteceu');
  });

  it('itens?ordem=perdas põe o item com mais perdas primeiro', async () => {
    await criar({ nome: 'Arroz', quantidade: 100 });
    const ovos = await criar({ nome: 'Ovos', quantidade: 100 });
    await perda(ana, { itemId: ovos.id, quantidade: 1, motivo: 'ACIDENTE' });
    const res = await http()
      .get('/equipe/estoque/itens?ordem=perdas')
      .set('Cookie', cozinha)
      .expect(200);
    expect(lista(res).map((i: Item) => i.nome)).toEqual(['Ovos', 'Arroz']);
    const alfabetica = await http()
      .get('/equipe/estoque/itens')
      .set('Cookie', cozinha)
      .expect(200);
    expect(lista(alfabetica).map((i: Item) => i.nome)).toEqual([
      'Arroz',
      'Ovos',
    ]);
  });

  it('vendas seguidas abaixo do mínimo avisam uma vez só', async () => {
    const ovos = await criar({ nome: 'Ovos', quantidade: 50, minimo: 46 });
    const prisma = t.app.get(PrismaService);
    const vender = (q: number) =>
      prisma.$transaction((tx) =>
        aplicarMovimentos(tx, t.restauranteId, null, [
          { itemId: ovos.id, tipo: 'VENDA', quantidade: q },
        ]),
      );
    expect(await vender(-5)).toMatchObject([
      { tipo: 'ACABANDO', itemId: ovos.id, nome: 'Ovos' },
    ]);
    expect(await vender(-5)).toEqual([]);
    expect(await vender(-40)).toMatchObject([{ tipo: 'ZERADO' }]);
    expect(await vender(-1)).toEqual([]);
    expect(await vender(100)).toEqual([]);
    expect((await item(ovos.id)).nivel).toBe('OK');
  });

  it('acabou lista os pratos que usam o item', async () => {
    const ovos = await criar({ nome: 'Ovos', quantidade: 0 });
    const mix = await t.prisma.prato.findFirstOrThrow({
      where: { nome: 'Mix da Casa', restauranteId: t.restauranteId },
    });
    await t.prisma.receitaItem.create({
      data: {
        restauranteId: t.restauranteId,
        pratoId: mix.id,
        itemId: ovos.id,
        quantidade: 2,
      },
    });
    await t.prisma.itemEstoque.update({
      where: { id: ovos.id },
      data: { quantidade: 5, nivel: 'OK' },
    });
    await perda(ana, {
      itemId: ovos.id,
      quantidade: 5,
      motivo: 'VALIDADE',
    }).expect(200);
    const r = await resumo();
    expect(r.acabou).toHaveLength(1);
    expect(r.acabou[0].pratos).toEqual([
      { id: mix.id, nome: 'Mix da Casa', esgotado: false },
    ]);
  });

  it('desfazer volta a perda da própria pessoa e some do resumo', async () => {
    const ovos = await criar({ nome: 'Ovos', quantidade: 90 });
    await perda(ana, { itemId: ovos.id, quantidade: 30, motivo: 'ACIDENTE' });
    const d = await http()
      .get('/equipe/estoque/desfazer')
      .set('Cookie', ana)
      .expect(200);
    expect(corpo(d).desfazivel).toMatchObject({
      descricao: 'Perda: 30 un de Ovos',
    });
    await http()
      .post('/equipe/estoque/desfazer')
      .set('Cookie', ana)
      .expect(200);
    expect((await item(ovos.id)).quantidade).toBe(90);
    expect((await resumo()).perdasHoje).toEqual([]);
    await http()
      .post('/equipe/estoque/desfazer')
      .set('Cookie', ana)
      .expect(409);
  });

  it('desfazer não pega lote de outra pessoa nem depois de 10 min', async () => {
    const ovos = await criar({ nome: 'Ovos', quantidade: 90 });
    await perda(ana, { itemId: ovos.id, quantidade: 3, motivo: 'ACIDENTE' });
    const outra = await http()
      .post('/equipe/estoque/desfazer')
      .set('Cookie', cozinha)
      .expect(409);
    expect(corpo(outra).mensagem).toBe('Nada para desfazer');
    await t.prisma.movimentoEstoque.updateMany({
      data: { criadoEm: new Date(Date.now() - 11 * 60_000) },
    });
    await http()
      .post('/equipe/estoque/desfazer')
      .set('Cookie', ana)
      .expect(409);
    expect((await item(ovos.id)).quantidade).toBe(87);
  });

  it('entrada de vários itens e desfazer volta o lote inteiro', async () => {
    const ovos = await criar({ nome: 'Ovos' });
    const sal = await criar({ nome: 'Sal', unidade: 'G' });
    await http()
      .post('/equipe/estoque/entradas')
      .set('Cookie', dono)
      .send({
        itens: [
          { itemId: ovos.id, quantidade: 30 },
          { itemId: sal.id, quantidade: 1000 },
        ],
      })
      .expect(200);
    expect((await item(sal.id)).quantidade).toBe(1000);
    await http()
      .post('/equipe/estoque/desfazer')
      .set('Cookie', dono)
      .expect(200);
    expect((await item(ovos.id)).quantidade).toBe(0);
    expect((await item(sal.id)).quantidade).toBe(0);
  });

  it('arquivar item tira das receitas e do GET itens', async () => {
    const ovos = await criar({ nome: 'Ovos' });
    const mix = await t.prisma.prato.findFirstOrThrow({
      where: { nome: 'Mix da Casa', restauranteId: t.restauranteId },
    });
    await t.prisma.receitaItem.create({
      data: {
        restauranteId: t.restauranteId,
        pratoId: mix.id,
        itemId: ovos.id,
        quantidade: 2,
      },
    });
    await http()
      .delete(`/equipe/estoque/itens/${ovos.id}`)
      .set('Cookie', dono)
      .expect(204);
    expect(await t.prisma.receitaItem.count()).toBe(0);
    const res = await http()
      .get('/equipe/estoque/itens')
      .set('Cookie', dono)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('mudar unidade de item com movimento dá 409', async () => {
    const ovos = await criar({ nome: 'Ovos', quantidade: 10 });
    const res = await http()
      .patch(`/equipe/estoque/itens/${ovos.id}`)
      .set('Cookie', dono)
      .send({ unidade: 'G' })
      .expect(409);
    expect(corpo(res).mensagem).toBe(
      'Não dá para mudar a unidade de um item que já tem movimentos',
    );
    await http()
      .patch(`/equipe/estoque/itens/${ovos.id}`)
      .set('Cookie', dono)
      .send({ minimo: 12, embalagemNome: 'Cartela', embalagemQuantidade: 30 })
      .expect(200);
    expect(await item(ovos.id)).toMatchObject({
      minimo: 12,
      embalagemNome: 'Cartela',
    });
  });

  it('fornecedor: cria, liga ao item e excluir deixa o item sem fornecedor', async () => {
    const f = await http()
      .post('/equipe/estoque/fornecedores')
      .set('Cookie', dono)
      .send({ nome: 'Granja Boa', telefone: '11900000001' })
      .expect(201);
    const ovos = await criar({ nome: 'Ovos', fornecedorId: corpo(f).id });
    const todos = await http()
      .get('/equipe/estoque/itens')
      .set('Cookie', dono)
      .expect(200);
    expect(lista(todos).at(0)?.fornecedor).toEqual({
      id: corpo(f).id,
      nome: 'Granja Boa',
    });
    await http()
      .delete(`/equipe/estoque/fornecedores/${corpo(f).id}`)
      .set('Cookie', dono)
      .expect(204);
    expect((await item(ovos.id)).fornecedorId).toBeNull();
  });

  it('outro restaurante não vê nem mexe no item (404)', async () => {
    const outro = await t.prisma.restaurante.create({
      data: { nome: 'Outro', slug: 'outro-estoque' },
    });
    const alheio = await t.prisma.itemEstoque.create({
      data: { restauranteId: outro.id, nome: 'Ovos', unidade: 'UN' },
    });
    await http()
      .post(`/equipe/estoque/itens/${alheio.id}/contagem`)
      .set('Cookie', dono)
      .send({ quantidade: 1 })
      .expect(404);
    await perda(ana, {
      itemId: alheio.id,
      quantidade: 1,
      motivo: 'ACIDENTE',
    }).expect(404);
  });
});

import ExcelJS from 'exceljs';
import request from 'supertest';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

type Linha = {
  itemId: string;
  nome: string;
  quantidade: number;
  texto: string;
};
type Grupo = { fornecedor: { nome: string } | null; itens: Linha[] };
type Lista = {
  id: string;
  restaurante: string;
  grupos: Grupo[];
  chegouEm: string | null;
};

/** Supertest não lê binário sozinho: junta os pedaços num Buffer. */
function binario(
  res: unknown,
  pronto: (erro: Error | null, corpo: unknown) => void,
) {
  const fluxo = res as NodeJS.ReadableStream;
  const partes: Buffer[] = [];
  fluxo.on('data', (p: Buffer) => partes.push(p));
  fluxo.on('end', () => pronto(null, Buffer.concat(partes)));
}

describe('lista de compras', () => {
  let t: AppTeste;
  let dono: string;
  let ana: string;
  let ovos: string;
  let chopp: string;

  beforeAll(async () => {
    t = await criarAppTeste();
    dono = await loginComo(t.app, 'dono@demo.com');
    ana = await loginComo(t.app, 'ana@demo.com');
  });

  beforeEach(async () => {
    await t.prisma.movimentoEstoque.deleteMany();
    await t.prisma.receitaItem.deleteMany();
    await t.prisma.listaCompra.deleteMany();
    await t.prisma.itemEstoque.deleteMany();
    await t.prisma.fornecedor.deleteMany();
    const r = t.restauranteId;
    const granja = await t.prisma.fornecedor.create({
      data: { restauranteId: r, nome: 'Granja Boa', telefone: '11900000001' },
    });
    const bebidas = await t.prisma.fornecedor.create({
      data: { restauranteId: r, nome: 'Bebidas SA' },
    });
    ovos = (
      await t.prisma.itemEstoque.create({
        data: {
          restauranteId: r,
          nome: 'Ovos',
          unidade: 'UN',
          quantidade: 10,
          minimo: 30,
          cheio: 120,
          nivel: 'ACABANDO',
          fornecedorId: granja.id,
          embalagemNome: 'Cartela',
          embalagemQuantidade: 30,
        },
      })
    ).id;
    chopp = (
      await t.prisma.itemEstoque.create({
        data: {
          restauranteId: r,
          nome: 'Chopp',
          unidade: 'ML',
          quantidade: 5000,
          minimo: 10000,
          cheio: 50000,
          nivel: 'ACABANDO',
          fornecedorId: bebidas.id,
        },
      })
    ).id;
    await t.prisma.itemEstoque.create({
      data: {
        restauranteId: r,
        nome: 'Sal',
        unidade: 'G',
        quantidade: 5000,
        minimo: 1000,
        cheio: 5000,
      },
    });
  });

  afterAll(async () => {
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());
  const salvar = async (itens: { itemId: string; quantidade: number }[]) =>
    (
      await http()
        .post('/equipe/estoque/compras')
        .set('Cookie', dono)
        .send({ itens })
        .expect(201)
    ).body as Lista;
  const qtd = async (id: string) =>
    (await t.prisma.itemEstoque.findUniqueOrThrow({ where: { id } }))
      .quantidade;

  it('sugestão agrupa por fornecedor, arredonda para cartelas e ignora item acima do mínimo', async () => {
    const res = await http()
      .get('/equipe/estoque/compras/sugestao')
      .set('Cookie', dono)
      .expect(200);
    const grupos = res.body as Grupo[];
    expect(grupos.map((g) => g.fornecedor?.nome)).toEqual([
      'Bebidas SA',
      'Granja Boa',
    ]);
    expect(grupos[1].itens).toMatchObject([
      { nome: 'Ovos', quantidade: 120, texto: '4 Cartela (120 un)' },
    ]);
    expect(grupos[0].itens).toMatchObject([
      { nome: 'Chopp', quantidade: 45000, texto: '45 L' },
    ]);
    expect(JSON.stringify(grupos)).not.toContain('Sal');
  });

  it('salvar lista e baixar planilha com uma aba por fornecedor', async () => {
    const lista = await salvar([
      { itemId: ovos, quantidade: 120 },
      { itemId: chopp, quantidade: 45000 },
    ]);
    const restaurante = await t.prisma.restaurante.findUniqueOrThrow({
      where: { id: t.restauranteId },
    });
    expect(lista.restaurante).toBe(restaurante.nome);
    const res = await http()
      .get(`/equipe/estoque/compras/${lista.id}/planilha`)
      .set('Cookie', dono)
      .buffer(true)
      .parse(binario)
      .expect(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="lista-de-compras-\d{4}-\d{2}-\d{2}\.xlsx"/,
    );
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(res.body as Parameters<typeof livro.xlsx.load>[0]);
    expect(livro.worksheets.map((w) => w.name)).toEqual([
      'Bebidas SA',
      'Granja Boa',
    ]);
    const granja = livro.getWorksheet('Granja Boa')!;
    expect(granja.getRow(1).values).toEqual([
      undefined,
      'Item',
      'Quantidade',
      'Unidade',
      'Observação',
    ]);
    expect(granja.getRow(2).getCell(1).value).toBe('Ovos');
    expect(granja.getRow(2).getCell(2).value).toBe(4);
    expect(granja.getRow(2).getCell(3).value).toBe('Cartela (30 un)');
    const bebidas = livro.getWorksheet('Bebidas SA')!;
    expect(bebidas.getRow(2).getCell(2).value).toBe(45);
    expect(bebidas.getRow(2).getCell(3).value).toBe('L');
  });

  it('resumo mostra todas as compras abertas, a mais nova primeiro', async () => {
    const a = await salvar([{ itemId: ovos, quantidade: 30 }]);
    const b = await salvar([{ itemId: chopp, quantidade: 30000 }]);
    const res = await http()
      .get('/equipe/estoque')
      .set('Cookie', dono)
      .expect(200);
    expect(
      (res.body as { listasAbertas: { id: string }[] }).listasAbertas.map(
        (l) => l.id,
      ),
    ).toEqual([b.id, a.id]);
  });

  it('desfazer a chegada reabre a lista para lançar de novo', async () => {
    const lista = await salvar([{ itemId: ovos, quantidade: 120 }]);
    const chegou = () =>
      http()
        .post(`/equipe/estoque/compras/${lista.id}/chegou`)
        .set('Cookie', dono)
        .send({ itens: [{ itemId: ovos, quantidade: 120 }] });
    await chegou().expect(200);
    await http()
      .post('/equipe/estoque/desfazer')
      .set('Cookie', dono)
      .expect(200);
    expect(await qtd(ovos)).toBe(10);
    const reaberta = await t.prisma.listaCompra.findUniqueOrThrow({
      where: { id: lista.id },
    });
    expect(reaberta.chegouEm).toBeNull();
    await chegou().expect(200);
    expect(await qtd(ovos)).toBe(130);
  });

  it('compra chegou lança entrada, tira do acabando e não lança duas vezes', async () => {
    const lista = await salvar([{ itemId: ovos, quantidade: 120 }]);
    const aberta = await http()
      .get('/equipe/estoque')
      .set('Cookie', dono)
      .expect(200);
    expect(
      (aberta.body as { listasAbertas: { id: string }[] }).listasAbertas.map(
        (l) => l.id,
      ),
    ).toEqual([lista.id]);
    await http()
      .post(`/equipe/estoque/compras/${lista.id}/chegou`)
      .set('Cookie', dono)
      .send({ itens: [{ itemId: ovos, quantidade: 120 }] })
      .expect(200);
    expect(await qtd(ovos)).toBe(130);
    const item = await t.prisma.itemEstoque.findUniqueOrThrow({
      where: { id: ovos },
    });
    expect(item.nivel).toBe('OK');
    const segunda = await http()
      .post(`/equipe/estoque/compras/${lista.id}/chegou`)
      .set('Cookie', dono)
      .send({ itens: [{ itemId: ovos, quantidade: 120 }] })
      .expect(409);
    expect((segunda.body as { mensagem: string }).mensagem).toBe(
      'Esta compra já foi lançada',
    );
  });

  it('chegou com quantidade corrigida usa o valor informado', async () => {
    const lista = await salvar([
      { itemId: ovos, quantidade: 120 },
      { itemId: chopp, quantidade: 45000 },
    ]);
    await http()
      .post(`/equipe/estoque/compras/${lista.id}/chegou`)
      .set('Cookie', dono)
      .send({
        itens: [
          { itemId: ovos, quantidade: 90 },
          { itemId: chopp, quantidade: 0 },
        ],
      })
      .expect(200);
    expect(await qtd(ovos)).toBe(100);
    expect(await qtd(chopp)).toBe(5000);
  });

  it('GET da lista traz os grupos', async () => {
    const lista = await salvar([{ itemId: ovos, quantidade: 60 }]);
    const res = await http()
      .get(`/equipe/estoque/compras/${lista.id}`)
      .set('Cookie', dono)
      .expect(200);
    expect((res.body as Lista).grupos[0].itens[0].texto).toBe(
      '2 Cartela (60 un)',
    );
  });

  it('garçom não acessa compras (403)', async () => {
    await http()
      .get('/equipe/estoque/compras/sugestao')
      .set('Cookie', ana)
      .expect(403);
  });
});

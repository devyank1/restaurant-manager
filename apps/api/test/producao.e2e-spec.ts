import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { ESTACAO_PRONTA } from '../src/producao/producao.types';
import { TempoRealService } from '../src/tempo-real/tempo-real.service';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

type ItemProducao = {
  id: string;
  nome: string;
  observacao: string;
  quantidade: number;
  status: string;
};
type PedidoProducao = {
  rodadaId: string;
  mesa: { numero: number };
  garcomNome: string | null;
  cancelada: boolean;
  itens: ItemProducao[];
};
type Producao = { estacoes: string[]; pedidos: PedidoProducao[] };

describe('produção', () => {
  let t: AppTeste;
  let token7: string;
  let token8: string;
  let ana: string;
  let cozinha: string;
  let dono: string;
  let ids: { mix: string; suco: string; pudim: string };

  beforeAll(async () => {
    t = await criarAppTeste();
    const mesa = (numero: number) =>
      t.prisma.mesa.findFirstOrThrow({
        where: { restauranteId: t.restauranteId, numero },
      });
    token7 = (await mesa(7)).token;
    token8 = (await mesa(8)).token;
    const prato = async (nome: string) =>
      (await t.prisma.prato.findFirstOrThrow({ where: { nome } })).id;
    ids = {
      mix: await prato('Mix da Casa'),
      suco: await prato('Suco Natural'),
      pudim: await prato('Pudim de Leite'),
    };
    ana = await loginComo(t.app, 'ana@demo.com');
    cozinha = await loginComo(t.app, 'cozinha@demo.com');
    dono = await loginComo(t.app, 'dono@demo.com');
  });

  beforeEach(async () => {
    await t.prisma.sessaoMesa.deleteMany();
    await t.prisma.evento.deleteMany();
    await http()
      .patch('/equipe/turno')
      .set('Cookie', ana)
      .send({ emTurno: true });
  });

  afterAll(() => t.fechar());

  const http = () => request(t.app.getHttpServer());
  const item = (pratoId: string, observacao = '') => ({
    pratoId,
    selecao: {},
    observacao,
    quantidade: 1,
  });

  /** Cliente envia e a Ana confirma: a rodada entra na produção. */
  const pedido = async (token: string, ...itens: object[]) => {
    const c = request.agent(t.app.getHttpServer());
    await c.post(`/publico/mesas/${token}/entrar`).expect(200);
    for (const i of itens) {
      await c
        .post(`/publico/mesas/${token}/carrinho/itens`)
        .send(i)
        .expect(201);
    }
    const res = await c.post(`/publico/mesas/${token}/rodadas`).expect(201);
    const rodadaId = (res.body as { id: string }).id;
    await http()
      .post(`/equipe/rodadas/${rodadaId}/confirmar`)
      .set('Cookie', ana)
      .expect(200);
    return { rodadaId, cliente: c };
  };

  const fila = async (estacao: string, cookie = cozinha) =>
    (
      await http()
        .get('/equipe/producao')
        .query({ estacao })
        .set('Cookie', cookie)
        .expect(200)
    ).body as Producao;

  const mudarItem = (id: string, status: string) =>
    http()
      .patch(`/equipe/producao/itens/${id}`)
      .set('Cookie', cozinha)
      .send({ status });

  const mudarRodada = (id: string, estacao: string, status: string) =>
    http()
      .patch(`/equipe/producao/rodadas/${id}`)
      .set('Cookie', cozinha)
      .send({ estacao, status });

  it('cozinha lista só os itens da estação, em ordem de chegada', async () => {
    const primeiro = await pedido(
      token7,
      item(ids.mix, 'sem cebola'),
      item(ids.suco),
    );
    const segundo = await pedido(token8, item(ids.pudim));

    const cozinhaFila = await fila('Cozinha');
    expect(cozinhaFila.estacoes).toEqual(['Bar', 'Cozinha']);
    expect(cozinhaFila.pedidos.map((p) => p.rodadaId)).toEqual([
      primeiro.rodadaId,
      segundo.rodadaId,
    ]);
    expect(cozinhaFila.pedidos[0]).toMatchObject({
      mesa: { numero: 7 },
      garcomNome: 'Ana',
      cancelada: false,
      itens: [
        { nome: 'Mix da Casa', observacao: 'sem cebola', status: 'NA_FILA' },
      ],
    });

    const bar = await fila('Bar');
    expect(bar.pedidos).toHaveLength(1);
    expect(bar.pedidos[0].itens.map((i) => i.nome)).toEqual(['Suco Natural']);
  });

  it('produção manda esperadoMin da estação (o maior dos itens)', async () => {
    await t.prisma.itemRodada.deleteMany();
    const { rodadaId } = await pedido(token7, item(ids.mix), item(ids.pudim));
    const itens = await t.prisma.itemRodada.findMany({ where: { rodadaId } });
    await t.prisma.itemRodada.update({
      where: { id: itens.find((i) => i.pratoId === ids.mix)!.id },
      data: { tempoEsperadoMin: 25 },
    });
    await t.prisma.itemRodada.update({
      where: { id: itens.find((i) => i.pratoId === ids.pudim)!.id },
      data: { tempoEsperadoMin: 8 },
    });
    const [p] = (await fila('Cozinha')).pedidos as (PedidoProducao & {
      esperadoMin: number;
    })[];
    expect(p.esperadoMin).toBe(25);
  });

  it('estação desconhecida usa a primeira', async () => {
    await pedido(token7, item(ids.suco));
    const res = await fila('Churrasqueira');
    expect(res.pedidos[0].itens[0].nome).toBe('Suco Natural');
  });

  it('rodada aguardando garçom não aparece', async () => {
    await pedido(token7, item(ids.mix));
    const c = request.agent(t.app.getHttpServer());
    await c.post(`/publico/mesas/${token8}/entrar`).expect(200);
    await c
      .post(`/publico/mesas/${token8}/carrinho/itens`)
      .send(item(ids.pudim))
      .expect(201);
    await c.post(`/publico/mesas/${token8}/rodadas`).expect(201);
    const res = await fila('Cozinha');
    expect(res.pedidos.map((p) => p.mesa.numero)).toEqual([7]);
  });

  it('garçom recebe 403; dono e cozinha acessam', async () => {
    const res = await http()
      .get('/equipe/producao')
      .set('Cookie', ana)
      .expect(403);
    expect(res.body).toEqual({ mensagem: 'Acesso só para a produção' });
    await fila('Cozinha', dono);
    await fila('Cozinha', cozinha);
  });

  it('cozinha nas rotas do salão recebe 403', async () => {
    await http().get('/equipe/mesas').set('Cookie', cozinha).expect(403);
  });

  it('PATCH item muda status e repetir é inofensivo', async () => {
    await pedido(token7, item(ids.mix));
    const [p] = (await fila('Cozinha')).pedidos;
    const id = p.itens[0].id;
    await mudarItem(id, 'EM_PREPARO').expect(200);
    await mudarItem(id, 'EM_PREPARO').expect(200);
    const gravado = await t.prisma.itemRodada.findUniqueOrThrow({
      where: { id },
    });
    expect(gravado.status).toBe('EM_PREPARO');
    expect(gravado.emPreparoEm).not.toBeNull();

    await mudarItem(id, 'NA_FILA').expect(200);
    const voltou = await t.prisma.itemRodada.findUniqueOrThrow({
      where: { id },
    });
    expect(voltou).toMatchObject({ status: 'NA_FILA', emPreparoEm: null });
  });

  it('status inválido → 422', async () => {
    await pedido(token7, item(ids.mix));
    const [p] = (await fila('Cozinha')).pedidos;
    await mudarItem(p.itens[0].id, 'ENTREGUE').expect(422);
  });

  it('item entregue → 409', async () => {
    await pedido(token7, item(ids.mix));
    const [p] = (await fila('Cozinha')).pedidos;
    await t.prisma.itemRodada.update({
      where: { id: p.itens[0].id },
      data: { status: 'ENTREGUE' },
    });
    const res = await mudarItem(p.itens[0].id, 'PRONTO').expect(409);
    expect(res.body).toEqual({ mensagem: 'Este pedido mudou' });
  });

  it('rodada cancelada → 409', async () => {
    const { rodadaId } = await pedido(token7, item(ids.mix));
    const [p] = (await fila('Cozinha')).pedidos;
    await t.prisma.rodada.update({
      where: { id: rodadaId },
      data: { status: 'CANCELADA', canceladaEm: new Date() },
    });
    await mudarItem(p.itens[0].id, 'EM_PREPARO').expect(409);
    await mudarRodada(rodadaId, 'Cozinha', 'PRONTO').expect(409);
  });

  it('item de outro restaurante → 404', async () => {
    await mudarItem('00000000-0000-0000-0000-000000000000', 'PRONTO').expect(
      404,
    );
  });

  it('PATCH da rodada marca a estação inteira e não mexe na outra estação', async () => {
    const { rodadaId } = await pedido(
      token7,
      item(ids.mix),
      item(ids.pudim),
      item(ids.suco),
    );
    await mudarRodada(rodadaId, 'Cozinha', 'EM_PREPARO').expect(200);
    const itens = await t.prisma.itemRodada.findMany({ where: { rodadaId } });
    const status = Object.fromEntries(
      itens.map((i) => [i.estacao + ':' + i.nome, i.status]),
    );
    expect(status).toEqual({
      'Cozinha:Mix da Casa': 'EM_PREPARO',
      'Cozinha:Pudim de Leite': 'EM_PREPARO',
      'Bar:Suco Natural': 'NA_FILA',
    });
  });

  it('primeiro em preparo publica PedidoEmPreparo uma vez', async () => {
    await pedido(token7, item(ids.mix), item(ids.pudim));
    const [p] = (await fila('Cozinha')).pedidos;
    await mudarItem(p.itens[0].id, 'EM_PREPARO').expect(200);
    await mudarItem(p.itens[1].id, 'EM_PREPARO').expect(200);
    expect(
      await t.prisma.evento.count({ where: { tipo: 'PedidoEmPreparo' } }),
    ).toBe(1);
  });

  it('todos prontos publica PedidoPronto e o cliente vê fase PRONTO', async () => {
    const { rodadaId, cliente } = await pedido(
      token7,
      item(ids.mix),
      item(ids.suco),
    );
    await mudarRodada(rodadaId, 'Cozinha', 'PRONTO').expect(200);
    expect(
      await t.prisma.evento.count({ where: { tipo: 'PedidoPronto' } }),
    ).toBe(0);
    await mudarRodada(rodadaId, 'Bar', 'PRONTO').expect(200);
    await mudarRodada(rodadaId, 'Bar', 'PRONTO').expect(200);
    expect(
      await t.prisma.evento.count({ where: { tipo: 'PedidoPronto' } }),
    ).toBe(1);

    const doCliente = (
      await cliente.get(`/publico/mesas/${token7}/rodadas`).expect(200)
    ).body as { rodadas: { fase: string }[] };
    expect(doCliente.rodadas[0].fase).toBe('PRONTO');
  });

  it('estação inteira pronta emite ESTACAO_PRONTA uma vez, por estação', async () => {
    const emissor = t.app.get(EventEmitter2);
    const recebidos: unknown[] = [];
    const ouvir = (e: unknown) => recebidos.push(e);
    emissor.on(ESTACAO_PRONTA, ouvir);
    try {
      const { rodadaId } = await pedido(
        token7,
        item(ids.mix),
        item(ids.pudim),
        item(ids.suco),
      );
      const [p] = (await fila('Cozinha')).pedidos;
      await mudarItem(p.itens[0].id, 'PRONTO').expect(200);
      expect(recebidos).toEqual([]);
      await mudarItem(p.itens[1].id, 'PRONTO').expect(200);
      await mudarItem(p.itens[1].id, 'PRONTO').expect(200);
      expect(recebidos).toEqual([{ rodadaId, estacao: 'Cozinha', itens: 2 }]);
      await mudarRodada(rodadaId, 'Bar', 'PRONTO').expect(200);
      expect(recebidos).toEqual([
        { rodadaId, estacao: 'Cozinha', itens: 2 },
        { rodadaId, estacao: 'Bar', itens: 1 },
      ]);
    } finally {
      emissor.off(ESTACAO_PRONTA, ouvir);
    }
  });

  it('cancelada aparece com cancelada: true', async () => {
    const { rodadaId } = await pedido(token7, item(ids.mix));
    await t.prisma.rodada.update({
      where: { id: rodadaId },
      data: { status: 'CANCELADA', canceladaEm: new Date() },
    });
    const [p] = (await fila('Cozinha')).pedidos;
    expect(p).toMatchObject({ rodadaId, cancelada: true });
  });

  it('cancelada há mais de 10 min some da lista', async () => {
    const { rodadaId } = await pedido(token7, item(ids.mix));
    await t.prisma.rodada.update({
      where: { id: rodadaId },
      data: {
        status: 'CANCELADA',
        canceladaEm: new Date(Date.now() - 11 * 60_000),
      },
    });
    expect((await fila('Cozinha')).pedidos).toEqual([]);
  });

  it('pronta continua na lista por 15 min e depois some', async () => {
    const { rodadaId } = await pedido(token7, item(ids.mix));
    await mudarRodada(rodadaId, 'Cozinha', 'PRONTO').expect(200);
    expect((await fila('Cozinha')).pedidos).toHaveLength(1);
    await t.prisma.itemRodada.updateMany({
      where: { rodadaId },
      data: { prontoEm: new Date(Date.now() - 16 * 60_000) },
    });
    expect((await fila('Cozinha')).pedidos).toEqual([]);
  });

  it('confirmar e pedido direto avisam a produção (producao-mudou)', async () => {
    const tempoReal = t.app.get(TempoRealService);
    const espiao = jest.spyOn(tempoReal, 'paraEquipe');
    try {
      const { cliente } = await pedido(token7, item(ids.mix));
      const avisos = () =>
        espiao.mock.calls.filter(([, evento]) => evento === 'producao-mudou')
          .length;
      expect(avisos()).toBe(1);
      await cliente
        .post(`/publico/mesas/${token7}/carrinho/itens`)
        .send(item(ids.pudim))
        .expect(201);
      await cliente.post(`/publico/mesas/${token7}/rodadas`).expect(201);
      expect(avisos()).toBe(2);
    } finally {
      espiao.mockRestore();
    }
  });

  it('evento de outro restaurante não conta como já publicado', async () => {
    const outro = await t.prisma.restaurante.create({
      data: { nome: 'Outro', slug: 'outro-producao' },
    });
    try {
      const { rodadaId } = await pedido(token7, item(ids.mix));
      await t.prisma.evento.create({
        data: {
          restauranteId: outro.id,
          tipo: 'PedidoEmPreparo',
          dados: { rodadaId },
        },
      });
      await mudarRodada(rodadaId, 'Cozinha', 'EM_PREPARO').expect(200);
      expect(
        await t.prisma.evento.count({
          where: { tipo: 'PedidoEmPreparo', restauranteId: t.restauranteId },
        }),
      ).toBe(1);
    } finally {
      await t.prisma.restaurante.delete({ where: { id: outro.id } });
    }
  });
});

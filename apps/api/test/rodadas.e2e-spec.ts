import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { hashSenha } from '../src/equipe/senha';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

type ItemRodada = {
  id: string;
  pratoId: string;
  nome: string;
  resumoOpcoes: string;
  quantidade: number;
  precoUnitarioCentavos: number;
};
type Rodada = {
  id: string;
  status: string;
  totalCentavos: number;
  dispositivoNovo?: boolean;
  itens: ItemRodada[];
};

describe('rodadas', () => {
  let t: AppTeste;
  let token7: string;
  let ana: string;
  let mixId: string;
  let pizza: {
    id: string;
    tam: string;
    m: string;
    g: string;
    sab: string;
    marg: string;
  };

  beforeAll(async () => {
    t = await criarAppTeste();
    token7 = (
      await t.prisma.mesa.findFirstOrThrow({
        where: { restauranteId: t.restauranteId, numero: 7 },
      })
    ).token;
    const prato = (nome: string) =>
      t.prisma.prato.findFirstOrThrow({
        where: { nome },
        include: { grupos: { include: { opcoes: true } } },
      });
    mixId = (await prato('Mix da Casa')).id;
    const p = await prato('Pizza Margherita');
    const grupo = (nome: string) => p.grupos.find((g) => g.nome === nome)!;
    const opcao = (g: string, nome: string) =>
      grupo(g).opcoes.find((o) => o.nome === nome)!.id;
    pizza = {
      id: p.id,
      tam: grupo('Tamanho').id,
      m: opcao('Tamanho', 'M'),
      g: opcao('Tamanho', 'G'),
      sab: grupo('Sabores').id,
      marg: opcao('Sabores', 'Margherita'),
    };
    ana = await loginComo(t.app, 'ana@demo.com');
  });

  beforeEach(async () => {
    await t.prisma.sessaoMesa.deleteMany();
    await t.prisma.evento.deleteMany();
    await t.prisma.usuario.updateMany({
      data: { emTurno: false, emTurnoDesde: null, ultimoChamadoEm: null },
    });
    await http()
      .patch('/equipe/turno')
      .set('Cookie', ana)
      .send({ emTurno: true });
  });

  afterAll(async () => {
    await t.prisma.restaurante.deleteMany({ where: { slug: 'outro' } });
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());
  const celular = async () => {
    const agente = request.agent(t.app.getHttpServer());
    await agente.post(`/publico/mesas/${token7}/entrar`).expect(200);
    return agente;
  };
  const mix = (quantidade = 1) => ({
    pratoId: mixId,
    selecao: {},
    observacao: '',
    quantidade,
  });
  const pizzaM = () => ({
    pratoId: pizza.id,
    selecao: { [pizza.tam]: [pizza.m], [pizza.sab]: [pizza.marg] },
    observacao: '',
    quantidade: 1,
  });
  const adicionar = (c: TestAgent, item: object) =>
    c.post(`/publico/mesas/${token7}/carrinho/itens`).send(item).expect(201);
  const enviar = async (c: TestAgent, ...itens: object[]) => {
    for (const item of itens) await adicionar(c, item);
    const res = await c.post(`/publico/mesas/${token7}/rodadas`).expect(201);
    return res.body as Rodada;
  };
  const doCliente = async (c: TestAgent) =>
    (await c.get(`/publico/mesas/${token7}/rodadas`).expect(200)).body as {
      rodadas: Rodada[];
      totalParcialCentavos: number;
    };
  const confirmar = (id: string, cookie = ana) =>
    http().post(`/equipe/rodadas/${id}/confirmar`).set('Cookie', cookie);
  const patch = (rodada: Rodada, item: ItemRodada, corpo: object) =>
    http()
      .patch(`/equipe/rodadas/${rodada.id}/itens/${item.id}`)
      .set('Cookie', ana)
      .send(corpo);
  const mesaEquipe = async () =>
    (await http().get(`/equipe/mesas/${token7}`).set('Cookie', ana).expect(200))
      .body as {
      garcomNome: string | null;
      rodadas: Rodada[];
      totalConfirmadoCentavos: number;
    };
  /** A rodada como a equipe vê (itens com id). */
  const rodadaEquipe = async (id: string) =>
    (await mesaEquipe()).rodadas.find((r) => r.id === id)!;

  it('primeira rodada aguarda garçom e abre chamado CONFIRMAR_RODADA para Ana', async () => {
    const a = await celular();
    const rodada = await enviar(a, mix());
    expect(rodada).toMatchObject({
      status: 'AGUARDANDO_GARCOM',
      totalCentavos: 5990,
    });
    const chamados = (
      await http().get('/equipe/chamados').set('Cookie', ana).expect(200)
    ).body as { tipo: string }[];
    expect(chamados).toMatchObject([{ tipo: 'CONFIRMAR_RODADA' }]);
    const carrinho = await a.get(`/publico/mesas/${token7}/carrinho`);
    expect((carrinho.body as { itens: unknown[] }).itens).toEqual([]);
    expect(
      await t.prisma.evento.count({ where: { tipo: 'PedidoCriado' } }),
    ).toBe(1);
  });

  it('rodada congela o preço', async () => {
    const a = await celular();
    await enviar(a, mix());
    try {
      await t.prisma.prato.update({
        where: { id: mixId },
        data: { precoCentavos: 1000, precoPromocionalCentavos: null },
      });
      const { rodadas } = await doCliente(a);
      expect(rodadas[0].itens[0].precoUnitarioCentavos).toBe(5990);
    } finally {
      await t.prisma.prato.update({
        where: { id: mixId },
        data: { precoCentavos: 6990, precoPromocionalCentavos: 5990 },
      });
    }
  });

  it('item adicionado durante o envio não some', async () => {
    const a = await celular();
    const b = await celular();
    for (let i = 0; i < 8; i++) {
      await adicionar(a, mix());
      await Promise.all([
        a.post(`/publico/mesas/${token7}/rodadas`),
        adicionar(b, pizzaM()),
      ]);
    }
    const nasRodadas = await t.prisma.itemRodada.count({
      where: { pratoId: pizza.id },
    });
    const noCarrinho = await t.prisma.itemCarrinho.count({
      where: { pratoId: pizza.id },
    });
    expect(nasRodadas + noCarrinho).toBe(8);
  });

  it('envio duplo simultâneo gera uma rodada só', async () => {
    const a = await celular();
    await adicionar(a, mix());
    const url = `/publico/mesas/${token7}/rodadas`;
    const [r1, r2] = await Promise.all([a.post(url), a.post(url)]);
    expect([r1.status, r2.status].sort()).toEqual([201, 422]);
    expect(await t.prisma.rodada.count()).toBe(1);
  });

  it('prato esgotado depois de adicionar → 409 e o item sai do carrinho', async () => {
    const a = await celular();
    await adicionar(a, mix());
    try {
      await t.prisma.prato.update({
        where: { id: mixId },
        data: { esgotado: true },
      });
      const res = await a.post(`/publico/mesas/${token7}/rodadas`).expect(409);
      expect(res.body).toEqual({
        mensagem: 'Mix da Casa esgotou',
        pratoIds: [mixId],
      });
    } finally {
      await t.prisma.prato.update({
        where: { id: mixId },
        data: { esgotado: false },
      });
    }
    const carrinho = await a.get(`/publico/mesas/${token7}/carrinho`);
    expect((carrinho.body as { itens: unknown[] }).itens).toEqual([]);
    expect(await t.prisma.rodada.count()).toBe(0);
  });

  it('garçom confirma: mesa ganha responsável e a rodada seguinte do mesmo celular entra CONFIRMADA', async () => {
    const a = await celular();
    const primeira = await enviar(a, mix());
    const confirmada = (await confirmar(primeira.id).expect(200))
      .body as Rodada;
    expect(confirmada.status).toBe('CONFIRMADA');
    expect((await mesaEquipe()).garcomNome).toBe('Ana');
    const chamados = (
      await http().get('/equipe/chamados').set('Cookie', ana).expect(200)
    ).body as unknown[];
    expect(chamados).toEqual([]);

    const segunda = await enviar(a, mix());
    expect(segunda.status).toBe('CONFIRMADA');
  });

  it('garçom que confirma a rodada de mesa sem responsável fica com o crédito', async () => {
    const a = await celular();
    const primeira = await enviar(a, mix());
    await confirmar(primeira.id).expect(200);
    const anaId = (
      await t.prisma.usuario.findUniqueOrThrow({
        where: { email: 'ana@demo.com' },
      })
    ).id;
    const gravada = await t.prisma.rodada.findUniqueOrThrow({
      where: { id: primeira.id },
    });
    expect(gravada.garcomId).toBe(anaId);
  });

  it('celular novo na mesa aberta: 1ª rodada aguarda confirmação', async () => {
    const a = await celular();
    const primeira = await enviar(a, mix());
    await confirmar(primeira.id).expect(200);
    const b = await celular();
    const daB = await enviar(b, mix());
    expect(daB.status).toBe('AGUARDANDO_GARCOM');
    expect((await rodadaEquipe(daB.id)).dispositivoNovo).toBe(true);
  });

  it('confirmar duas vezes → 409 e só um Evento PedidoConfirmado', async () => {
    const a = await celular();
    const rodada = await enviar(a, mix());
    await confirmar(rodada.id).expect(200);
    await confirmar(rodada.id).expect(409);
    expect(
      await t.prisma.evento.count({ where: { tipo: 'PedidoConfirmado' } }),
    ).toBe(1);
  });

  it('confirmar rodada vazia → 422', async () => {
    const a = await celular();
    const rodada = await enviar(a, mix());
    const r = await rodadaEquipe(rodada.id);
    await patch(r, r.itens[0], { quantidade: 0 }).expect(200);
    await confirmar(rodada.id).expect(422);
  });

  it('garçom remove item e o total é recalculado', async () => {
    const a = await celular();
    const rodada = await enviar(a, mix(), pizzaM());
    expect(rodada.totalCentavos).toBe(5990 + 6990);
    const r = await rodadaEquipe(rodada.id);
    const item = r.itens.find((i) => i.pratoId === mixId)!;
    const res = await patch(r, item, { quantidade: 0 }).expect(200);
    expect(res.body).toMatchObject({ totalCentavos: 6990 });
    expect((res.body as Rodada).itens).toHaveLength(1);
  });

  it('garçom troca o tamanho da pizza e o preço é recalculado', async () => {
    const a = await celular();
    const rodada = await enviar(a, pizzaM());
    const r = await rodadaEquipe(rodada.id);
    const res = await patch(r, r.itens[0], {
      selecao: { [pizza.tam]: [pizza.g], [pizza.sab]: [pizza.marg] },
    }).expect(200);
    expect((res.body as Rodada).itens[0]).toMatchObject({
      resumoOpcoes: 'G · Margherita',
      precoUnitarioCentavos: 8990,
    });
    expect((res.body as Rodada).totalCentavos).toBe(8990);
  });

  it('garçom não digita preço', async () => {
    const a = await celular();
    const rodada = await enviar(a, mix());
    const r = await rodadaEquipe(rodada.id);
    const res = await patch(r, r.itens[0], {
      quantidade: 2,
      precoUnitarioCentavos: 1,
    }).expect(200);
    expect((res.body as Rodada).itens[0].precoUnitarioCentavos).toBe(5990);
    expect((res.body as Rodada).totalCentavos).toBe(11980);
  });

  it('seleção inválida do garçom → 422', async () => {
    const a = await celular();
    const rodada = await enviar(a, pizzaM());
    const r = await rodadaEquipe(rodada.id);
    const res = await patch(r, r.itens[0], {
      selecao: { [pizza.sab]: [pizza.marg] },
    }).expect(422);
    expect(res.body).toEqual({ mensagem: 'Escolha Tamanho' });
  });

  it('garçom adiciona prato à rodada com preço do servidor', async () => {
    const a = await celular();
    const rodada = await enviar(a, mix());
    const res = await http()
      .post(`/equipe/rodadas/${rodada.id}/itens`)
      .set('Cookie', ana)
      .send({ ...pizzaM(), precoUnitarioCentavos: 1 })
      .expect(201);
    expect((res.body as Rodada).totalCentavos).toBe(5990 + 6990);
  });

  it('editar rodada já confirmada → 409', async () => {
    const a = await celular();
    const rodada = await enviar(a, mix());
    await confirmar(rodada.id).expect(200);
    const r = await rodadaEquipe(rodada.id);
    await patch(r, r.itens[0], { quantidade: 3 }).expect(409);
  });

  it('recusar cancela e o cliente vê CANCELADA', async () => {
    const a = await celular();
    const rodada = await enviar(a, mix());
    await http()
      .post(`/equipe/rodadas/${rodada.id}/recusar`)
      .set('Cookie', ana)
      .expect(200);
    const { rodadas } = await doCliente(a);
    expect(rodadas[0].status).toBe('CANCELADA');
    const chamados = (
      await http().get('/equipe/chamados').set('Cookie', ana).expect(200)
    ).body as unknown[];
    expect(chamados).toEqual([]);
    expect(
      await t.prisma.evento.count({ where: { tipo: 'PedidoCancelado' } }),
    ).toBe(1);
  });

  it('totalParcial soma só confirmadas', async () => {
    const a = await celular();
    const primeira = await enviar(a, mix());
    await confirmar(primeira.id).expect(200);
    const b = await celular();
    await enviar(b, pizzaM());
    const cliente = await doCliente(a);
    expect(cliente.rodadas).toHaveLength(2);
    expect(cliente.totalParcialCentavos).toBe(5990);
    expect((await mesaEquipe()).totalConfirmadoCentavos).toBe(5990);
  });

  it('lista de mesas da equipe mostra aberta, garçom e pendentes', async () => {
    const a = await celular();
    await enviar(a, mix());
    const mesas = (
      await http().get('/equipe/mesas').set('Cookie', ana).expect(200)
    ).body as { numero: number; aberta: boolean; pendentes: number }[];
    expect(mesas.find((m) => m.numero === 7)).toMatchObject({
      aberta: true,
      garcomNome: null,
      pendentes: 1,
    });
    expect(mesas.find((m) => m.numero === 8)).toMatchObject({
      aberta: false,
      pendentes: 0,
    });
  });

  it('mesa da equipe traz aberta e a configuração da conta', async () => {
    const antes = (
      await http().get(`/equipe/mesas/${token7}`).set('Cookie', ana).expect(200)
    ).body as { aberta: boolean };
    expect(antes.aberta).toBe(false);
    const a = await celular();
    await enviar(a, mix());
    const depois = (
      await http().get(`/equipe/mesas/${token7}`).set('Cookie', ana).expect(200)
    ).body as { aberta: boolean; conta: unknown };
    expect(depois.aberta).toBe(true);
    expect(depois.conta).toEqual({
      servico: { habilitado: true, padrao: true },
      couvert: { habilitado: true, padrao: false, valorCentavos: 1500 },
    });
  });

  it('garçom de outro restaurante → 404 em /equipe/mesas/:token e nas rodadas', async () => {
    const a = await celular();
    const rodada = await enviar(a, mix());
    const r = await rodadaEquipe(rodada.id);

    await t.prisma.restaurante.deleteMany({ where: { slug: 'outro' } });
    await t.prisma.restaurante.create({
      data: {
        nome: 'Outro',
        slug: 'outro',
        usuarios: {
          create: {
            nome: 'Xavier',
            email: 'x@outro.com',
            senhaHash: await hashSenha('demo1234'),
            papel: 'GARCOM',
          },
        },
      },
    });
    const xavier = await loginComo(t.app, 'x@outro.com');
    await http()
      .get(`/equipe/mesas/${token7}`)
      .set('Cookie', xavier)
      .expect(404);
    await http()
      .patch(`/equipe/rodadas/${rodada.id}/itens/${r.itens[0].id}`)
      .set('Cookie', xavier)
      .send({ quantidade: 2 })
      .expect(404);
    await confirmar(rodada.id, xavier).expect(404);
    await http()
      .post(`/equipe/rodadas/${rodada.id}/recusar`)
      .set('Cookie', xavier)
      .expect(404);
  });

  describe('produção: estação, exceções e fase', () => {
    let sucoId: string;

    beforeAll(async () => {
      sucoId = (
        await t.prisma.prato.findFirstOrThrow({
          where: { nome: 'Suco Natural' },
        })
      ).id;
    });

    afterEach(async () => {
      await t.prisma.restaurante.update({
        where: { id: t.restauranteId },
        data: { limiteConfirmacaoCentavos: null },
      });
      await t.prisma.prato.updateMany({
        data: { exigeConfirmacao: false },
      });
    });

    const suco = () => ({
      pratoId: sucoId,
      selecao: {},
      observacao: '',
      quantidade: 1,
    });

    /** Celular com a mesa já aberta pela Ana (próximas rodadas vão direto). */
    const mesaAberta = async () => {
      const a = await celular();
      const primeira = await enviar(a, mix());
      await confirmar(primeira.id).expect(200);
      return a;
    };

    it('item congela a estação da categoria (Bebidas → Bar, Pizzas → Cozinha)', async () => {
      const a = await celular();
      const rodada = await enviar(a, pizzaM(), suco());
      const itens = await t.prisma.itemRodada.findMany({
        where: { rodadaId: rodada.id },
      });
      const estacao = (pratoId: string) =>
        itens.find((i) => i.pratoId === pratoId)!.estacao;
      expect(estacao(pizza.id)).toBe('Cozinha');
      expect(estacao(sucoId)).toBe('Bar');
    });

    it('rodada seguinte acima do limite pede confirmação', async () => {
      const a = await mesaAberta();
      await t.prisma.restaurante.update({
        where: { id: t.restauranteId },
        data: { limiteConfirmacaoCentavos: 5989 },
      });
      const segunda = await enviar(a, mix());
      expect(segunda.status).toBe('AGUARDANDO_GARCOM');
    });

    it('rodada igual ao limite vai direto', async () => {
      const a = await mesaAberta();
      await t.prisma.restaurante.update({
        where: { id: t.restauranteId },
        data: { limiteConfirmacaoCentavos: 5990 },
      });
      const segunda = await enviar(a, mix());
      expect(segunda.status).toBe('CONFIRMADA');
    });

    it('prato que exige confirmação pede confirmação mesmo com mesa aberta', async () => {
      const a = await mesaAberta();
      await t.prisma.prato.update({
        where: { id: sucoId },
        data: { exigeConfirmacao: true },
      });
      const segunda = await enviar(a, mix(), suco());
      expect(segunda.status).toBe('AGUARDANDO_GARCOM');
    });

    it('rodada direta guarda o garçom da mesa como crédito', async () => {
      const a = await mesaAberta();
      const segunda = await enviar(a, mix());
      const anaId = (
        await t.prisma.usuario.findUniqueOrThrow({
          where: { email: 'ana@demo.com' },
        })
      ).id;
      const gravada = await t.prisma.rodada.findUniqueOrThrow({
        where: { id: segunda.id },
      });
      expect(gravada.garcomId).toBe(anaId);
    });

    it('item congela o tempo esperado do prato (ou da categoria, ou 15)', async () => {
      const prato = (id: string) =>
        t.prisma.prato.findUniqueOrThrow({ where: { id } });
      const catPizza = (await prato(pizza.id)).categoriaId;
      const catSuco = (await prato(sucoId)).categoriaId;
      const catMix = (await prato(mixId)).categoriaId;
      await t.prisma.categoria.update({
        where: { id: catPizza },
        data: { tempoPreparoMin: 12 },
      });
      await t.prisma.prato.update({
        where: { id: sucoId },
        data: { tempoPreparoMin: 4 },
      });
      try {
        const a = await celular();
        const rodada = await enviar(a, pizzaM(), suco(), mix());
        const itens = await t.prisma.itemRodada.findMany({
          where: { rodadaId: rodada.id },
        });
        const tempo = (pratoId: string) =>
          itens.find((i) => i.pratoId === pratoId)!.tempoEsperadoMin;
        expect(tempo(pizza.id)).toBe(12);
        expect(tempo(sucoId)).toBe(4);
        if (catMix !== catPizza) expect(tempo(mixId)).toBe(15);
      } finally {
        await t.prisma.categoria.updateMany({
          where: { id: { in: [catPizza, catSuco, catMix] } },
          data: { tempoPreparoMin: null },
        });
        await t.prisma.prato.update({
          where: { id: sucoId },
          data: { tempoPreparoMin: null },
        });
      }
    });

    it('rodada direta publica PedidoConfirmado com direto: true', async () => {
      const a = await mesaAberta();
      const segunda = await enviar(a, mix());
      const evento = await t.prisma.evento.findFirstOrThrow({
        where: {
          tipo: 'PedidoConfirmado',
          dados: { path: ['rodadaId'], equals: segunda.id },
        },
      });
      expect(evento.dados).toMatchObject({ direto: true });
      const gravada = await t.prisma.rodada.findUniqueOrThrow({
        where: { id: segunda.id },
      });
      expect(gravada.direta).toBe(true);
    });

    it('cliente recebe fase e status dos itens', async () => {
      const a = await celular();
      const rodada = await enviar(a, mix());
      expect(rodada).toMatchObject({
        fase: 'AGUARDANDO_GARCOM',
        itens: [{ status: 'NA_FILA' }],
      });
      await confirmar(rodada.id).expect(200);
      const lista = await doCliente(a);
      expect(lista.rodadas[0]).toMatchObject({
        fase: 'NA_COZINHA',
        itens: [{ status: 'NA_FILA' }],
      });
    });

    it('garçom adiciona item: estação do prato', async () => {
      const a = await celular();
      const rodada = await enviar(a, mix());
      const res = await http()
        .post(`/equipe/rodadas/${rodada.id}/itens`)
        .set('Cookie', ana)
        .send(suco())
        .expect(201);
      const itens = (res.body as { itens: { estacao: string }[] }).itens;
      expect(itens.map((i) => i.estacao).sort()).toEqual(['Bar', 'Cozinha']);
    });
  });

  describe('garçom: janela de cancelamento e entrega', () => {
    let bruno: string;
    let dono: string;

    beforeAll(async () => {
      bruno = await loginComo(t.app, 'bruno@demo.com');
      dono = await loginComo(t.app, 'dono@demo.com');
    });

    afterEach(async () => {
      await t.prisma.restaurante.update({
        where: { id: t.restauranteId },
        data: { janelaCancelamentoSegundos: 120 },
      });
    });

    type RodadaJanela = Rodada & {
      fase: string;
      cancelavelAte: string | null;
    };

    /** Mesa aberta pela Ana e uma rodada que foi direto para a produção. */
    const rodadaDireta = async () => {
      const a = await celular();
      const primeira = await enviar(a, mix());
      await confirmar(primeira.id).expect(200);
      const direta = await enviar(a, mix());
      return { a, primeira, direta };
    };
    const cancelar = (id: string, cookie = ana) =>
      http().post(`/equipe/rodadas/${id}/cancelar`).set('Cookie', cookie);
    const entregar = (id: string) =>
      http().post(`/equipe/rodadas/${id}/entregar`).set('Cookie', ana);
    const prontos = (rodadaId: string) =>
      t.prisma.itemRodada.updateMany({
        where: { rodadaId },
        data: { status: 'PRONTO', prontoEm: new Date() },
      });

    it('rodada direta tem cancelavelAte', async () => {
      const { direta } = await rodadaDireta();
      const r = (await rodadaEquipe(direta.id)) as RodadaJanela;
      expect(r.fase).toBe('NA_COZINHA');
      const ate = new Date(r.cancelavelAte!).getTime();
      expect(ate - Date.now()).toBeGreaterThan(100_000);
      expect(ate - Date.now()).toBeLessThanOrEqual(120_000);
    });

    it('rodada confirmada pelo garçom na mesa não tem janela (cancelavelAte: null)', async () => {
      const { primeira } = await rodadaDireta();
      const r = (await rodadaEquipe(primeira.id)) as RodadaJanela;
      expect(r.cancelavelAte).toBeNull();
      await cancelar(primeira.id).expect(409);
    });

    it('garçom responsável cancela dentro da janela', async () => {
      const { a, direta } = await rodadaDireta();
      const res = await cancelar(direta.id).expect(200);
      expect(res.body).toMatchObject({
        status: 'CANCELADA',
        fase: 'CANCELADA',
      });
      const gravada = await t.prisma.rodada.findUniqueOrThrow({
        where: { id: direta.id },
      });
      expect(gravada.canceladaEm).not.toBeNull();
      const evento = await t.prisma.evento.findFirstOrThrow({
        where: { tipo: 'PedidoCancelado' },
      });
      expect(evento.dados).toMatchObject({
        rodadaId: direta.id,
        porJanela: true,
      });
      const cliente = await doCliente(a);
      expect(cliente.totalParcialCentavos).toBe(5990);
    });

    it('depois da janela → 409', async () => {
      await t.prisma.restaurante.update({
        where: { id: t.restauranteId },
        data: { janelaCancelamentoSegundos: 1 },
      });
      const { direta } = await rodadaDireta();
      await new Promise((r) => setTimeout(r, 1100));
      const res = await cancelar(direta.id).expect(409);
      expect(res.body).toEqual({ mensagem: 'O prazo para cancelar acabou' });
      expect(
        ((await rodadaEquipe(direta.id)) as RodadaJanela).cancelavelAte,
      ).toBeNull();
    });

    it('outro garçom → 403', async () => {
      const { direta } = await rodadaDireta();
      await http()
        .patch('/equipe/turno')
        .set('Cookie', bruno)
        .send({ emTurno: true });
      const res = await cancelar(direta.id, bruno).expect(403);
      expect(res.body).toEqual({ mensagem: 'Esta mesa é de outro garçom' });
    });

    it('dono cancela', async () => {
      const { direta } = await rodadaDireta();
      await cancelar(direta.id, dono).expect(200);
    });

    it('entregar passa só os prontos', async () => {
      const a = await celular();
      const rodada = await enviar(a, mix(), pizzaM());
      await confirmar(rodada.id).expect(200);
      const [primeiro] = await t.prisma.itemRodada.findMany({
        where: { rodadaId: rodada.id },
        orderBy: { id: 'asc' },
      });
      await t.prisma.itemRodada.update({
        where: { id: primeiro.id },
        data: { status: 'PRONTO', prontoEm: new Date() },
      });
      const res = await entregar(rodada.id).expect(200);
      const itens = (res.body as { itens: { id: string; status: string }[] })
        .itens;
      const status = Object.fromEntries(itens.map((i) => [i.id, i.status]));
      expect(Object.values(status).sort()).toEqual(['ENTREGUE', 'NA_FILA']);
      expect(status[primeiro.id]).toBe('ENTREGUE');
      expect(
        await t.prisma.evento.count({ where: { tipo: 'PedidoEntregue' } }),
      ).toBe(0);
    });

    it('tudo entregue publica PedidoEntregue e o cliente vê ENTREGUE', async () => {
      const a = await celular();
      const rodada = await enviar(a, mix());
      await confirmar(rodada.id).expect(200);
      await prontos(rodada.id);
      await entregar(rodada.id).expect(200);
      expect(
        await t.prisma.evento.count({ where: { tipo: 'PedidoEntregue' } }),
      ).toBe(1);
      expect((await doCliente(a)).rodadas[0]).toMatchObject({
        fase: 'ENTREGUE',
      });
    });

    it('nada pronto → 409', async () => {
      const { direta } = await rodadaDireta();
      const res = await entregar(direta.id).expect(409);
      expect(res.body).toEqual({ mensagem: 'Nada pronto para entregar' });
    });

    it('mesas mostra prontos', async () => {
      const { direta } = await rodadaDireta();
      await prontos(direta.id);
      const mesas = (
        await http().get('/equipe/mesas').set('Cookie', ana).expect(200)
      ).body as { numero: number; prontos: number }[];
      expect(mesas.find((m) => m.numero === 7)!.prontos).toBe(1);
      expect(mesas.find((m) => m.numero === 8)!.prontos).toBe(0);
    });
  });
});

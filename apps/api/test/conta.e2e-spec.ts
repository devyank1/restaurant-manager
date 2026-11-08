import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { TempoRealService } from '../src/tempo-real/tempo-real.service';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

type Fechamento = {
  mesa: { numero: number };
  totalCentavos: number;
  formaPagamento: string;
};

describe('conta', () => {
  let t: AppTeste;
  let token7: string;
  let ana: string;
  let cozinha: string;
  let mix: string;
  let mixPreco: number;

  beforeAll(async () => {
    t = await criarAppTeste();
    token7 = (
      await t.prisma.mesa.findFirstOrThrow({
        where: { restauranteId: t.restauranteId, numero: 7 },
      })
    ).token;
    const prato = await t.prisma.prato.findFirstOrThrow({
      where: { nome: 'Mix da Casa' },
    });
    mix = prato.id;
    mixPreco = prato.precoPromocionalCentavos ?? prato.precoCentavos;
    ana = await loginComo(t.app, 'ana@demo.com');
    cozinha = await loginComo(t.app, 'cozinha@demo.com');
  });

  beforeEach(async () => {
    await t.prisma.sessaoMesa.deleteMany();
    await t.prisma.evento.deleteMany();
    await t.prisma.restaurante.update({
      where: { id: t.restauranteId },
      data: {
        servicoHabilitado: true,
        servicoPadrao: true,
        couvertHabilitado: true,
        couvertPadrao: false,
        couvertCentavos: 1500,
      },
    });
    await http()
      .patch('/equipe/turno')
      .set('Cookie', ana)
      .send({ emTurno: true });
  });

  afterAll(async () => {
    await t.prisma.restaurante.deleteMany({ where: { slug: 'outro-conta' } });
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());
  const item = () => ({
    pratoId: mix,
    selecao: {},
    observacao: '',
    quantidade: 1,
  });

  const entrar = async () => {
    const c = request.agent(t.app.getHttpServer());
    await c.post(`/publico/mesas/${token7}/entrar`).expect(200);
    return c;
  };
  const enviar = async (c: TestAgent) => {
    await c
      .post(`/publico/mesas/${token7}/carrinho/itens`)
      .send(item())
      .expect(201);
    return (await c.post(`/publico/mesas/${token7}/rodadas`).expect(201))
      .body as { id: string; status: string };
  };
  /** Cliente pede e a Ana confirma: uma rodada confirmada de um Mix. */
  const mesaComPedido = async () => {
    const cliente = await entrar();
    const r = await enviar(cliente);
    await http()
      .post(`/equipe/rodadas/${r.id}/confirmar`)
      .set('Cookie', ana)
      .expect(200);
    return { cliente, rodadaId: r.id };
  };
  const fechar = (corpo: object, cookie = ana) =>
    http()
      .post(`/equipe/mesas/${token7}/fechar`)
      .set('Cookie', cookie)
      .send(corpo);
  const sessao = () =>
    t.prisma.sessaoMesa.findFirstOrThrow({
      where: { mesa: { token: token7 } },
      orderBy: { abertaEm: 'desc' },
    });
  const contaFechadas = () =>
    t.prisma.evento.count({ where: { tipo: 'ContaFechada' } });

  it('fecha a conta: grava a sessão, o evento ContaFechada e libera a mesa', async () => {
    await mesaComPedido();
    const total = mixPreco + Math.round(mixPreco / 10) + 3000;
    const res = await fechar({
      servico: true,
      couvert: true,
      pessoas: 2,
      formaPagamento: 'PIX',
      totalCentavos: total,
    }).expect(200);
    expect(res.body as Fechamento).toEqual({
      mesa: { numero: 7 },
      totalCentavos: total,
      formaPagamento: 'PIX',
    });

    const s = await sessao();
    const anaId = (
      await t.prisma.usuario.findUniqueOrThrow({
        where: { email: 'ana@demo.com' },
      })
    ).id;
    expect(s).toMatchObject({
      status: 'FECHADA',
      formaPagamento: 'PIX',
      subtotalCentavos: mixPreco,
      servicoCentavos: Math.round(mixPreco / 10),
      couvertCentavos: 3000,
      pessoas: 2,
      totalCentavos: total,
      fechadaPorId: anaId,
    });
    expect(s.fechadaEm).toBeInstanceOf(Date);

    const eventos = await t.prisma.evento.findMany({
      where: { tipo: 'ContaFechada' },
    });
    expect(eventos).toHaveLength(1);
    expect(eventos[0].dados).toMatchObject({
      sessaoId: s.id,
      formaPagamento: 'PIX',
      totalCentavos: total,
    });

    const mesas = (
      await http().get('/equipe/mesas').set('Cookie', ana).expect(200)
    ).body as { numero: number; aberta: boolean }[];
    expect(mesas.find((m) => m.numero === 7)?.aberta).toBe(false);
  });

  it('conta mudou entre ver e fechar → 409 e nada fecha', async () => {
    await mesaComPedido();
    const res = await fechar({
      servico: false,
      couvert: false,
      formaPagamento: 'CARTAO',
      totalCentavos: mixPreco - 1,
    }).expect(409);
    expect(res.body).toEqual({
      mensagem: 'A conta mudou. Confira o novo total.',
    });
    expect((await sessao()).status).toBe('ABERTA');
    expect(await contaFechadas()).toBe(0);
  });

  it('segundo fechamento → 409 Esta mesa já foi fechada', async () => {
    await mesaComPedido();
    const corpo = {
      servico: false,
      couvert: false,
      formaPagamento: 'DINHEIRO',
      totalCentavos: mixPreco,
    };
    await fechar(corpo).expect(200);
    const res = await fechar(corpo).expect(409);
    expect(res.body).toEqual({ mensagem: 'Esta mesa já foi fechada' });
    expect(await contaFechadas()).toBe(1);
  });

  it('fechamentos simultâneos: só um fecha', async () => {
    await mesaComPedido();
    const corpo = {
      servico: false,
      couvert: false,
      formaPagamento: 'PIX',
      totalCentavos: mixPreco,
    };
    const [a, b] = await Promise.all([fechar(corpo), fechar(corpo)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await contaFechadas()).toBe(1);
  });

  it('rodada aguardando bloqueia o fechamento', async () => {
    const cliente = await entrar();
    await enviar(cliente);
    const res = await fechar({
      servico: false,
      couvert: false,
      formaPagamento: 'PIX',
      totalCentavos: 0,
    }).expect(409);
    expect(res.body).toEqual({
      mensagem: 'Confirme ou recuse os pedidos pendentes antes de fechar',
    });
    expect((await sessao()).status).toBe('ABERTA');
  });

  it('mesa sem consumo fecha só com couvert', async () => {
    await entrar();
    await fechar({
      servico: true,
      couvert: true,
      pessoas: 2,
      formaPagamento: 'DINHEIRO',
      totalCentavos: 3000,
    }).expect(200);
  });

  it.each([
    ['pessoas 0 com couvert', { couvert: true, pessoas: 0 }],
    ['pessoas fracionado', { couvert: true, pessoas: 1.5 }],
    ['couvert sem pessoas', { couvert: true }],
    ['forma de pagamento estranha', { formaPagamento: 'CHEQUE' }],
    ['sem total', { totalCentavos: undefined }],
  ])('corpo inválido (%s) → 422', async (_nome, troca) => {
    await mesaComPedido();
    await fechar({
      servico: false,
      couvert: false,
      formaPagamento: 'PIX',
      totalCentavos: mixPreco,
      ...troca,
    }).expect(422);
  });

  it('opção desligada no restaurante → 422', async () => {
    await mesaComPedido();
    await t.prisma.restaurante.update({
      where: { id: t.restauranteId },
      data: { servicoHabilitado: false },
    });
    const res = await fechar({
      servico: true,
      couvert: false,
      formaPagamento: 'PIX',
      totalCentavos: mixPreco + Math.round(mixPreco / 10),
    }).expect(422);
    expect(res.body).toEqual({
      mensagem: 'Serviço ou couvert desligado neste restaurante',
    });
  });

  it('cozinha não fecha conta (403)', async () => {
    await mesaComPedido();
    await fechar(
      {
        servico: false,
        couvert: false,
        formaPagamento: 'PIX',
        totalCentavos: mixPreco,
      },
      cozinha,
    ).expect(403);
  });

  it('mesa de outro restaurante → 404', async () => {
    const outro = await t.prisma.restaurante.create({
      data: { nome: 'Outro', slug: 'outro-conta' },
    });
    const mesa = await t.prisma.mesa.create({
      data: { restauranteId: outro.id, numero: 1, token: 'tokenOutroConta1' },
    });
    await http()
      .post(`/equipe/mesas/${mesa.token}/fechar`)
      .set('Cookie', ana)
      .send({
        servico: false,
        couvert: false,
        formaPagamento: 'PIX',
        totalCentavos: 0,
      })
      .expect(404);
  });

  it('fechar resolve os chamados da sessão e limpa o carrinho', async () => {
    const { cliente } = await mesaComPedido();
    await cliente.post(`/publico/mesas/${token7}/chamados`).expect(201);
    await cliente
      .post(`/publico/mesas/${token7}/carrinho/itens`)
      .send(item())
      .expect(201);
    const s = await sessao();
    await fechar({
      servico: false,
      couvert: false,
      formaPagamento: 'PIX',
      totalCentavos: mixPreco,
    }).expect(200);
    expect(
      await t.prisma.chamado.count({
        where: { sessaoId: s.id, status: { not: 'RESOLVIDO' } },
      }),
    ).toBe(0);
    expect(
      await t.prisma.itemCarrinho.count({ where: { sessaoId: s.id } }),
    ).toBe(0);
  });

  it('celular da sessão fechada recebe CONTA_FECHADA; entrar de novo abre sessão nova que pede confirmação', async () => {
    const { cliente } = await mesaComPedido();
    await fechar({
      servico: false,
      couvert: false,
      formaPagamento: 'PIX',
      totalCentavos: mixPreco,
    }).expect(200);

    const res = await cliente
      .get(`/publico/mesas/${token7}/rodadas`)
      .expect(403);
    expect(res.body).toMatchObject({ codigo: 'CONTA_FECHADA' });

    await cliente.post(`/publico/mesas/${token7}/entrar`).expect(200);
    const nova = await enviar(cliente);
    expect(nova.status).toBe('AGUARDANDO_GARCOM');
  });

  it('celular que nunca esteve na mesa continua FORA_DA_SESSAO', async () => {
    await mesaComPedido();
    await fechar({
      servico: false,
      couvert: false,
      formaPagamento: 'PIX',
      totalCentavos: mixPreco,
    }).expect(200);
    const res = await http()
      .get(`/publico/mesas/${token7}/rodadas`)
      .set('Cookie', 'dispositivo=11111111-1111-4111-8111-111111111111')
      .expect(403);
    expect(res.body).toMatchObject({ codigo: 'FORA_DA_SESSAO' });
  });

  it('fechar avisa a sessão (conta-fechada) e a equipe', async () => {
    await mesaComPedido();
    const s = await sessao();
    const tempoReal = t.app.get(TempoRealService);
    const sessaoSpy = jest.spyOn(tempoReal, 'paraSessao');
    const equipeSpy = jest.spyOn(tempoReal, 'paraEquipe');
    try {
      await fechar({
        servico: false,
        couvert: false,
        formaPagamento: 'PIX',
        totalCentavos: mixPreco,
      }).expect(200);
      expect(sessaoSpy).toHaveBeenCalledWith(s.id, 'conta-fechada', {});
      expect(
        equipeSpy.mock.calls.some(([, evento]) => evento === 'mesa-mudou'),
      ).toBe(true);
    } finally {
      sessaoSpy.mockRestore();
      equipeSpy.mockRestore();
    }
  });

  it('itens ainda na produção continuam na fila da cozinha depois de fechar', async () => {
    const { rodadaId } = await mesaComPedido();
    await fechar({
      servico: false,
      couvert: false,
      formaPagamento: 'PIX',
      totalCentavos: mixPreco,
    }).expect(200);
    const fila = (
      await http()
        .get('/equipe/producao')
        .query({ estacao: 'Cozinha' })
        .set('Cookie', cozinha)
        .expect(200)
    ).body as { pedidos: { rodadaId: string }[] };
    expect(fila.pedidos.some((p) => p.rodadaId === rodadaId)).toBe(true);
  });

  it('cancelar rodada depois de fechar a conta → 409', async () => {
    await t.prisma.restaurante.update({
      where: { id: t.restauranteId },
      data: { janelaCancelamentoSegundos: 600 },
    });
    try {
      const { cliente } = await mesaComPedido();
      const direta = await enviar(cliente);
      expect(direta.status).toBe('CONFIRMADA');
      await fechar({
        servico: false,
        couvert: false,
        formaPagamento: 'PIX',
        totalCentavos: mixPreco * 2,
      }).expect(200);
      const res = await http()
        .post(`/equipe/rodadas/${direta.id}/cancelar`)
        .set('Cookie', ana)
        .expect(409);
      expect(res.body).toEqual({ mensagem: 'Esta mesa já foi fechada' });
    } finally {
      await t.prisma.restaurante.update({
        where: { id: t.restauranteId },
        data: { janelaCancelamentoSegundos: 120 },
      });
    }
  });
});

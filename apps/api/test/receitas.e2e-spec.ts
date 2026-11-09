import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { TempoRealService } from '../src/tempo-real/tempo-real.service';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

type Corpo = {
  id: string;
  mensagem: string;
  esgotado: boolean;
  status: string;
};
const corpo = (r: { body: unknown }) => r.body as Corpo;

describe('receitas e baixa pela venda', () => {
  let t: AppTeste;
  let dono: string;
  let ana: string;
  let token7: string;
  let pizza: string;
  let mix: string;
  let op: Record<string, { id: string; grupoId: string }>;
  let item: Record<string, string>;

  beforeAll(async () => {
    t = await criarAppTeste();
    dono = await loginComo(t.app, 'dono@demo.com');
    ana = await loginComo(t.app, 'ana@demo.com');
    token7 = (
      await t.prisma.mesa.findFirstOrThrow({
        where: { restauranteId: t.restauranteId, numero: 7 },
      })
    ).token;
    const p = await t.prisma.prato.findFirstOrThrow({
      where: { restauranteId: t.restauranteId, nome: 'Pizza Margherita' },
      include: { grupos: { include: { opcoes: true } } },
    });
    pizza = p.id;
    op = {};
    for (const g of p.grupos) {
      for (const o of g.opcoes) op[o.nome] = { id: o.id, grupoId: g.id };
    }
    mix = (
      await t.prisma.prato.findFirstOrThrow({
        where: { restauranteId: t.restauranteId, nome: 'Mix da Casa' },
      })
    ).id;
  });

  beforeEach(async () => {
    await t.prisma.sessaoMesa.deleteMany();
    await t.prisma.evento.deleteMany();
    await t.prisma.movimentoEstoque.deleteMany();
    await t.prisma.receitaItem.deleteMany();
    await t.prisma.itemEstoque.deleteMany();
    await t.prisma.prato.updateMany({ data: { esgotado: false } });
    await t.prisma.opcao.updateMany({ data: { multiplicadorPct: 100 } });
    await http()
      .patch('/equipe/turno')
      .set('Cookie', ana)
      .send({ emTurno: true });
    item = {};
    for (const [nome, unidade] of [
      ['Massa', 'G'],
      ['Queijo', 'G'],
      ['Calabresa', 'G'],
      ['Bacon', 'G'],
      ['Chopp', 'ML'],
    ] as const) {
      const r = await http()
        .post('/equipe/estoque/itens')
        .set('Cookie', dono)
        .send({ nome, unidade, minimo: 0, cheio: 0, quantidade: 10000 })
        .expect(201);
      item[nome] = corpo(r).id;
    }
    await receitaPrato(pizza, [{ itemId: item.Massa, quantidade: 300 }]);
    await receitaOpcao('Margherita', [
      { itemId: item.Queijo, quantidade: 200 },
    ]);
    await receitaOpcao('Calabresa', [
      { itemId: item.Calabresa, quantidade: 150 },
    ]);
    await receitaOpcao('G', [], 150);
    await receitaOpcao('Bacon', [{ itemId: item.Bacon, quantidade: 50 }]);
  });

  afterAll(async () => {
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());
  const receitaPrato = (
    pratoId: string,
    itens: { itemId: string; quantidade: number }[],
  ) =>
    http()
      .put(`/equipe/estoque/receitas/pratos/${pratoId}`)
      .set('Cookie', dono)
      .send({ itens })
      .expect(200);
  const receitaOpcao = (
    nome: string,
    itens: { itemId: string; quantidade: number }[],
    multiplicadorPct?: number,
  ) =>
    http()
      .put(`/equipe/estoque/receitas/opcoes/${op[nome].id}`)
      .set('Cookie', dono)
      .send({ itens, multiplicadorPct })
      .expect(200);
  const qtd = async (nome: string) =>
    (
      await t.prisma.itemEstoque.findUniqueOrThrow({
        where: { id: item[nome] },
      })
    ).quantidade;

  const pizzaG = () => ({
    pratoId: pizza,
    selecao: {
      [op.G.grupoId]: [op.G.id],
      [op.Margherita.grupoId]: [op.Margherita.id, op.Calabresa.id],
      [op.Bacon.grupoId]: [op.Bacon.id],
    },
    observacao: '',
    quantidade: 1,
  });
  const mixItem = () => ({
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
  const enviar = async (c: TestAgent, it: object) => {
    await c
      .post(`/publico/mesas/${token7}/carrinho/itens`)
      .send(it)
      .expect(201);
    return corpo(await c.post(`/publico/mesas/${token7}/rodadas`).expect(201));
  };
  const confirmar = (id: string) =>
    http().post(`/equipe/rodadas/${id}/confirmar`).set('Cookie', ana);
  /** Primeira rodada (Mix) confirmada pela Ana: a próxima vai direto. */
  const clienteConfirmado = async () => {
    const c = await entrar();
    const r = await enviar(c, mixItem());
    await confirmar(r.id).expect(200);
    return c;
  };

  it('GET receitas traz pratos com grupos, opções e receita', async () => {
    const res = await http()
      .get('/equipe/estoque/receitas')
      .set('Cookie', dono)
      .expect(200);
    const lista = res.body as {
      id: string;
      receita: { nome: string; quantidade: number }[];
      grupos: {
        opcoes: {
          nome: string;
          multiplicadorPct: number;
          receita: unknown[];
        }[];
      }[];
    }[];
    const p = lista.find((x) => x.id === pizza)!;
    expect(p.receita).toMatchObject([{ nome: 'Massa', quantidade: 300 }]);
    const opcoes = p.grupos.flatMap((g) => g.opcoes);
    expect(opcoes.find((o) => o.nome === 'G')!.multiplicadorPct).toBe(150);
    expect(opcoes.find((o) => o.nome === 'Bacon')!.receita).toHaveLength(1);
  });

  it('multiplicador em grupo que não é tamanho dá 422', async () => {
    const res = await http()
      .put(`/equipe/estoque/receitas/opcoes/${op.Bacon.id}`)
      .set('Cookie', dono)
      .send({ itens: [], multiplicadorPct: 150 })
      .expect(422);
    expect(corpo(res).mensagem).toBe('Só tamanho tem multiplicador');
  });

  it('item repetido ou inválido na receita dá 422', async () => {
    const rep = await http()
      .put(`/equipe/estoque/receitas/pratos/${pizza}`)
      .set('Cookie', dono)
      .send({
        itens: [
          { itemId: item.Massa, quantidade: 1 },
          { itemId: item.Massa, quantidade: 2 },
        ],
      })
      .expect(422);
    expect(corpo(rep).mensagem).toBe('Item repetido na receita');
    await t.prisma.itemEstoque.update({
      where: { id: item.Chopp },
      data: { ativo: false },
    });
    const inv = await http()
      .put(`/equipe/estoque/receitas/pratos/${pizza}`)
      .set('Cookie', dono)
      .send({ itens: [{ itemId: item.Chopp, quantidade: 1 }] })
      .expect(422);
    expect(corpo(inv).mensagem).toBe('Item de estoque inválido');
  });

  it('garçom não mexe em receitas (403)', async () => {
    await http().get('/equipe/estoque/receitas').set('Cookie', ana).expect(403);
  });

  it('pedido direto do cliente baixa o estoque pela receita', async () => {
    const c = await clienteConfirmado();
    const r = await enviar(c, pizzaG());
    expect(r.status).toBe('CONFIRMADA');
    expect(await qtd('Massa')).toBe(9550);
    expect(await qtd('Queijo')).toBe(9850);
    expect(await qtd('Calabresa')).toBe(9887);
    expect(await qtd('Bacon')).toBe(9950);
  });

  it('confirmar rodada pendente baixa; recusar não baixa', async () => {
    const c = await entrar();
    const r = await enviar(c, pizzaG());
    expect(await qtd('Massa')).toBe(10000);
    await confirmar(r.id).expect(200);
    expect(await qtd('Massa')).toBe(9550);

    const c2 = await entrar();
    await t.prisma.dispositivoSessao.updateMany({
      data: { confirmado: false },
    });
    const r2 = await enviar(c2, pizzaG());
    expect(r2.status).toBe('AGUARDANDO_GARCOM');
    await http()
      .post(`/equipe/rodadas/${r2.id}/recusar`)
      .set('Cookie', ana)
      .expect(200);
    expect(await qtd('Massa')).toBe(9550);
  });

  it('cancelar na janela devolve o que a venda baixou mesmo se a receita mudou', async () => {
    const c = await clienteConfirmado();
    const r = await enviar(c, pizzaG());
    expect(await qtd('Massa')).toBe(9550);
    await receitaPrato(pizza, [{ itemId: item.Massa, quantidade: 999 }]);
    await http()
      .post(`/equipe/rodadas/${r.id}/cancelar`)
      .set('Cookie', ana)
      .expect(200);
    expect(await qtd('Massa')).toBe(10000);
    expect(await qtd('Calabresa')).toBe(10000);
    const estornos = await t.prisma.movimentoEstoque.count({
      where: { tipo: 'ESTORNO', rodadaId: r.id },
    });
    expect(estornos).toBe(4);
  });

  it('prato sem receita não gera movimento', async () => {
    await clienteConfirmado();
    expect(
      await t.prisma.movimentoEstoque.count({ where: { tipo: 'VENDA' } }),
    ).toBe(0);
  });

  it('opção apagada depois do pedido não quebra a confirmação', async () => {
    const c = await entrar();
    const r = await enviar(c, pizzaG());
    const bacon = await t.prisma.opcao.create({
      data: {
        restauranteId: t.restauranteId,
        grupoId: op.Bacon.grupoId,
        nome: 'Extra temporário',
        precoCentavos: 0,
        ordem: 99,
      },
    });
    const itemRodada = await t.prisma.itemRodada.findFirstOrThrow({
      where: { rodadaId: r.id },
    });
    const selecao = itemRodada.selecao as Record<string, string[]>;
    await t.prisma.itemRodada.update({
      where: { id: itemRodada.id },
      data: {
        selecao: {
          ...selecao,
          [op.Bacon.grupoId]: [...selecao[op.Bacon.grupoId], bacon.id],
        },
      },
    });
    await t.prisma.opcao.delete({ where: { id: bacon.id } });
    await confirmar(r.id).expect(200);
    expect(await qtd('Massa')).toBe(9550);
  });

  it('venda que cruza o mínimo manda estoque-mudou para a equipe', async () => {
    await t.prisma.itemEstoque.update({
      where: { id: item.Massa },
      data: { minimo: 9600 },
    });
    const c = await clienteConfirmado();
    const equipeSpy = jest.spyOn(t.app.get(TempoRealService), 'paraEquipe');
    try {
      await enviar(c, pizzaG());
      expect(equipeSpy).toHaveBeenCalledWith(
        t.restauranteId,
        'estoque-mudou',
        {},
      );
      expect(
        await t.prisma.evento.count({ where: { tipo: 'EstoqueAcabando' } }),
      ).toBe(1);
    } finally {
      equipeSpy.mockRestore();
    }
  });

  it('dono marca prato esgotado e cardápio público mostra esgotado; garçom recebe 403', async () => {
    await http()
      .patch(`/equipe/pratos/${mix}`)
      .set('Cookie', ana)
      .send({ esgotado: true })
      .expect(403);
    const res = await http()
      .patch(`/equipe/pratos/${mix}`)
      .set('Cookie', dono)
      .send({ esgotado: true })
      .expect(200);
    expect(res.body).toEqual({ id: mix, esgotado: true });
    const cardapio = await http()
      .get(`/publico/mesas/${token7}/cardapio`)
      .expect(200);
    expect(JSON.stringify(cardapio.body)).toContain('"esgotado":true');
  });

  it('esgotado nunca muda sozinho: zerar o item mantém esgotado false', async () => {
    await receitaPrato(mix, [{ itemId: item.Chopp, quantidade: 10000 }]);
    await clienteConfirmado();
    expect(await qtd('Chopp')).toBe(0);
    const m = await t.prisma.prato.findUniqueOrThrow({ where: { id: mix } });
    expect(m.esgotado).toBe(false);
  });
});

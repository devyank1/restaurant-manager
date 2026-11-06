import request from 'supertest';
import { AppTeste, criarAppTeste } from './app-teste';

type Carrinho = {
  itens: {
    id: string;
    pratoId: string;
    nome: string;
    resumoOpcoes: string;
    quantidade: number;
    precoUnitarioCentavos: number;
  }[];
  totalCentavos: number;
};

describe('carrinho compartilhado', () => {
  let t: AppTeste;
  let token7: string;
  let token8: string;
  let mixId: string;
  let pastelId: string;
  let pizza: { id: string; tam: string; g: string; sab: string; marg: string };

  beforeAll(async () => {
    t = await criarAppTeste();
    const mesa = (numero: number) =>
      t.prisma.mesa.findFirstOrThrow({
        where: { restauranteId: t.restauranteId, numero },
      });
    token7 = (await mesa(7)).token;
    token8 = (await mesa(8)).token;
    const prato = (nome: string) =>
      t.prisma.prato.findFirstOrThrow({
        where: { nome },
        include: { grupos: { include: { opcoes: true } } },
      });
    mixId = (await prato('Mix da Casa')).id;
    pastelId = (await prato('Pastel de Carne Seca')).id;
    const p = await prato('Pizza Margherita');
    const grupo = (nome: string) => p.grupos.find((g) => g.nome === nome)!;
    pizza = {
      id: p.id,
      tam: grupo('Tamanho').id,
      g: grupo('Tamanho').opcoes.find((o) => o.nome === 'G')!.id,
      sab: grupo('Sabores').id,
      marg: grupo('Sabores').opcoes.find((o) => o.nome === 'Margherita')!.id,
    };
  });

  beforeEach(async () => {
    await t.prisma.sessaoMesa.deleteMany();
  });

  afterAll(async () => {
    await t.fechar();
  });

  /** Celular novo (agente com cookies próprios) que já entrou na mesa. */
  const celular = async (token = token7) => {
    const agente = request.agent(t.app.getHttpServer());
    await agente.post(`/publico/mesas/${token}/entrar`).expect(200);
    return agente;
  };
  const url = (token = token7) => `/publico/mesas/${token}/carrinho`;
  const mix = { pratoId: '', selecao: {}, observacao: '', quantidade: 1 };

  it('dois celulares veem o mesmo carrinho', async () => {
    const a = await celular();
    const b = await celular();
    await a
      .post(`${url()}/itens`)
      .send({ ...mix, pratoId: mixId })
      .expect(201);
    const res = await b.get(url()).expect(200);
    const corpo = res.body as Carrinho;
    expect(corpo.itens).toHaveLength(1);
    expect(corpo.itens[0]).toMatchObject({
      nome: 'Mix da Casa',
      precoUnitarioCentavos: 5990,
    });
    expect(corpo.totalCentavos).toBe(5990);
  });

  it('preço vem do servidor, não do cliente', async () => {
    const a = await celular();
    const res = await a
      .post(`${url()}/itens`)
      .send({ ...mix, pratoId: mixId, quantidade: 2, precoUnitarioCentavos: 1 })
      .expect(201);
    const corpo = res.body as Carrinho;
    expect(corpo.itens[0].precoUnitarioCentavos).toBe(5990);
    expect(corpo.totalCentavos).toBe(11980);
  });

  it('pizza com opções calcula preço e resumo no servidor', async () => {
    const a = await celular();
    const res = await a
      .post(`${url()}/itens`)
      .send({
        pratoId: pizza.id,
        selecao: { [pizza.tam]: [pizza.g], [pizza.sab]: [pizza.marg] },
        observacao: 'sem cebola',
        quantidade: 1,
      })
      .expect(201);
    expect((res.body as Carrinho).itens[0]).toMatchObject({
      resumoOpcoes: 'G · Margherita',
      precoUnitarioCentavos: 8990,
    });
  });

  it('mesmo prato, mesmas opções e observação soma na mesma linha (até 20)', async () => {
    const a = await celular();
    const b = await celular();
    const sucoIgual = { ...mix, pratoId: mixId };
    await a.post(`${url()}/itens`).send(sucoIgual).expect(201);
    await a.post(`${url()}/itens`).send(sucoIgual).expect(201);
    // Outro celular, mesmo item: também soma.
    const res = await b.post(`${url()}/itens`).send(sucoIgual).expect(201);
    expect((res.body as Carrinho).itens).toHaveLength(1);
    expect((res.body as Carrinho).itens[0].quantidade).toBe(3);

    // Observação diferente vira outra linha.
    const outra = await a
      .post(`${url()}/itens`)
      .send({ ...sucoIgual, observacao: 'sem gelo' })
      .expect(201);
    expect((outra.body as Carrinho).itens).toHaveLength(2);

    // Nunca passa de 20.
    const cheio = await a
      .post(`${url()}/itens`)
      .send({ ...sucoIgual, quantidade: 20 })
      .expect(201);
    expect((cheio.body as Carrinho).itens[0].quantidade).toBe(20);
  });

  it('pizza com as mesmas opções em outra ordem soma; opção diferente não', async () => {
    const a = await celular();
    const base = { pratoId: pizza.id, observacao: '', quantidade: 1 };
    await a
      .post(`${url()}/itens`)
      .send({
        ...base,
        selecao: { [pizza.tam]: [pizza.g], [pizza.sab]: [pizza.marg] },
      })
      .expect(201);
    const res = await a
      .post(`${url()}/itens`)
      .send({
        ...base,
        selecao: { [pizza.sab]: [pizza.marg], [pizza.tam]: [pizza.g] },
      })
      .expect(201);
    expect((res.body as Carrinho).itens).toHaveLength(1);
    expect((res.body as Carrinho).itens[0].quantidade).toBe(2);
  });

  it("prato esgotado → 422 'Pastel de Carne Seca está esgotado'", async () => {
    const a = await celular();
    const res = await a
      .post(`${url()}/itens`)
      .send({ ...mix, pratoId: pastelId })
      .expect(422);
    expect(res.body).toEqual({
      mensagem: 'Pastel de Carne Seca está esgotado',
    });
  });

  it("pizza sem tamanho → 422 'Escolha Tamanho'", async () => {
    const a = await celular();
    const res = await a
      .post(`${url()}/itens`)
      .send({
        ...mix,
        pratoId: pizza.id,
        selecao: { [pizza.sab]: [pizza.marg] },
      })
      .expect(422);
    expect(res.body).toEqual({ mensagem: 'Escolha Tamanho' });
  });

  it('quantidade fora de 1..20 e observação longa → 422', async () => {
    const a = await celular();
    await a
      .post(`${url()}/itens`)
      .send({ ...mix, pratoId: mixId, quantidade: 21 })
      .expect(422);
    await a
      .post(`${url()}/itens`)
      .send({ ...mix, pratoId: mixId, observacao: 'x'.repeat(141) })
      .expect(422);
  });

  it('PATCH 0 de item que o outro celular já removeu devolve o carrinho atual', async () => {
    const a = await celular();
    const b = await celular();
    const criado = await a
      .post(`${url()}/itens`)
      .send({ ...mix, pratoId: mixId })
      .expect(201);
    const id = (criado.body as Carrinho).itens[0].id;
    await a.patch(`${url()}/itens/${id}`).send({ quantidade: 0 }).expect(200);
    const res = await b
      .patch(`${url()}/itens/${id}`)
      .send({ quantidade: 0 })
      .expect(200);
    expect((res.body as Carrinho).itens).toEqual([]);
  });

  it('carrinho traz versão que cresce a cada mudança', async () => {
    const a = await celular();
    const r1 = await a
      .post(`${url()}/itens`)
      .send({ ...mix, pratoId: mixId })
      .expect(201);
    const r2 = await a
      .post(`${url()}/itens`)
      .send({ ...mix, pratoId: mixId })
      .expect(201);
    const v1 = (r1.body as { versao: number }).versao;
    const v2 = (r2.body as { versao: number }).versao;
    expect(typeof v1).toBe('number');
    expect(v2).toBeGreaterThan(v1);
  });

  it('PATCH quantidade 0 remove', async () => {
    const a = await celular();
    const criado = await a
      .post(`${url()}/itens`)
      .send({ ...mix, pratoId: mixId })
      .expect(201);
    const id = (criado.body as Carrinho).itens[0].id;
    const res = await a
      .patch(`${url()}/itens/${id}`)
      .send({ quantidade: 0 })
      .expect(200);
    expect((res.body as Carrinho).itens).toEqual([]);
  });

  it('DELETE de item já removido devolve 200 com o carrinho atual', async () => {
    const a = await celular();
    const b = await celular();
    const criado = await a
      .post(`${url()}/itens`)
      .send({ ...mix, pratoId: mixId })
      .expect(201);
    const id = (criado.body as Carrinho).itens[0].id;
    await a.delete(`${url()}/itens/${id}`).expect(200);
    const res = await b.delete(`${url()}/itens/${id}`).expect(200);
    expect((res.body as Carrinho).itens).toEqual([]);
  });

  it('cookie de outra mesa → 403', async () => {
    const daMesa8 = await celular(token8);
    await daMesa8.get(url(token7)).expect(403);
  });

  it('item de outra sessão → 404', async () => {
    const naMesa8 = await celular(token8);
    const criado = await naMesa8
      .post(`${url(token8)}/itens`)
      .send({ ...mix, pratoId: mixId })
      .expect(201);
    const id = (criado.body as Carrinho).itens[0].id;
    const naMesa7 = await celular();
    await naMesa7
      .patch(`${url()}/itens/${id}`)
      .send({ quantidade: 3 })
      .expect(404);
  });
});

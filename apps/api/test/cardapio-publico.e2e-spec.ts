import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { seedDemo } from '../prisma/seed';
import { AppModule } from '../src/app.module';

type Corpo = {
  mesa: { numero: number };
  restaurante: { nome: string; wifi: unknown };
  categorias: {
    nome: string;
    pratos: {
      nome: string;
      precoCentavos: number;
      precoPromocionalCentavos: number | null;
      destaque: boolean;
      esgotado: boolean;
      grupos: { nome: string; opcoes: { precoCentavos: number }[] }[];
    }[];
  }[];
};

describe('GET /publico/mesas/:token/cardapio', () => {
  const prisma = new PrismaClient();
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    const { restauranteId } = await seedDemo(prisma);
    await prisma.categoria.create({
      data: { restauranteId, nome: 'Vazia', ordem: 99 },
    });
    token = (
      await prisma.mesa.findFirstOrThrow({
        where: { restauranteId, numero: 7 },
      })
    ).token;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.restaurante.deleteMany({ where: { slug: 'demo' } });
    await prisma.$disconnect();
  });

  const buscar = () =>
    request(app.getHttpServer()).get(`/publico/mesas/${token}/cardapio`);

  it('devolve o cardápio da mesa sem vazar ids internos', async () => {
    const res = await buscar().expect(200);
    const corpo = res.body as Corpo;
    expect(corpo.mesa).toEqual({ numero: 7 });
    expect(corpo.restaurante.nome).toBe('Cantina Demo');
    expect(corpo.restaurante.wifi).toEqual({
      ssid: 'Cantina-Clientes',
      senha: 'bemvindo123',
    });
    expect(corpo.categorias.map((c) => c.nome)).toEqual([
      'Entradas',
      'Pizzas',
      'Pratos',
      'Bebidas',
      'Sobremesas',
    ]);
    expect(JSON.stringify(corpo)).not.toMatch(/restauranteId|"token"/);
  });

  it('mantém centavos, promo e esgotado', async () => {
    const res = await buscar();
    const pratos = (res.body as Corpo).categorias.flatMap((c) => c.pratos);
    const mix = pratos.find((p) => p.nome === 'Mix da Casa')!;
    expect([
      mix.precoCentavos,
      mix.precoPromocionalCentavos,
      mix.destaque,
    ]).toEqual([6990, 5990, true]);
    expect(
      pratos.find((p) => p.nome === 'Pastel de Carne Seca')!.esgotado,
    ).toBe(true);
    const pizza = pratos.find((p) => p.nome === 'Pizza Margherita')!;
    expect(pizza.grupos.map((g) => g.nome)).toEqual([
      'Tamanho',
      'Sabores',
      'Adicionais',
    ]);
    expect(pizza.grupos[0].opcoes.map((o) => o.precoCentavos)).toEqual([
      4990, 6990, 8990,
    ]);
  });

  it.each(['nao-existe', "x'%3B--", 'a'.repeat(500)])(
    'responde 404 limpo para token %s',
    async (t) => {
      await request(app.getHttpServer())
        .get(`/publico/mesas/${encodeURIComponent(t)}/cardapio`)
        .expect(404)
        .expect({ mensagem: 'Mesa não encontrada' });
    },
  );
});

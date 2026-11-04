import { PrismaClient } from '@prisma/client';
import { seedDemo } from '../prisma/seed';

describe('seedDemo', () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await seedDemo(prisma);
    await seedDemo(prisma);
  });

  afterAll(async () => {
    await prisma.restaurante.deleteMany({ where: { slug: 'demo' } });
    await prisma.$disconnect();
  });

  it('é idempotente e grava centavos exatos', async () => {
    expect(await prisma.restaurante.count({ where: { slug: 'demo' } })).toBe(1);
    expect(await prisma.mesa.count()).toBe(10);
    const mix = await prisma.prato.findFirstOrThrow({
      where: { nome: 'Mix da Casa' },
    });
    expect(mix.precoCentavos).toBe(6990);
    expect(mix.precoPromocionalCentavos).toBe(5990);
    expect(mix.destaque).toBe(true);
    const tokens = (await prisma.mesa.findMany()).map((m) => m.token);
    tokens.forEach((t) => expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/));
  });

  it('pizza tem Tamanho (UNICA, obrigatório) e Sabores (SABORES, max 2)', async () => {
    const pizza = await prisma.prato.findFirstOrThrow({
      where: { nome: 'Pizza Margherita' },
      include: {
        grupos: { include: { opcoes: { orderBy: { ordem: 'asc' } } } },
      },
    });
    const tamanho = pizza.grupos.find((g) => g.nome === 'Tamanho')!;
    expect(tamanho.tipo).toBe('UNICA');
    expect(tamanho.obrigatorio).toBe(true);
    expect(tamanho.opcoes.map((o) => o.nome)).toEqual(['P', 'M', 'G']);
    expect(pizza.grupos.find((g) => g.nome === 'Sabores')!.max).toBe(2);
  });

  it('mantém os tokens das mesas entre execuções', async () => {
    const antes = await prisma.mesa.findMany({ orderBy: { numero: 'asc' } });
    await seedDemo(prisma);
    const depois = await prisma.mesa.findMany({ orderBy: { numero: 'asc' } });
    expect(depois.map((m) => m.token)).toEqual(antes.map((m) => m.token));
  });

  it('pratos da demo apontam para os vídeos e posters estáticos', async () => {
    const mix = await prisma.prato.findFirstOrThrow({
      where: { nome: 'Mix da Casa' },
    });
    expect(mix.videoUrl).toBe('/demo/videos/mix-da-casa.mp4');
    expect(mix.posterUrl).toBe('/demo/videos/mix-da-casa.jpg');
    expect(
      await prisma.prato.count({ where: { videoUrl: { not: null } } }),
    ).toBe(10);
  });
});

import request from 'supertest';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

type Tempos = {
  categorias: {
    id: string;
    nome: string;
    estacao: string;
    tempoPreparoMin: number | null;
    pratos: { id: string; nome: string; tempoPreparoMin: number | null }[];
  }[];
};

describe('painéis', () => {
  let t: AppTeste;
  let dono: string;
  let ana: string;

  beforeAll(async () => {
    t = await criarAppTeste();
    dono = await loginComo(t.app, 'dono@demo.com');
    ana = await loginComo(t.app, 'ana@demo.com');
  });

  afterAll(async () => {
    await t.prisma.restaurante.deleteMany({ where: { slug: 'outro-paineis' } });
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());

  describe('tempos de preparo', () => {
    beforeEach(async () => {
      await t.prisma.categoria.updateMany({ data: { tempoPreparoMin: null } });
      await t.prisma.prato.updateMany({ data: { tempoPreparoMin: null } });
    });

    const tempos = async () =>
      (await http().get('/equipe/tempos').set('Cookie', dono).expect(200))
        .body as Tempos;

    it('gerente define o padrão da categoria e o tempo do prato', async () => {
      const antes = await tempos();
      const categoria = antes.categorias[0];
      const prato = categoria.pratos[0];
      expect(categoria.tempoPreparoMin).toBeNull();
      await http()
        .patch(`/equipe/tempos/categorias/${categoria.id}`)
        .set('Cookie', dono)
        .send({ tempoPreparoMin: 12 })
        .expect(200);
      await http()
        .patch(`/equipe/tempos/pratos/${prato.id}`)
        .set('Cookie', dono)
        .send({ tempoPreparoMin: 25 })
        .expect(200);
      const depois = await tempos();
      const c = depois.categorias.find((x) => x.id === categoria.id)!;
      expect(c.tempoPreparoMin).toBe(12);
      expect(c.pratos.find((p) => p.id === prato.id)!.tempoPreparoMin).toBe(25);
      await http()
        .patch(`/equipe/tempos/pratos/${prato.id}`)
        .set('Cookie', dono)
        .send({ tempoPreparoMin: null })
        .expect(200);
      const zerado = await tempos();
      expect(
        zerado.categorias
          .find((x) => x.id === categoria.id)!
          .pratos.find((p) => p.id === prato.id)!.tempoPreparoMin,
      ).toBeNull();
    });

    it('categorias vêm na ordem do cardápio, com a estação', async () => {
      const { categorias } = await tempos();
      const ordem = await t.prisma.categoria.findMany({
        where: { restauranteId: t.restauranteId },
        orderBy: { ordem: 'asc' },
      });
      expect(categorias.map((c) => c.id)).toEqual(ordem.map((c) => c.id));
      expect(categorias[0].estacao).toBe(ordem[0].estacao);
    });

    it('garçom recebe 403 em /equipe/tempos', async () => {
      await http().get('/equipe/tempos').set('Cookie', ana).expect(403);
    });

    it('tempo 0 ou 241 dá 422', async () => {
      const { categorias } = await tempos();
      for (const tempoPreparoMin of [0, 241, 2.5]) {
        await http()
          .patch(`/equipe/tempos/categorias/${categorias[0].id}`)
          .set('Cookie', dono)
          .send({ tempoPreparoMin })
          .expect(422);
      }
    });

    it('prato de outro restaurante dá 404', async () => {
      const outro = await t.prisma.restaurante.create({
        data: { nome: 'Outro', slug: 'outro-paineis' },
      });
      const cat = await t.prisma.categoria.create({
        data: { restauranteId: outro.id, nome: 'X', ordem: 1 },
      });
      const prato = await t.prisma.prato.create({
        data: {
          restauranteId: outro.id,
          categoriaId: cat.id,
          nome: 'Y',
          descricao: '',
          precoCentavos: 100,
          ordem: 1,
        },
      });
      await http()
        .patch(`/equipe/tempos/pratos/${prato.id}`)
        .set('Cookie', dono)
        .send({ tempoPreparoMin: 10 })
        .expect(404);
      await http()
        .patch(`/equipe/tempos/categorias/${cat.id}`)
        .set('Cookie', dono)
        .send({ tempoPreparoMin: 10 })
        .expect(404);
    });
  });
});

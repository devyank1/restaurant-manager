import request from 'supertest';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

type Limites = Record<string, { ativo: boolean; valor: number | null }>;

describe('central de alertas', () => {
  let t: AppTeste;
  let dono: string;
  let ana: string;

  beforeAll(async () => {
    t = await criarAppTeste();
    dono = await loginComo(t.app, 'dono@demo.com');
    ana = await loginComo(t.app, 'ana@demo.com');
  });

  afterAll(async () => {
    await t.prisma.restaurante.deleteMany({ where: { slug: 'outro-central' } });
    await t.prisma.limiteAlerta.deleteMany();
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());

  describe('limites', () => {
    const base = '/equipe/painel/central/limites';
    const ler = async () =>
      (await http().get(base).set('Cookie', dono).expect(200)).body as Limites;

    beforeEach(async () => {
      await t.prisma.limiteAlerta.deleteMany();
    });

    it('garçom recebe 403 em GET e PUT', async () => {
      await http().get(base).set('Cookie', ana).expect(403);
      await http()
        .put(`${base}/MESA_SEM_ATENDIMENTO`)
        .set('Cookie', ana)
        .send({ ativo: true, valor: 15 })
        .expect(403);
    });

    it('sem gravações devolve os padrões', async () => {
      const l = await ler();
      expect(l.MESA_SEM_ATENDIMENTO).toEqual({ ativo: true, valor: 10 });
      expect(Object.keys(l)).toHaveLength(11);
      expect(l.CHAMADO_PARA_TODOS).toBeDefined();
    });

    it('grava e lê de volta o valor e o desligado', async () => {
      await http()
        .put(`${base}/MESA_SEM_ATENDIMENTO`)
        .set('Cookie', dono)
        .send({ ativo: true, valor: 15 })
        .expect(200);
      await http()
        .put(`${base}/PEDIDO_ESQUECIDO`)
        .set('Cookie', dono)
        .send({ ativo: false, valor: null })
        .expect(200);
      const l = await ler();
      expect(l.MESA_SEM_ATENDIMENTO).toEqual({ ativo: true, valor: 15 });
      expect(l.PEDIDO_ESQUECIDO).toEqual({ ativo: false, valor: null });
    });

    it('valor null num tipo configurável volta ao padrão', async () => {
      await http()
        .put(`${base}/MESA_SEM_ATENDIMENTO`)
        .set('Cookie', dono)
        .send({ ativo: false, valor: null })
        .expect(200);
      const l = await ler();
      expect(l.MESA_SEM_ATENDIMENTO).toEqual({ ativo: false, valor: 10 });
    });

    it('rejeita valor fora da faixa ou em tipo sem valor', async () => {
      const put = (tipo: string, corpo: unknown) =>
        http()
          .put(`${base}/${tipo}`)
          .set('Cookie', dono)
          .send(corpo as object);
      await put('PEDIDO_ESQUECIDO', { ativo: true, valor: 5 }).expect(422);
      await put('MESA_SEM_ATENDIMENTO', { ativo: true, valor: 0 }).expect(422);
      await put('MESA_SEM_ATENDIMENTO', { ativo: true, valor: 61 }).expect(422);
      await put('MOVIMENTO_ALTO', { ativo: true, valor: 109 }).expect(422);
      await put('MOVIMENTO_ALTO', { ativo: true, valor: 300 }).expect(200);
      await put('MESA_SEM_ATENDIMENTO', { ativo: 'x', valor: 5 }).expect(422);
    });

    it('tipo desconhecido dá 404', async () => {
      const r = await http()
        .put(`${base}/FOO`)
        .set('Cookie', dono)
        .send({ ativo: true, valor: null })
        .expect(404);
      expect((r.body as { mensagem: string }).mensagem).toBe(
        'Tipo de alerta não encontrado',
      );
    });

    it('limite de um restaurante não aparece para outro', async () => {
      const outro = await t.prisma.restaurante.create({
        data: { nome: 'Outro', slug: 'outro-central' },
      });
      await t.prisma.limiteAlerta.create({
        data: {
          restauranteId: outro.id,
          tipo: 'MESA_SEM_ATENDIMENTO',
          ativo: false,
          valor: 44,
        },
      });
      const l = await ler();
      expect(l.MESA_SEM_ATENDIMENTO).toEqual({ ativo: true, valor: 10 });
    });
  });
});

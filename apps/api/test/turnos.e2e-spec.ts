import request from 'supertest';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

describe('turnos', () => {
  let t: AppTeste;
  let ana: string;
  let anaId: string;

  beforeAll(async () => {
    t = await criarAppTeste();
    ana = await loginComo(t.app, 'ana@demo.com');
    anaId = (
      await t.prisma.usuario.findUniqueOrThrow({
        where: { email: 'ana@demo.com' },
      })
    ).id;
  });

  beforeEach(async () => {
    await t.prisma.turnoEquipe.deleteMany();
    await t.prisma.usuario.updateMany({
      data: { emTurno: false, emTurnoDesde: null },
    });
  });

  afterAll(() => t.fechar());

  const turno = (emTurno: boolean) =>
    request(t.app.getHttpServer())
      .patch('/equipe/turno')
      .set('Cookie', ana)
      .send({ emTurno })
      .expect(200);

  it('ligar e desligar Em turno abre e fecha um TurnoEquipe', async () => {
    await turno(true);
    const aberto = await t.prisma.turnoEquipe.findMany({
      where: { usuarioId: anaId },
    });
    expect(aberto).toHaveLength(1);
    expect(aberto[0].fim).toBeNull();
    expect(aberto[0].restauranteId).toBe(t.restauranteId);
    await turno(false);
    const fechado = await t.prisma.turnoEquipe.findMany({
      where: { usuarioId: anaId },
    });
    expect(fechado).toHaveLength(1);
    expect(fechado[0].fim).not.toBeNull();
  });

  it('ligar duas vezes não abre dois turnos', async () => {
    await turno(true);
    await turno(true);
    expect(
      await t.prisma.turnoEquipe.count({
        where: { usuarioId: anaId, fim: null },
      }),
    ).toBe(1);
  });

  it('pausa: desligar e ligar de novo abre um turno novo', async () => {
    await turno(true);
    await turno(false);
    await turno(true);
    expect(
      await t.prisma.turnoEquipe.count({ where: { usuarioId: anaId } }),
    ).toBe(2);
  });
});

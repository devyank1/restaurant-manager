import request from 'supertest';
import { ChamadosService } from '../src/chamados/chamados.service';
import { hashSenha } from '../src/equipe/senha';
import { AppTeste, cookieDe, criarAppTeste, loginComo } from './app-teste';

type ChamadoEquipe = {
  id: string;
  tipo: string;
  status: string;
  mesa: { numero: number; token: string };
  paraTodos: boolean;
  tentativas: number;
};

describe('chamados', () => {
  let t: AppTeste;
  let token7: string;
  let ana: string;
  let bruno: string;

  beforeAll(async () => {
    t = await criarAppTeste();
    token7 = (
      await t.prisma.mesa.findFirstOrThrow({
        where: { restauranteId: t.restauranteId, numero: 7 },
      })
    ).token;
    ana = await loginComo(t.app, 'ana@demo.com');
    bruno = await loginComo(t.app, 'bruno@demo.com');
  });

  beforeEach(async () => {
    await t.prisma.sessaoMesa.deleteMany();
    await t.prisma.usuario.updateMany({
      data: { emTurno: false, emTurnoDesde: null, ultimoChamadoEm: null },
    });
  });

  afterAll(async () => {
    await t.prisma.restaurante.deleteMany({ where: { slug: 'outro' } });
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());
  const turno = (cookie: string, emTurno: boolean) =>
    http()
      .patch('/equipe/turno')
      .set('Cookie', cookie)
      .send({ emTurno })
      .expect(200);
  const clienteChama = async () => {
    const entrou = await http()
      .post(`/publico/mesas/${token7}/entrar`)
      .expect(200);
    const cookie = cookieDe(entrou.headers['set-cookie'], 'dispositivo');
    await http()
      .post(`/publico/mesas/${token7}/chamados`)
      .set('Cookie', cookie)
      .expect(201);
    return cookie;
  };
  const chamadosDe = async (cookie: string) =>
    (await http().get('/equipe/chamados').set('Cookie', cookie).expect(200))
      .body as ChamadoEquipe[];
  const idDe = async (email: string) =>
    (await t.prisma.usuario.findUniqueOrThrow({ where: { email } })).id;

  it('cliente chama e o chamado vai para o garçom livre em turno', async () => {
    await turno(ana, true);
    await clienteChama();
    const daAna = await chamadosDe(ana);
    expect(daAna).toHaveLength(1);
    expect(daAna[0]).toMatchObject({
      tipo: 'ATENDENTE',
      status: 'ABERTO',
      mesa: { numero: 7, token: token7 },
      paraTodos: false,
      tentativas: 1,
    });
    expect(await chamadosDe(bruno)).toEqual([]);
    const evento = await t.prisma.evento.findFirst({
      where: { tipo: 'ChamadoCriado' },
      orderBy: { criadoEm: 'desc' },
    });
    expect(evento).not.toBeNull();
  });

  it('sem ninguém em turno vira paraTodos e aparece quando alguém entra em turno', async () => {
    await clienteChama();
    const chamado = await t.prisma.chamado.findFirstOrThrow();
    expect(chamado).toMatchObject({ garcomId: null, paraTodos: true });
    await turno(bruno, true);
    expect(await chamadosDe(bruno)).toMatchObject([{ paraTodos: true }]);
  });

  it('chamar duas vezes não duplica', async () => {
    await turno(ana, true);
    const cookie = await clienteChama();
    await http()
      .post(`/publico/mesas/${token7}/chamados`)
      .set('Cookie', cookie)
      .expect(200);
    expect(await t.prisma.chamado.count()).toBe(1);
  });

  it('verificarVencidos repassa depois de 60 s e depois manda para todos', async () => {
    await turno(ana, true);
    await turno(bruno, true);
    // Bruno ocupado com outra mesa: Ana (livre) recebe primeiro.
    const mesa3 = await t.prisma.mesa.findFirstOrThrow({
      where: { restauranteId: t.restauranteId, numero: 3 },
    });
    await t.prisma.sessaoMesa.create({
      data: {
        restauranteId: t.restauranteId,
        mesaId: mesa3.id,
        garcomId: await idDe('bruno@demo.com'),
        garcomDesde: new Date(),
      },
    });
    await clienteChama();
    const servico = t.app.get(ChamadosService);
    const inicio = (
      await t.prisma.chamado.findFirstOrThrow({
        where: { mesa: { numero: 7 } },
      })
    ).atribuidoEm;
    expect((await chamadosDe(ana)).length).toBe(1);

    await servico.verificarVencidos(new Date(inicio.getTime() + 59_000));
    expect((await chamadosDe(ana)).length).toBe(1);

    await servico.verificarVencidos(new Date(inicio.getTime() + 61_000));
    const doBruno = await chamadosDe(bruno);
    expect(doBruno).toMatchObject([{ tentativas: 2, paraTodos: false }]);
    expect(await chamadosDe(ana)).toEqual([]);

    await servico.verificarVencidos(new Date(inicio.getTime() + 122_000));
    expect(await chamadosDe(ana)).toMatchObject([{ paraTodos: true }]);
    expect(await chamadosDe(bruno)).toMatchObject([{ paraTodos: true }]);
  });

  it('chamado lido não é repassado', async () => {
    await turno(ana, true);
    await turno(bruno, true);
    await clienteChama();
    const [chamado] = await chamadosDe(ana).then((l) =>
      l.length ? l : chamadosDe(bruno),
    );
    const dono = (await chamadosDe(ana)).length ? ana : bruno;
    await http()
      .post(`/equipe/chamados/${chamado.id}/lido`)
      .set('Cookie', dono)
      .expect(200);
    const antes = await t.prisma.chamado.findUniqueOrThrow({
      where: { id: chamado.id },
    });
    await t.app
      .get(ChamadosService)
      .verificarVencidos(new Date(antes.atribuidoEm.getTime() + 600_000));
    const depois = await t.prisma.chamado.findUniqueOrThrow({
      where: { id: chamado.id },
    });
    expect(depois).toMatchObject({
      status: 'LIDO',
      garcomId: antes.garcomId,
      tentativas: 1,
      paraTodos: false,
    });
  });

  it('Atendido resolve e o chamado some da lista', async () => {
    await turno(ana, true);
    await clienteChama();
    const [chamado] = await chamadosDe(ana);
    await http()
      .post(`/equipe/chamados/${chamado.id}/resolver`)
      .set('Cookie', ana)
      .expect(200);
    expect(await chamadosDe(ana)).toEqual([]);
  });

  it('garçom de outro restaurante recebe 404', async () => {
    await turno(ana, true);
    await clienteChama();
    const [chamado] = await chamadosDe(ana);

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
    expect(await chamadosDe(xavier)).toEqual([]);
    await http()
      .post(`/equipe/chamados/${chamado.id}/lido`)
      .set('Cookie', xavier)
      .expect(404);
    await http()
      .post(`/equipe/chamados/${chamado.id}/resolver`)
      .set('Cookie', xavier)
      .expect(404);
  });
});

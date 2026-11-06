import request from 'supertest';
import { AppTeste, cookieDe, criarAppTeste, loginComo } from './app-teste';

describe('login da equipe e turno', () => {
  let t: AppTeste;

  beforeAll(async () => {
    t = await criarAppTeste();
  });

  afterAll(async () => {
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());

  it('login certo devolve o usuário e o cookie httpOnly', async () => {
    const res = await http()
      .post('/equipe/login')
      .send({ email: 'ana@demo.com', senha: 'demo1234' })
      .expect(200);
    expect(res.body).toMatchObject({
      nome: 'Ana',
      papel: 'GARCOM',
      emTurno: false,
    });
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toContain('equipe=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('senha errada e e-mail inexistente dão a mesma resposta 401', async () => {
    const errada = await http()
      .post('/equipe/login')
      .send({ email: 'ana@demo.com', senha: 'errada' })
      .expect(401);
    const inexistente = await http()
      .post('/equipe/login')
      .send({ email: 'ninguem@demo.com', senha: 'demo1234' })
      .expect(401);
    expect(errada.body).toEqual({ mensagem: 'E-mail ou senha inválidos' });
    expect(inexistente.body).toEqual(errada.body);
  });

  it('GET /equipe/eu sem cookie → 401; com cookie → Ana', async () => {
    await http().get('/equipe/eu').expect(401);
    const cookie = await loginComo(t.app, 'ana@demo.com');
    const res = await http()
      .get('/equipe/eu')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body).toMatchObject({ nome: 'Ana' });
  });

  it('cookie adulterado → 401', async () => {
    const cookie = await loginComo(t.app, 'ana@demo.com');
    await http().get('/equipe/eu').set('Cookie', `${cookie}x`).expect(401);
  });

  it('PATCH /equipe/turno liga e grava emTurnoDesde', async () => {
    const cookie = await loginComo(t.app, 'bruno@demo.com');
    const res = await http()
      .patch('/equipe/turno')
      .set('Cookie', cookie)
      .send({ emTurno: true })
      .expect(200);
    expect(res.body).toMatchObject({ nome: 'Bruno', emTurno: true });
    const bruno = await t.prisma.usuario.findUniqueOrThrow({
      where: { email: 'bruno@demo.com' },
    });
    expect(bruno.emTurnoDesde).toBeInstanceOf(Date);
  });

  it('logout apaga o cookie', async () => {
    const cookie = await loginComo(t.app, 'ana@demo.com');
    const res = await http()
      .post('/equipe/logout')
      .set('Cookie', cookie)
      .expect(204);
    expect(cookieDe(res.headers['set-cookie'], 'equipe')).toBe('equipe=');
  });
});

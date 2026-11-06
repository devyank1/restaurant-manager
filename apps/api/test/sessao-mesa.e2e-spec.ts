import { HttpException } from '@nestjs/common';
import request from 'supertest';
import { SessaoMesaService } from '../src/sessao-mesa/sessao-mesa.service';
import { AppTeste, cookieDe, criarAppTeste } from './app-teste';

describe('sessão de mesa', () => {
  let t: AppTeste;
  let token7: string;
  let token8: string;

  const tokenDa = async (numero: number) =>
    (
      await t.prisma.mesa.findFirstOrThrow({
        where: { restauranteId: t.restauranteId, numero },
      })
    ).token;

  beforeAll(async () => {
    t = await criarAppTeste();
    token7 = await tokenDa(7);
    token8 = await tokenDa(8);
  });

  beforeEach(async () => {
    await t.prisma.sessaoMesa.deleteMany();
  });

  afterAll(async () => {
    await t.fechar();
  });

  const entrar = (token: string, cookie?: string) => {
    const req = request(t.app.getHttpServer()).post(
      `/publico/mesas/${token}/entrar`,
    );
    return cookie ? req.set('Cookie', cookie) : req;
  };

  it('primeiro acesso cria a sessão e o cookie dispositivo', async () => {
    const res = await entrar(token7).expect(200);
    expect(res.body).toEqual({ dispositivoConfirmado: false });
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toContain('dispositivo=');
    expect(setCookie).toContain('HttpOnly');
    expect(
      await t.prisma.sessaoMesa.count({ where: { status: 'ABERTA' } }),
    ).toBe(1);
  });

  it('segundo celular na mesma mesa entra na mesma sessão', async () => {
    await entrar(token7).expect(200);
    await entrar(token7).expect(200);
    const sessoes = await t.prisma.sessaoMesa.findMany({
      include: { dispositivos: true },
    });
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0].dispositivos).toHaveLength(2);
  });

  it('reabrir com o mesmo cookie não duplica o dispositivo', async () => {
    const res = await entrar(token7).expect(200);
    const cookie = cookieDe(res.headers['set-cookie'], 'dispositivo');
    const de_novo = await entrar(token7, cookie).expect(200);
    expect(de_novo.headers['set-cookie']).toBeUndefined();
    expect(await t.prisma.dispositivoSessao.count()).toBe(1);
  });

  it('entradas simultâneas não criam duas sessões abertas', async () => {
    await Promise.all(
      Array.from({ length: 20 }, () => entrar(token7).expect(200)),
    );
    expect(
      await t.prisma.sessaoMesa.count({ where: { status: 'ABERTA' } }),
    ).toBe(1);
  });

  it('exigirParticipante recusa cookie de outra mesa com 403', async () => {
    const res = await entrar(token8).expect(200);
    const dispositivoId = cookieDe(
      res.headers['set-cookie'],
      'dispositivo',
    ).split('=')[1];
    await entrar(token7).expect(200);
    const servico = t.app.get(SessaoMesaService);

    const erro = await servico
      .exigirParticipante(token7, dispositivoId)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(HttpException);
    expect((erro as HttpException).getStatus()).toBe(403);
    expect((erro as HttpException).getResponse()).toEqual({
      mensagem: 'Entre na mesa novamente',
      codigo: 'FORA_DA_SESSAO',
    });

    const participante = await servico.exigirParticipante(
      token8,
      dispositivoId,
    );
    expect(participante.mesa.numero).toBe(8);
    expect(participante.dispositivo.confirmado).toBe(false);
  });

  it('token inexistente → 404', async () => {
    const res = await entrar('nao-existe').expect(404);
    expect(res.body).toEqual({ mensagem: 'Mesa não encontrada' });
  });
});

import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { EventosService } from '../src/eventos/eventos.service';
import { TempoRealService } from '../src/tempo-real/tempo-real.service';
import { AppTeste, cookieDe, criarAppTeste, loginComo } from './app-teste';

describe('tempo real e eventos', () => {
  let t: AppTeste;
  let url: string;
  let token7: string;
  let token8: string;
  let mixId: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await criarAppTeste();
    await t.app.listen(0);
    const servidor = t.app.getHttpServer() as unknown as Server;
    const { port } = servidor.address() as AddressInfo;
    url = `http://localhost:${port}`;
    const mesa = (numero: number) =>
      t.prisma.mesa.findFirstOrThrow({
        where: { restauranteId: t.restauranteId, numero },
      });
    token7 = (await mesa(7)).token;
    token8 = (await mesa(8)).token;
    mixId = (
      await t.prisma.prato.findFirstOrThrow({ where: { nome: 'Mix da Casa' } })
    ).id;
  });

  afterEach(() => {
    sockets.splice(0).forEach((s) => s.disconnect());
  });

  afterAll(async () => {
    await t.fechar();
  });

  /** Entra na mesa e devolve o header Cookie do dispositivo. */
  const entrar = async (token: string) => {
    const res = await request(t.app.getHttpServer())
      .post(`/publico/mesas/${token}/entrar`)
      .expect(200);
    return cookieDe(res.headers['set-cookie'], 'dispositivo');
  };

  const conectar = async (cookie: string) => {
    const socket = io(url, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookie },
      forceNew: true,
    });
    sockets.push(socket);
    await new Promise<void>((ok) => socket.once('connect', () => ok()));
    return socket;
  };

  const proximo = <T>(socket: Socket, evento: string) =>
    new Promise<T>((ok) => socket.once(evento, (dados: T) => ok(dados)));

  it('celular B recebe o carrinho quando A adiciona', async () => {
    const a = await entrar(token7);
    const b = await entrar(token7);
    const socketB = await conectar(b);
    expect(await socketB.emitWithAck('entrar-mesa', { token: token7 })).toEqual(
      {
        ok: true,
      },
    );

    const chegou = proximo<{ itens: unknown[]; totalCentavos: number }>(
      socketB,
      'carrinho',
    );
    await request(t.app.getHttpServer())
      .post(`/publico/mesas/${token7}/carrinho/itens`)
      .set('Cookie', a)
      .send({ pratoId: mixId, selecao: {}, observacao: '', quantidade: 1 })
      .expect(201);

    const carrinho = await chegou;
    expect(carrinho.itens).toHaveLength(1);
    expect(carrinho.totalCentavos).toBe(5990);
  });

  it('entrar-mesa com cookie de outra mesa recebe ok:false e não recebe eventos', async () => {
    const daMesa8 = await entrar(token8);
    const daMesa7 = await entrar(token7);
    const intruso = await conectar(daMesa8);
    const resposta = (await intruso.emitWithAck('entrar-mesa', {
      token: token7,
    })) as { ok: boolean; mensagem?: string };
    expect(resposta).toEqual({
      ok: false,
      mensagem: 'Entre na mesa novamente',
    });

    let recebeu = false;
    intruso.on('carrinho', () => (recebeu = true));
    await request(t.app.getHttpServer())
      .post(`/publico/mesas/${token7}/carrinho/itens`)
      .set('Cookie', daMesa7)
      .send({ pratoId: mixId, selecao: {}, observacao: '', quantidade: 1 })
      .expect(201);
    await new Promise((ok) => setTimeout(ok, 200));
    expect(recebeu).toBe(false);
  });

  it('socket com cookie equipe entra na sala do garçom', async () => {
    const cookie = await loginComo(t.app, 'ana@demo.com');
    const ana = await t.prisma.usuario.findUniqueOrThrow({
      where: { email: 'ana@demo.com' },
    });
    const socket = await conectar(cookie);
    // A entrada nas salas acontece na conexão; dá um tique para concluir.
    await new Promise((ok) => setTimeout(ok, 100));
    const chegou = proximo<{ ola: number }>(socket, 'chamados-mudaram');
    t.app
      .get(TempoRealService)
      .paraGarcom(ana.id, 'chamados-mudaram', { ola: 1 });
    expect(await chegou).toEqual({ ola: 1 });
  });

  it('publicar grava Evento com tipo e dados', async () => {
    await t.app.get(EventosService).publicar({
      restauranteId: t.restauranteId,
      tipo: 'ChamadoCriado',
      dados: { chamadoId: 'x' },
    });
    const evento = await t.prisma.evento.findFirstOrThrow({
      where: { restauranteId: t.restauranteId, tipo: 'ChamadoCriado' },
    });
    expect(evento.dados).toEqual({ chamadoId: 'x' });
  });
});

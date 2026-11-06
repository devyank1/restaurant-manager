import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

jest.mock('web-push', () => ({
  __esModule: true,
  default: { sendNotification: jest.fn() },
}));

const enviarMock = webpush.sendNotification as jest.Mock;
/** Payload JSON da n-ésima chamada a sendNotification. */
const payload = (n: number): unknown =>
  JSON.parse((enviarMock.mock.calls[n] as [unknown, string])[1]);

const VAPID = {
  VAPID_PUBLICA: 'BPub',
  VAPID_PRIVADA: 'priv',
  VAPID_CONTATO: 'mailto:dono@demo.com',
};

const inscricao = (id: string, usuarioId: string) => ({
  id,
  usuarioId,
  endpoint: `https://push.exemplo/${id}`,
  p256dh: 'p',
  auth: 'a',
});

function criar(
  env: Partial<typeof VAPID>,
  dados: {
    inscricoes?: ReturnType<typeof inscricao>[];
    usuarios?: { id: string }[];
    chamado?: unknown;
  },
) {
  const prisma = {
    inscricaoPush: {
      findMany: jest.fn(
        ({ where }: { where: { usuarioId: { in: string[] } } }) =>
          Promise.resolve(
            (dados.inscricoes ?? []).filter((i) =>
              where.usuarioId.in.includes(i.usuarioId),
            ),
          ),
      ),
      deleteMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    usuario: { findMany: jest.fn(() => Promise.resolve(dados.usuarios ?? [])) },
    chamado: {
      findUnique: jest.fn(() => Promise.resolve(dados.chamado ?? null)),
    },
  };
  const config = { get: (chave: keyof typeof VAPID) => env[chave] };
  const servico = new PushService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );
  return { servico, prisma };
}

const msg = { titulo: 'Mesa 7', corpo: 'Chamou o atendente', url: '/mesa/x' };

describe('PushService', () => {
  beforeEach(() => enviarMock.mockReset().mockResolvedValue({}));

  it('envia para cada inscrição do usuário', async () => {
    const { servico } = criar(VAPID, {
      inscricoes: [
        inscricao('1', 'ana'),
        inscricao('2', 'ana'),
        inscricao('3', 'bruno'),
      ],
    });
    await servico.enviar('ana', msg);
    expect(enviarMock).toHaveBeenCalledTimes(2);
    const [sub, corpo, opcoes] = enviarMock.mock.calls[0] as [
      { endpoint: string; keys: { p256dh: string; auth: string } },
      string,
      { vapidDetails: { publicKey: string } },
    ];
    expect(sub).toEqual({
      endpoint: 'https://push.exemplo/1',
      keys: { p256dh: 'p', auth: 'a' },
    });
    expect(JSON.parse(corpo)).toEqual(msg);
    expect(opcoes.vapidDetails.publicKey).toBe('BPub');
  });

  it('inscrição 410 é apagada', async () => {
    enviarMock.mockRejectedValueOnce(
      Object.assign(new Error('Gone'), { statusCode: 410 }),
    );
    const { servico, prisma } = criar(VAPID, {
      inscricoes: [inscricao('1', 'ana')],
    });
    await servico.enviar('ana', msg);
    expect(prisma.inscricaoPush.deleteMany).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });

  it('erro 500 não lança', async () => {
    enviarMock.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { statusCode: 500 }),
    );
    const { servico, prisma } = criar(VAPID, {
      inscricoes: [inscricao('1', 'ana')],
    });
    await expect(servico.enviar('ana', msg)).resolves.toBeUndefined();
    expect(prisma.inscricaoPush.deleteMany).not.toHaveBeenCalled();
  });

  it('sem VAPID não chama web-push', async () => {
    const { servico } = criar({}, { inscricoes: [inscricao('1', 'ana')] });
    await servico.enviar('ana', msg);
    expect(enviarMock).not.toHaveBeenCalled();
    expect(servico.chavePublica()).toBeNull();
  });

  it('chamado paraTodos notifica todos em turno e o dono', async () => {
    const { servico, prisma } = criar(VAPID, {
      inscricoes: [
        inscricao('1', 'ana'),
        inscricao('2', 'bruno'),
        inscricao('3', 'carla'),
      ],
      usuarios: [{ id: 'ana' }, { id: 'bruno' }, { id: 'carla' }],
      chamado: {
        id: 'c1',
        restauranteId: 'r1',
        tipo: 'CONFIRMAR_RODADA',
        garcomId: null,
        paraTodos: true,
        mesa: { numero: 7, token: 'tok' },
      },
    });
    await servico.notificarChamado('c1');
    expect(prisma.usuario.findMany).toHaveBeenCalledWith({
      where: {
        restauranteId: 'r1',
        OR: [{ papel: 'GARCOM', emTurno: true }, { papel: 'DONO' }],
      },
      select: { id: true },
    });
    expect(enviarMock).toHaveBeenCalledTimes(3);
    expect(payload(0)).toEqual({
      titulo: 'Mesa 7',
      corpo: 'Novo pedido para confirmar',
      url: '/mesa/tok',
    });
  });

  it('chamado atribuído notifica só o garçom', async () => {
    const { servico } = criar(VAPID, {
      inscricoes: [inscricao('1', 'ana'), inscricao('2', 'bruno')],
      chamado: {
        id: 'c1',
        restauranteId: 'r1',
        tipo: 'ATENDENTE',
        garcomId: 'bruno',
        paraTodos: false,
        mesa: { numero: 3, token: 't3' },
      },
    });
    await servico.notificarChamado('c1');
    expect(enviarMock).toHaveBeenCalledTimes(1);
    expect(payload(0)).toMatchObject({
      corpo: 'Chamou o atendente',
    });
  });
});

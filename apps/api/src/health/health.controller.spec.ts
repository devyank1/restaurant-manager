import { HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('responde 503 com db fora quando o banco não responde', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as PrismaService;
    const controller = new HealthController(prisma);

    const erro = await controller.verificar().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(HttpException);
    expect((erro as HttpException).getStatus()).toBe(503);
    expect((erro as HttpException).getResponse()).toEqual({
      status: 'erro',
      db: 'fora',
    });
  });
});

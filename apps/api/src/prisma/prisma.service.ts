import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Sem $connect no onModuleInit: o Prisma conecta sob demanda, então a API
// sobe mesmo com o banco fora e o /health consegue reportar isso.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

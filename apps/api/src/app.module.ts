import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CardapioPublicoModule } from './cardapio-publico/cardapio-publico.module';
import { validarEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    PrismaModule,
    HealthModule,
    CardapioPublicoModule,
  ],
})
export class AppModule {}

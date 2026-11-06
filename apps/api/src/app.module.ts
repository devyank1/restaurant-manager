import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CardapioPublicoModule } from './cardapio-publico/cardapio-publico.module';
import { CarrinhoModule } from './carrinho/carrinho.module';
import { EquipeModule } from './equipe/equipe.module';
import { validarEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { SessaoMesaModule } from './sessao-mesa/sessao-mesa.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    PrismaModule,
    HealthModule,
    CardapioPublicoModule,
    EquipeModule,
    SessaoMesaModule,
    CarrinhoModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CardapioPublicoModule } from './cardapio-publico/cardapio-publico.module';
import { CarrinhoModule } from './carrinho/carrinho.module';
import { ChamadosModule } from './chamados/chamados.module';
import { ContaModule } from './conta/conta.module';
import { validarEnv } from './config/env';
import { EquipeModule } from './equipe/equipe.module';
import { EventosModule } from './eventos/eventos.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProducaoModule } from './producao/producao.module';
import { PushModule } from './push/push.module';
import { RodadasModule } from './rodadas/rodadas.module';
import { SessaoMesaModule } from './sessao-mesa/sessao-mesa.module';
import { TempoRealModule } from './tempo-real/tempo-real.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    EventosModule,
    TempoRealModule,
    HealthModule,
    CardapioPublicoModule,
    EquipeModule,
    SessaoMesaModule,
    CarrinhoModule,
    ChamadosModule,
    RodadasModule,
    PushModule,
    ProducaoModule,
    ContaModule,
  ],
})
export class AppModule {}

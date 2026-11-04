import { Module } from '@nestjs/common';
import { CardapioPublicoController } from './cardapio-publico.controller';
import { CardapioPublicoService } from './cardapio-publico.service';

@Module({
  controllers: [CardapioPublicoController],
  providers: [CardapioPublicoService],
})
export class CardapioPublicoModule {}

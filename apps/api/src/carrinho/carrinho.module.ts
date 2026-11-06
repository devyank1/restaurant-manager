import { Module } from '@nestjs/common';
import { SessaoMesaModule } from '../sessao-mesa/sessao-mesa.module';
import { CarrinhoController } from './carrinho.controller';
import { CarrinhoService } from './carrinho.service';

@Module({
  imports: [SessaoMesaModule],
  controllers: [CarrinhoController],
  providers: [CarrinhoService],
  exports: [CarrinhoService],
})
export class CarrinhoModule {}

import { Module } from '@nestjs/common';
import { CarrinhoModule } from '../carrinho/carrinho.module';
import { ChamadosModule } from '../chamados/chamados.module';
import { EquipeModule } from '../equipe/equipe.module';
import { SessaoMesaModule } from '../sessao-mesa/sessao-mesa.module';
import { MesasEquipeController } from './mesas-equipe.controller';
import { RodadasEquipeController } from './rodadas-equipe.controller';
import { RodadasEquipeService } from './rodadas-equipe.service';
import { RodadasPublicoController } from './rodadas-publico.controller';
import { RodadasService } from './rodadas.service';

@Module({
  imports: [CarrinhoModule, ChamadosModule, EquipeModule, SessaoMesaModule],
  controllers: [
    RodadasPublicoController,
    RodadasEquipeController,
    MesasEquipeController,
  ],
  providers: [RodadasService, RodadasEquipeService],
})
export class RodadasModule {}

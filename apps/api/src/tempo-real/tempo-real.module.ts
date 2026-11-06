import { Global, Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { SessaoMesaModule } from '../sessao-mesa/sessao-mesa.module';
import { TempoRealGateway } from './tempo-real.gateway';
import { TempoRealService } from './tempo-real.service';

@Global()
@Module({
  imports: [EquipeModule, SessaoMesaModule],
  providers: [TempoRealGateway, TempoRealService],
  exports: [TempoRealService],
})
export class TempoRealModule {}

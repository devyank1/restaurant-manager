import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { CentralController } from './central.controller';
import { LimitesService } from './limites.service';
import { MetaBatidaListener } from './meta-batida.listener';
import { MetasController } from './metas.controller';
import { PaineisController } from './paineis.controller';
import { PaineisService } from './paineis.service';
import { MetasService } from './metas.service';
import { TemposController } from './tempos.controller';
import { TemposService } from './tempos.service';

@Module({
  imports: [EquipeModule],
  controllers: [
    TemposController,
    MetasController,
    PaineisController,
    CentralController,
  ],
  providers: [
    TemposService,
    MetasService,
    PaineisService,
    LimitesService,
    MetaBatidaListener,
  ],
  exports: [MetasService],
})
export class PaineisModule {}

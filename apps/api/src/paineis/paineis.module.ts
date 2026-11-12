import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { MetaBatidaListener } from './meta-batida.listener';
import { MetasController } from './metas.controller';
import { PaineisController } from './paineis.controller';
import { PaineisService } from './paineis.service';
import { MetasService } from './metas.service';
import { TemposController } from './tempos.controller';
import { TemposService } from './tempos.service';

@Module({
  imports: [EquipeModule],
  controllers: [TemposController, MetasController, PaineisController],
  providers: [TemposService, MetasService, PaineisService, MetaBatidaListener],
  exports: [MetasService],
})
export class PaineisModule {}

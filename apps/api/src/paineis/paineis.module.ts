import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { MetasController } from './metas.controller';
import { MetasService } from './metas.service';
import { TemposController } from './tempos.controller';
import { TemposService } from './tempos.service';

@Module({
  imports: [EquipeModule],
  controllers: [TemposController, MetasController],
  providers: [TemposService, MetasService],
  exports: [MetasService],
})
export class PaineisModule {}

import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { TemposController } from './tempos.controller';
import { TemposService } from './tempos.service';

@Module({
  imports: [EquipeModule],
  controllers: [TemposController],
  providers: [TemposService],
})
export class PaineisModule {}

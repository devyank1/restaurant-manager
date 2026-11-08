import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { ProducaoController } from './producao.controller';
import { ProducaoService } from './producao.service';

@Module({
  imports: [EquipeModule],
  controllers: [ProducaoController],
  providers: [ProducaoService],
})
export class ProducaoModule {}

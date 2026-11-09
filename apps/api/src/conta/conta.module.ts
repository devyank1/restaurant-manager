import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { ContaController } from './conta.controller';
import { ContaService } from './conta.service';

@Module({
  imports: [EquipeModule],
  controllers: [ContaController],
  providers: [ContaService],
})
export class ContaModule {}

import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { SessaoMesaModule } from '../sessao-mesa/sessao-mesa.module';
import { ChamadosAgendador } from './chamados-agendador';
import {
  ChamadosEquipeController,
  ChamadosPublicoController,
} from './chamados.controller';
import { ChamadosService } from './chamados.service';

@Module({
  imports: [EquipeModule, SessaoMesaModule],
  controllers: [ChamadosPublicoController, ChamadosEquipeController],
  providers: [ChamadosService, ChamadosAgendador],
  exports: [ChamadosService],
})
export class ChamadosModule {}

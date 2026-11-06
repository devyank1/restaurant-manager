import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { RodadasEquipeService } from './rodadas-equipe.service';
import type { MesaEquipe, MesaResumo } from './rodadas.types';

@Controller('equipe/mesas')
@UseGuards(EquipeGuard)
export class MesasEquipeController {
  constructor(private readonly rodadas: RodadasEquipeService) {}

  @Get()
  listar(@UsuarioAtual() usuario: UsuarioToken): Promise<MesaResumo[]> {
    return this.rodadas.mesas(usuario);
  }

  @Get(':token')
  mesa(
    @Param('token') token: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<MesaEquipe> {
    return this.rodadas.mesa(token, usuario);
  }
}

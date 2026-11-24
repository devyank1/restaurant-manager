import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { PaineisService } from './paineis.service';
import type {
  PainelEquipe,
  PainelEstacao,
  PainelGarcom,
} from './paineis.types';

const periodoSchema = z.enum(['DIA', 'SEMANA']).default('DIA');

@Controller('equipe/painel')
@UseGuards(EquipeGuard)
export class PaineisController {
  constructor(private readonly paineis: PaineisService) {}

  @Get()
  equipe(
    @Query('periodo') periodo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<PainelEquipe> {
    return this.paineis.equipe(lerCorpo(periodoSchema, periodo), usuario);
  }

  @Get('eu')
  eu(@UsuarioAtual() usuario: UsuarioToken): Promise<PainelGarcom> {
    return this.paineis.eu(usuario);
  }

  @Get('estacao/:estacao')
  estacao(
    @Param('estacao') estacao: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<PainelEstacao> {
    return this.paineis.estacao(estacao, usuario);
  }
}

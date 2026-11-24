import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { TemposService } from './tempos.service';

const tempoSchema = z.object({
  tempoPreparoMin: z.number().int().min(1).max(240).nullable(),
});

@Controller('equipe/tempos')
@UseGuards(EquipeGuard)
export class TemposController {
  constructor(private readonly tempos: TemposService) {}

  @Get()
  listar(@UsuarioAtual() usuario: UsuarioToken) {
    return this.tempos.listar(usuario);
  }

  @Patch('categorias/:id')
  categoria(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    const { tempoPreparoMin } = lerCorpo(tempoSchema, corpo);
    return this.tempos.mudarCategoria(id, tempoPreparoMin, usuario);
  }

  @Patch('pratos/:id')
  prato(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    const { tempoPreparoMin } = lerCorpo(tempoSchema, corpo);
    return this.tempos.mudarPrato(id, tempoPreparoMin, usuario);
  }
}

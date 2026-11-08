import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { ProducaoService } from './producao.service';
import { FilaProducao, STATUS_PRODUCAO } from './producao.types';

const statusSchema = z.object({ status: z.enum(STATUS_PRODUCAO) });
const rodadaSchema = statusSchema.extend({
  estacao: z.string().trim().min(1).max(40),
});

@Controller('equipe/producao')
@UseGuards(EquipeGuard)
export class ProducaoController {
  constructor(private readonly producao: ProducaoService) {}

  @Get()
  fila(
    @Query('estacao') estacao: string | undefined,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<FilaProducao> {
    return this.producao.fila(usuario, estacao);
  }

  @Patch('itens/:id')
  @HttpCode(200)
  async mudarItem(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<{ ok: true }> {
    const { status } = lerCorpo(statusSchema, corpo);
    await this.producao.mudarItem(id, status, usuario);
    return { ok: true };
  }

  @Patch('rodadas/:id')
  @HttpCode(200)
  async mudarRodada(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<{ ok: true }> {
    const { estacao, status } = lerCorpo(rodadaSchema, corpo);
    await this.producao.mudarRodada(id, estacao, status, usuario);
    return { ok: true };
  }
}

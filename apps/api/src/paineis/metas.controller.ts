import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Put,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { MetasService, TipoPessoa } from './metas.service';

/** Até R$ 10 milhões ou 1 milhão de mesas: só barra número absurdo. */
const alvo = z.number().int().min(1).max(1_000_000_000);
const metaSchema = z.object({ periodo: z.enum(['DIA', 'SEMANA']), alvo });
const ajusteSchema = z.object({ alvo });
const estacaoSchema = z.object({
  noTempoPct: z.number().int().min(1).max(100).nullable(),
  zeroEsquecidos: z.boolean(),
});
const pausaSchema = z.object({
  horasSemPausa: z.number().int().min(1).max(12),
});

function tipoPessoa(tipo: string): TipoPessoa {
  if (tipo !== 'VALOR' && tipo !== 'MESAS') {
    throw new UnprocessableEntityException({
      mensagem: 'Tipo de meta inválido',
    });
  }
  return tipo;
}

@Controller('equipe')
@UseGuards(EquipeGuard)
export class MetasController {
  constructor(private readonly metas: MetasService) {}

  @Get('metas')
  config(@UsuarioAtual() usuario: UsuarioToken) {
    return this.metas.config(usuario);
  }

  @Put('metas/equipe/:tipo')
  async equipe(
    @Param('tipo') tipo: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    const t = tipoPessoa(tipo);
    await this.metas.salvarEquipe(t, lerCorpo(metaSchema, corpo), usuario);
    return {};
  }

  @Delete('metas/equipe/:tipo')
  @HttpCode(204)
  async apagarEquipe(
    @Param('tipo') tipo: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    await this.metas.salvarEquipe(tipoPessoa(tipo), null, usuario);
  }

  @Put('metas/garcom/:tipo')
  async padrao(
    @Param('tipo') tipo: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    const t = tipoPessoa(tipo);
    await this.metas.salvarPadrao(t, lerCorpo(metaSchema, corpo), usuario);
    return {};
  }

  @Delete('metas/garcom/:tipo')
  @HttpCode(204)
  async apagarPadrao(
    @Param('tipo') tipo: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    await this.metas.salvarPadrao(tipoPessoa(tipo), null, usuario);
  }

  @Get('metas/garcom/pessoa/:id')
  pessoa(@Param('id') id: string, @UsuarioAtual() usuario: UsuarioToken) {
    return this.metas.pessoa(id, usuario);
  }

  @Put('metas/garcom/pessoa/:id/:tipo')
  async ajuste(
    @Param('id') id: string,
    @Param('tipo') tipo: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    const t = tipoPessoa(tipo);
    const { alvo: valor } = lerCorpo(ajusteSchema, corpo);
    await this.metas.salvarAjuste(id, t, valor, usuario);
    return {};
  }

  @Delete('metas/garcom/pessoa/:id/:tipo')
  @HttpCode(204)
  async apagarAjuste(
    @Param('id') id: string,
    @Param('tipo') tipo: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    await this.metas.salvarAjuste(id, tipoPessoa(tipo), null, usuario);
  }

  @Put('metas/estacao/:estacao')
  async estacao(
    @Param('estacao') estacao: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    await this.metas.salvarEstacao(
      estacao,
      lerCorpo(estacaoSchema, corpo),
      usuario,
    );
    return {};
  }

  @Patch('configuracoes/painel')
  pausa(@Body() corpo: unknown, @UsuarioAtual() usuario: UsuarioToken) {
    const { horasSemPausa } = lerCorpo(pausaSchema, corpo);
    return this.metas.salvarHorasSemPausa(horasSemPausa, usuario);
  }
}

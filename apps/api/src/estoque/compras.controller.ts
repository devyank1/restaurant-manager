import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { QUANTIDADE_MAXIMA } from './quantidade';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { ComprasService } from './compras.service';
import { gerarPlanilha } from './planilha';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const itens = (minimo: number) =>
  z.object({
    itens: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          quantidade: z.number().int().max(QUANTIDADE_MAXIMA).min(minimo),
        }),
      )
      .min(1)
      .max(200),
  });

@Controller('equipe/estoque/compras')
@UseGuards(EquipeGuard)
export class ComprasController {
  constructor(private readonly compras: ComprasService) {}

  @Get('sugestao')
  sugestao(@UsuarioAtual() usuario: UsuarioToken) {
    return this.compras.sugestao(usuario);
  }

  @Post()
  salvar(@Body() corpo: unknown, @UsuarioAtual() usuario: UsuarioToken) {
    return this.compras.salvar(lerCorpo(itens(1), corpo).itens, usuario);
  }

  @Get(':id')
  lista(@Param('id') id: string, @UsuarioAtual() usuario: UsuarioToken) {
    return this.compras.lista(id, usuario);
  }

  @Get(':id/planilha')
  async planilha(
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioToken,
    @Res() res: Response,
  ): Promise<void> {
    const lista = await this.compras.lista(id, usuario);
    const arquivo = await gerarPlanilha(lista.grupos);
    const dia = lista.criadaEm.toISOString().slice(0, 10);
    res.setHeader('Content-Type', XLSX);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lista-de-compras-${dia}.xlsx"`,
    );
    res.send(arquivo);
  }

  @Post(':id/chegou')
  @HttpCode(200)
  async chegou(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    await this.compras.chegou(id, lerCorpo(itens(0), corpo).itens, usuario);
    return {};
  }
}

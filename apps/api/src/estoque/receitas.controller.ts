import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { QUANTIDADE_MAXIMA } from './quantidade';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { ReceitasService } from './receitas.service';

const linhas = z
  .array(
    z.object({
      itemId: z.string().uuid(),
      quantidade: z.number().int().max(QUANTIDADE_MAXIMA).min(1),
    }),
  )
  .max(50);

@Controller('equipe')
@UseGuards(EquipeGuard)
export class ReceitasController {
  constructor(private readonly receitas: ReceitasService) {}

  @Get('estoque/receitas')
  listar(@UsuarioAtual() usuario: UsuarioToken) {
    return this.receitas.listar(usuario);
  }

  @Put('estoque/receitas/pratos/:id')
  @HttpCode(200)
  async salvarPrato(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    const { itens } = lerCorpo(z.object({ itens: linhas }), corpo);
    await this.receitas.salvarPrato(id, itens, usuario);
    return {};
  }

  @Put('estoque/receitas/opcoes/:id')
  @HttpCode(200)
  async salvarOpcao(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    const { itens, multiplicadorPct } = lerCorpo(
      z.object({
        itens: linhas,
        multiplicadorPct: z.number().int().min(10).max(500).optional(),
      }),
      corpo,
    );
    await this.receitas.salvarOpcao(id, itens, multiplicadorPct, usuario);
    return {};
  }

  @Patch('pratos/:id')
  esgotar(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    const { esgotado } = lerCorpo(z.object({ esgotado: z.boolean() }), corpo);
    return this.receitas.esgotar(id, esgotado, usuario);
  }
}

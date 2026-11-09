import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { ContaService, type Fechamento } from './conta.service';

const fechamentoSchema = z
  .object({
    servico: z.boolean(),
    couvert: z.boolean(),
    pessoas: z.number().int().min(1).max(99).optional(),
    formaPagamento: z.enum(['CARTAO', 'PIX', 'DINHEIRO']),
    totalCentavos: z.number().int().min(0),
  })
  .superRefine((corpo, ctx) => {
    if (corpo.couvert && corpo.pessoas === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['pessoas'],
        message: 'Informe as pessoas',
      });
    }
  });

@Controller('equipe/mesas')
@UseGuards(EquipeGuard)
export class ContaController {
  constructor(private readonly conta: ContaService) {}

  @Post(':token/fechar')
  @HttpCode(200)
  fechar(
    @Param('token') token: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<Fechamento> {
    return this.conta.fechar(token, lerCorpo(fechamentoSchema, corpo), usuario);
  }
}

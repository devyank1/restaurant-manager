import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { exigirDono } from '../equipe/papel';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { LIMITES_PADRAO, type TipoAlerta } from './alertas';
import { LimitesService } from './limites.service';

/** Faixa do valor dos tipos configuráveis; os demais só ligam/desligam. */
const FAIXAS: Partial<Record<TipoAlerta, [number, number]>> = {
  MESA_SEM_ATENDIMENTO: [1, 60],
  CHAMADO_SEM_RESPOSTA: [1, 30],
  FILA_ACUMULADA: [1, 50],
  MOVIMENTO_ALTO: [110, 300],
};

const corpoSchema = z.object({
  ativo: z.boolean(),
  valor: z.number().int().nullable(),
});

function tipoAlerta(tipo: string): TipoAlerta {
  if (!Object.prototype.hasOwnProperty.call(LIMITES_PADRAO, tipo)) {
    throw new NotFoundException({ mensagem: 'Tipo de alerta não encontrado' });
  }
  return tipo as TipoAlerta;
}

@Controller('equipe/painel/central')
@UseGuards(EquipeGuard)
export class CentralController {
  constructor(private readonly limites: LimitesService) {}

  @Get('limites')
  lerLimites(@UsuarioAtual() usuario: UsuarioToken) {
    exigirDono(usuario);
    return this.limites.ler(usuario.restauranteId);
  }

  @Put('limites/:tipo')
  gravarLimite(
    @Param('tipo') tipo: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    exigirDono(usuario);
    const t = tipoAlerta(tipo);
    const faixa = FAIXAS[t];
    const schema = corpoSchema.refine(
      (c) =>
        c.valor === null ||
        (faixa !== undefined && c.valor >= faixa[0] && c.valor <= faixa[1]),
    );
    return this.limites.gravar(usuario, t, lerCorpo(schema, corpo));
  }
}

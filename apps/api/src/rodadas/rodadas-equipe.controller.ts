import {
  Body,
  Controller,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import {
  LIMITE_OBSERVACAO,
  novoItemSchema,
  QUANTIDADE_MAXIMA,
  selecaoSchema,
} from '../pedidos/pratos';
import { RodadasEquipeService } from './rodadas-equipe.service';
import type { RodadaEquipe } from './rodadas.types';

const edicaoSchema = z.object({
  quantidade: z.number().int().min(0).max(QUANTIDADE_MAXIMA).optional(),
  selecao: selecaoSchema.optional(),
  observacao: z.string().trim().max(LIMITE_OBSERVACAO).optional(),
});

@Controller('equipe/rodadas/:id')
@UseGuards(EquipeGuard)
export class RodadasEquipeController {
  constructor(private readonly rodadas: RodadasEquipeService) {}

  @Patch('itens/:itemId')
  editar(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<RodadaEquipe> {
    return this.rodadas.editarItem(
      id,
      itemId,
      lerCorpo(edicaoSchema, corpo),
      usuario,
    );
  }

  @Post('itens')
  adicionar(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<RodadaEquipe> {
    return this.rodadas.adicionarItem(
      id,
      lerCorpo(novoItemSchema, corpo),
      usuario,
    );
  }

  @Post('confirmar')
  @HttpCode(200)
  confirmar(
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<RodadaEquipe> {
    return this.rodadas.confirmar(id, usuario);
  }

  @Post('cancelar')
  @HttpCode(200)
  cancelar(
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<RodadaEquipe> {
    return this.rodadas.cancelar(id, usuario);
  }

  @Post('entregar')
  @HttpCode(200)
  entregar(
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<RodadaEquipe> {
    return this.rodadas.entregar(id, usuario);
  }

  @Post('recusar')
  @HttpCode(200)
  recusar(
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<RodadaEquipe> {
    return this.rodadas.recusar(id, usuario);
  }
}

import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { Dispositivo } from '../sessao-mesa/dispositivo.decorator';
import { SessaoMesaService } from '../sessao-mesa/sessao-mesa.service';
import { ChamadosService } from './chamados.service';
import type { ChamadoEquipe } from './chamados.types';

@Controller('publico/mesas/:token/chamados')
export class ChamadosPublicoController {
  constructor(
    private readonly sessoes: SessaoMesaService,
    private readonly chamados: ChamadosService,
  ) {}

  /** 201 quando cria; 200 quando já havia um aberto (sem duplicar). */
  @Post()
  async chamar(
    @Param('token') token: string,
    @Dispositivo() dispositivo: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const p = await this.sessoes.exigirParticipante(token, dispositivo);
    const { criado } = await this.chamados.chamarAtendente({
      restauranteId: p.restauranteId,
      mesaId: p.mesa.id,
      sessaoId: p.sessao.id,
    });
    res.status(criado ? 201 : 200);
    return { ok: true };
  }
}

@Controller('equipe/chamados')
@UseGuards(EquipeGuard)
export class ChamadosEquipeController {
  constructor(private readonly chamados: ChamadosService) {}

  @Get()
  listar(@UsuarioAtual() usuario: UsuarioToken): Promise<ChamadoEquipe[]> {
    return this.chamados.listar(usuario);
  }

  @Post(':id/lido')
  @HttpCode(200)
  lido(
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<ChamadoEquipe> {
    return this.chamados.marcarLido(id, usuario);
  }

  @Post(':id/resolver')
  @HttpCode(200)
  resolver(
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ): Promise<ChamadoEquipe> {
    return this.chamados.resolver(id, usuario);
  }
}

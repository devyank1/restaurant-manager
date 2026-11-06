import { Controller, Get, Param, Post } from '@nestjs/common';
import { Dispositivo } from '../sessao-mesa/dispositivo.decorator';
import { SessaoMesaService } from '../sessao-mesa/sessao-mesa.service';
import { RodadasService } from './rodadas.service';
import type { RodadaPublica, RodadasDaMesa } from './rodadas.types';

@Controller('publico/mesas/:token/rodadas')
export class RodadasPublicoController {
  constructor(
    private readonly sessoes: SessaoMesaService,
    private readonly rodadas: RodadasService,
  ) {}

  @Get()
  async listar(
    @Param('token') token: string,
    @Dispositivo() dispositivo: string | undefined,
  ): Promise<RodadasDaMesa> {
    const p = await this.sessoes.exigirParticipante(token, dispositivo);
    return this.rodadas.listar(p.sessao.id);
  }

  @Post()
  async enviar(
    @Param('token') token: string,
    @Dispositivo() dispositivo: string | undefined,
  ): Promise<RodadaPublica> {
    const p = await this.sessoes.exigirParticipante(token, dispositivo);
    return this.rodadas.enviar(p);
  }
}

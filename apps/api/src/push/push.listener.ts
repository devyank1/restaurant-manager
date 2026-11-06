import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CHAMADO_REPASSADO } from '../chamados/chamados.types';
import type { EventoDominio } from '../eventos/eventos.types';
import { PushService } from './push.service';

/** Push em chamado novo e em repasse, sem segurar a requisição. */
@Injectable()
export class PushListener {
  private readonly logger = new Logger(PushListener.name);

  constructor(private readonly push: PushService) {}

  @OnEvent('ChamadoCriado')
  aoCriar(evento: EventoDominio): void {
    this.notificar(evento.dados.chamadoId);
  }

  @OnEvent(CHAMADO_REPASSADO)
  aoRepassar(evento: { chamadoId: string }): void {
    this.notificar(evento.chamadoId);
  }

  private notificar(chamadoId: unknown): void {
    if (typeof chamadoId !== 'string') return;
    this.push.notificarChamado(chamadoId).catch((erro: unknown) => {
      this.logger.error('Falha ao notificar chamado', erro);
    });
  }
}

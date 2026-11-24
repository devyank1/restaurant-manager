import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CHAMADO_REPASSADO } from '../chamados/chamados.types';
import type { EventoDominio } from '../eventos/eventos.types';
import { ESTACAO_PRONTA } from '../producao/producao.types';
import type { EstacaoPronta } from '../producao/producao.types';
import { PushService } from './push.service';

/** Push em chamado novo, repasse, pedido direto e estação pronta, sem segurar a requisição. */
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

  @OnEvent('PedidoConfirmado')
  aoConfirmar(evento: EventoDominio): void {
    const { direto, rodadaId } = evento.dados;
    if (direto !== true || typeof rodadaId !== 'string') return;
    this.push.notificarPedidoDireto(rodadaId).catch((erro: unknown) => {
      this.logger.error('Falha ao notificar pedido direto', erro);
    });
  }

  @OnEvent(ESTACAO_PRONTA)
  aoFicarPronto(evento: EstacaoPronta): void {
    this.push.notificarEstacaoPronta(evento).catch((erro: unknown) => {
      this.logger.error('Falha ao notificar estação pronta', erro);
    });
  }

  private notificar(chamadoId: unknown): void {
    if (typeof chamadoId !== 'string') return;
    this.push.notificarChamado(chamadoId).catch((erro: unknown) => {
      this.logger.error('Falha ao notificar chamado', erro);
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import type { EventoDominio } from '../eventos/eventos.types';
import { PrismaService } from '../prisma/prisma.service';
import { ESTACAO_PRONTA } from '../producao/producao.types';
import type { EstacaoPronta } from '../producao/producao.types';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { PaineisService } from './paineis.service';
import { TURNO_MUDOU, type TurnoMudou } from './paineis.types';

/**
 * Painéis ao vivo: avisa a equipe quando os números mudam e comemora a meta
 * da equipe uma vez por período, sem segurar a requisição.
 */
@Injectable()
export class MetaBatidaListener {
  private readonly logger = new Logger(MetaBatidaListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paineis: PaineisService,
    private readonly tempoReal: TempoRealService,
  ) {}

  @OnEvent('PedidoConfirmado')
  @OnEvent('PedidoCancelado')
  @OnEvent('ContaFechada')
  aoMudarVenda(evento: EventoDominio): void {
    this.verificar(evento.restauranteId).catch((erro: unknown) => {
      this.logger.error('Falha ao verificar meta da equipe', erro);
    });
  }

  @OnEvent(ESTACAO_PRONTA)
  aoFicarPronto(evento: EstacaoPronta): void {
    this.prisma.rodada
      .findUnique({
        where: { id: evento.rodadaId },
        select: { restauranteId: true },
      })
      .then((r) => {
        if (r) this.tempoReal.paraEquipe(r.restauranteId, 'painel-mudou', {});
      })
      .catch((erro: unknown) => {
        this.logger.error('Falha ao avisar o painel', erro);
      });
  }

  @OnEvent(TURNO_MUDOU)
  aoMudarTurno(evento: TurnoMudou): void {
    this.tempoReal.paraEquipe(evento.restauranteId, 'painel-mudou', {});
  }

  async verificar(restauranteId: string, agora = new Date()): Promise<void> {
    this.tempoReal.paraEquipe(restauranteId, 'painel-mudou', {});
    const metas = await this.paineis.metasEquipeComId(restauranteId, agora);
    for (const { meta, inicio, progresso } of metas) {
      if (!progresso.batida) continue;
      const inicioIso = inicio.toISOString();
      const publicou = await this.prisma.$transaction(async (tx) => {
        // Uma comemoração por meta e período, mesmo com eventos em paralelo.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`meta-batida:${meta.id}`}))`;
        const ja = await tx.evento.findFirst({
          where: {
            restauranteId,
            tipo: 'MetaBatida',
            AND: [
              { dados: { path: ['metaId'], equals: meta.id } },
              { dados: { path: ['inicio'], equals: inicioIso } },
            ],
          },
        });
        if (ja) return false;
        await tx.evento.create({
          data: {
            restauranteId,
            tipo: 'MetaBatida',
            dados: {
              metaId: meta.id,
              inicio: inicioIso,
              tipo: meta.tipo,
              periodo: meta.periodo,
              alvo: meta.alvo,
            } satisfies Prisma.InputJsonObject,
          },
        });
        return true;
      });
      if (!publicou) continue;
      this.tempoReal.paraEquipe(restauranteId, 'meta-batida', {
        tipo: meta.tipo,
        periodo: meta.periodo,
        alvo: meta.alvo,
      });
    }
  }
}

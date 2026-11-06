import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventoDominio } from './eventos.types';

@Injectable()
export class EventosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emissor: EventEmitter2,
  ) {}

  /** Grava o evento (alimenta relatórios) e avisa os ouvintes internos. */
  async publicar(evento: EventoDominio): Promise<void> {
    await this.prisma.evento.create({
      data: {
        restauranteId: evento.restauranteId,
        tipo: evento.tipo,
        dados: evento.dados as Prisma.InputJsonObject,
      },
    });
    await this.emissor.emitAsync(evento.tipo, evento);
  }
}

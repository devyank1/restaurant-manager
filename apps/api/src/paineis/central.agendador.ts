import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { CentralService } from './central.service';

/** Recalcula a central a cada CENTRAL_VERIFICAR_MS (0 = desligado) e avisa a equipe se mudou. */
@Injectable()
export class CentralAgendador implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CentralAgendador.name);
  private timer: NodeJS.Timeout | null = null;
  private rodando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly central: CentralService,
    private readonly tempoReal: TempoRealService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const intervalo = this.config.get('CENTRAL_VERIFICAR_MS', { infer: true });
    if (intervalo > 0) {
      this.timer = setInterval(() => void this.tique(), intervalo);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async verificar(agora: Date): Promise<void> {
    const restaurantes = await this.prisma.restaurante.findMany({
      select: { id: true },
    });
    for (const { id } of restaurantes) {
      try {
        const { mudou } = await this.central.calcular(id, agora);
        if (mudou) this.tempoReal.paraEquipe(id, 'central-mudou', {});
      } catch (erro) {
        this.logger.error(`Falha ao verificar a central de ${id}`, erro);
      }
    }
  }

  private async tique(): Promise<void> {
    // Não empilha verificações se uma demorar mais que o intervalo.
    if (this.rodando) return;
    this.rodando = true;
    try {
      await this.verificar(new Date());
    } catch (erro) {
      this.logger.error('Falha ao verificar a central', erro);
    } finally {
      this.rodando = false;
    }
  }
}

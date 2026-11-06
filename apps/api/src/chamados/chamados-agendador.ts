import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { ChamadosService } from './chamados.service';

/** Verifica chamados vencidos a cada CHAMADOS_VERIFICAR_MS (0 = desligado). */
@Injectable()
export class ChamadosAgendador implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChamadosAgendador.name);
  private timer: NodeJS.Timeout | null = null;
  private rodando = false;

  constructor(
    private readonly chamados: ChamadosService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const intervalo = this.config.get('CHAMADOS_VERIFICAR_MS', { infer: true });
    if (intervalo > 0) {
      this.timer = setInterval(() => void this.verificar(), intervalo);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async verificar(): Promise<void> {
    // Não empilha verificações se uma demorar mais que o intervalo.
    if (this.rodando) return;
    this.rodando = true;
    try {
      await this.chamados.verificarVencidos(new Date());
    } catch (erro) {
      this.logger.error('Falha ao verificar chamados', erro);
    } finally {
      this.rodando = false;
    }
  }
}

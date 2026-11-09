import { Injectable, Logger } from '@nestjs/common';
import type { MotivoPerda } from '@prisma/client';
import { EventosService } from '../eventos/eventos.service';
import { PushService, type MensagemPush } from '../push/push.service';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import type { AvisoEstoque } from './movimentos';
import { formatarQuantidade } from './quantidade';

export const NOME_MOTIVO: Record<MotivoPerda, string> = {
  ACIDENTE: 'Acidente',
  VALIDADE: 'Validade',
  PREPARO: 'Erro de preparo',
  OUTRO: 'Outro',
};

function mensagem(aviso: AvisoEstoque): MensagemPush {
  if (aviso.tipo === 'PERDA') {
    return {
      titulo: `Perda: ${formatarQuantidade(aviso.quantidade, aviso.unidade)} de ${aviso.nome}`,
      corpo: NOME_MOTIVO[aviso.motivo],
      url: '/estoque',
    };
  }
  if (aviso.tipo === 'ACABANDO') {
    return {
      titulo: `Acabando: ${aviso.nome}`,
      corpo: 'Está no mínimo',
      url: '/estoque',
    };
  }
  return {
    titulo: `Acabou: ${aviso.nome}`,
    corpo: 'Marque os pratos como esgotados se precisar',
    url: '/estoque',
  };
}

/** Depois do commit: socket para a equipe, push para o gerente e eventos. */
@Injectable()
export class AvisosEstoqueService {
  private readonly logger = new Logger(AvisosEstoqueService.name);

  constructor(
    private readonly push: PushService,
    private readonly eventos: EventosService,
    private readonly tempoReal: TempoRealService,
  ) {}

  async enviar(restauranteId: string, avisos: AvisoEstoque[]): Promise<void> {
    this.tempoReal.paraEquipe(restauranteId, 'estoque-mudou', {});
    for (const aviso of avisos) {
      await this.eventos.publicar({
        restauranteId,
        tipo: aviso.tipo === 'PERDA' ? 'PerdaRegistrada' : 'EstoqueAcabando',
        dados: { ...aviso },
      });
      try {
        await this.push.notificarGerentes(restauranteId, mensagem(aviso));
      } catch (erro) {
        this.logger.warn(`push de estoque falhou: ${String(erro)}`);
      }
    }
  }
}

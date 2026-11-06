import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Avisos em tempo real. As telas usam o aviso para buscar o estado por REST
 * (exceto `carrinho`, que já leva o carrinho).
 */
@Injectable()
export class TempoRealService {
  private servidor: Server | null = null;

  ligar(servidor: Server): void {
    this.servidor = servidor;
  }

  paraSessao(sessaoId: string, evento: string, dados: unknown): void {
    this.servidor?.to(`sessao:${sessaoId}`).emit(evento, dados);
  }

  paraGarcom(usuarioId: string, evento: string, dados: unknown): void {
    this.servidor?.to(`garcom:${usuarioId}`).emit(evento, dados);
  }

  paraEquipe(restauranteId: string, evento: string, dados: unknown): void {
    this.servidor?.to(`equipe:${restauranteId}`).emit(evento, dados);
  }
}

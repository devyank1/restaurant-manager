import { HttpException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { lerCookies } from '../comum/cookies';
import { AuthService } from '../equipe/auth.service';
import { COOKIE_EQUIPE } from '../equipe/equipe.types';
import { COOKIE_DISPOSITIVO } from '../sessao-mesa/participante';
import { SessaoMesaService } from '../sessao-mesa/sessao-mesa.service';
import { TempoRealService } from './tempo-real.service';

type RespostaEntrar = { ok: true } | { ok: false; mensagem: string };

function mensagemDe(erro: unknown): string {
  const resposta = erro instanceof HttpException ? erro.getResponse() : null;
  if (typeof resposta === 'object' && resposta && 'mensagem' in resposta) {
    return String(resposta.mensagem);
  }
  return 'Não foi possível entrar na mesa';
}

@WebSocketGateway()
export class TempoRealGateway implements OnGatewayInit, OnGatewayConnection {
  constructor(
    private readonly tempoReal: TempoRealService,
    private readonly auth: AuthService,
    private readonly sessoes: SessaoMesaService,
  ) {}

  afterInit(servidor: Server): void {
    this.tempoReal.ligar(servidor);
  }

  /** Equipe logada entra nas salas do restaurante e do próprio garçom. */
  async handleConnection(socket: Socket): Promise<void> {
    const cookies = lerCookies(socket.handshake.headers.cookie);
    const usuario = await this.auth.lerToken(cookies[COOKIE_EQUIPE]);
    if (usuario) {
      await socket.join([
        `equipe:${usuario.restauranteId}`,
        `garcom:${usuario.id}`,
      ]);
    }
  }

  /** Cliente pede para ouvir a mesa; só entra quem é da sessão aberta. */
  @SubscribeMessage('entrar-mesa')
  async entrarMesa(
    @ConnectedSocket() socket: Socket,
    @MessageBody() corpo: unknown,
  ): Promise<RespostaEntrar> {
    const token =
      typeof corpo === 'object' && corpo !== null && 'token' in corpo
        ? String(corpo.token)
        : '';
    const cookies = lerCookies(socket.handshake.headers.cookie);
    try {
      const p = await this.sessoes.exigirParticipante(
        token,
        cookies[COOKIE_DISPOSITIVO],
      );
      await socket.join(`sessao:${p.sessao.id}`);
      return { ok: true };
    } catch (erro) {
      return { ok: false, mensagem: mensagemDe(erro) };
    }
  }
}

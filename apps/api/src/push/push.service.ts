import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export type MensagemPush = { titulo: string; corpo: string; url: string };

type Vapid = { publicKey: string; privateKey: string; subject: string };

const CORPO_POR_TIPO = {
  ATENDENTE: 'Chamou o atendente',
  CONFIRMAR_RODADA: 'Novo pedido para confirmar',
} as const;

/** Push para o celular da equipe. Falha de push nunca derruba requisição. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly vapid: Vapid | null;
  private avisouSemChave = false;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env>,
  ) {
    const publica = config.get('VAPID_PUBLICA', { infer: true });
    const privada = config.get('VAPID_PRIVADA', { infer: true });
    const contato = config.get('VAPID_CONTATO', { infer: true });
    this.vapid =
      publica && privada && contato
        ? { publicKey: publica, privateKey: privada, subject: contato }
        : null;
  }

  chavePublica(): string | null {
    return this.vapid?.publicKey ?? null;
  }

  async inscrever(
    usuario: { id: string; restauranteId: string },
    inscricao: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<void> {
    const dados = {
      restauranteId: usuario.restauranteId,
      usuarioId: usuario.id,
      p256dh: inscricao.keys.p256dh,
      auth: inscricao.keys.auth,
    };
    await this.prisma.inscricaoPush.upsert({
      where: { endpoint: inscricao.endpoint },
      create: { endpoint: inscricao.endpoint, ...dados },
      update: dados,
    });
  }

  enviar(usuarioId: string, msg: MensagemPush): Promise<void> {
    return this.enviarPara([usuarioId], msg);
  }

  private async enviarPara(
    usuarioIds: string[],
    msg: MensagemPush,
  ): Promise<void> {
    if (!this.vapid) {
      if (!this.avisouSemChave) {
        this.logger.warn('VAPID não configurado: push desligado');
        this.avisouSemChave = true;
      }
      return;
    }
    const vapidDetails = this.vapid;
    const inscricoes = await this.prisma.inscricaoPush.findMany({
      where: { usuarioId: { in: usuarioIds } },
    });
    await Promise.all(
      inscricoes.map(async (i) => {
        try {
          await webpush.sendNotification(
            { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
            JSON.stringify(msg),
            { vapidDetails },
          );
        } catch (erro) {
          const status = (erro as { statusCode?: number }).statusCode;
          // Inscrição expirada ou cancelada pelo navegador.
          if (status === 404 || status === 410) {
            await this.prisma.inscricaoPush.deleteMany({ where: { id: i.id } });
          } else {
            this.logger.error(`Falha no push (${status ?? 'sem status'})`);
          }
        }
      }),
    );
  }

  /** Garçom atribuído; se paraTodos, todos em turno + o dono. */
  async notificarChamado(chamadoId: string): Promise<void> {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      include: { mesa: { select: { numero: true, token: true } } },
    });
    if (!chamado) return;

    let destinatarios: string[] = [];
    if (chamado.paraTodos) {
      const usuarios = await this.prisma.usuario.findMany({
        where: {
          restauranteId: chamado.restauranteId,
          OR: [{ papel: 'GARCOM', emTurno: true }, { papel: 'DONO' }],
        },
        select: { id: true },
      });
      destinatarios = usuarios.map((u) => u.id);
    } else if (chamado.garcomId) {
      destinatarios = [chamado.garcomId];
    }
    if (destinatarios.length === 0) return;

    await this.enviarPara(destinatarios, {
      titulo: `Mesa ${chamado.mesa.numero}`,
      corpo: CORPO_POR_TIPO[chamado.tipo],
      url: `/mesa/${chamado.mesa.token}`,
    });
  }
}

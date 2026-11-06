import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { tokenValido } from '../mesas/token';
import { PrismaService } from '../prisma/prisma.service';
import { dispositivoValido, Participante } from './participante';
import { travarMesa } from './trava';

const MESA_NAO_ENCONTRADA = { mensagem: 'Mesa não encontrada' };

@Injectable()
export class SessaoMesaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Entra na sessão aberta da mesa (cria se não houver).
   * `dispositivoId` inválido ou ausente → gera um novo (`novo: true`).
   */
  async entrar(
    token: string,
    dispositivoId: unknown,
  ): Promise<{ dispositivoId: string; novo: boolean; confirmado: boolean }> {
    const mesa = await this.buscarMesa(token);
    const novo = !dispositivoValido(dispositivoId);
    const id = novo ? randomUUID() : dispositivoId;

    return this.prisma.$transaction(async (tx) => {
      await travarMesa(tx, mesa.id);
      const sessao =
        (await tx.sessaoMesa.findFirst({
          where: { mesaId: mesa.id, status: 'ABERTA' },
        })) ??
        (await tx.sessaoMesa.create({
          data: { restauranteId: mesa.restauranteId, mesaId: mesa.id },
        }));
      const dispositivo = await tx.dispositivoSessao.upsert({
        where: {
          sessaoId_dispositivoId: { sessaoId: sessao.id, dispositivoId: id },
        },
        create: {
          restauranteId: mesa.restauranteId,
          sessaoId: sessao.id,
          dispositivoId: id,
        },
        update: {},
      });
      return { dispositivoId: id, novo, confirmado: dispositivo.confirmado };
    });
  }

  /** Garante que o dispositivo está na sessão aberta da mesa do token. */
  async exigirParticipante(
    token: string,
    dispositivoId: unknown,
  ): Promise<Participante> {
    const mesa = await this.buscarMesa(token);
    const fora = new ForbiddenException({
      mensagem: 'Entre na mesa novamente',
      codigo: 'FORA_DA_SESSAO',
    });
    if (!dispositivoValido(dispositivoId)) throw fora;

    const sessao = await this.prisma.sessaoMesa.findFirst({
      where: { mesaId: mesa.id, status: 'ABERTA' },
      include: { dispositivos: { where: { dispositivoId } } },
    });
    const dispositivo = sessao?.dispositivos[0];
    if (!sessao || !dispositivo) throw fora;

    return {
      restauranteId: mesa.restauranteId,
      mesa: { id: mesa.id, numero: mesa.numero },
      sessao: { id: sessao.id, garcomId: sessao.garcomId },
      dispositivo: {
        id: dispositivo.id,
        dispositivoId: dispositivo.dispositivoId,
        confirmado: dispositivo.confirmado,
      },
    };
  }

  private async buscarMesa(token: string) {
    const mesa = tokenValido(token)
      ? await this.prisma.mesa.findUnique({ where: { token } })
      : null;
    if (!mesa) throw new NotFoundException(MESA_NAO_ENCONTRADA);
    return mesa;
  }
}

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import type { UsuarioToken } from '../equipe/equipe.types';
import { exigirSalao } from '../equipe/papel';
import { EventosService } from '../eventos/eventos.service';
import { PrismaService } from '../prisma/prisma.service';
import { travarMesa } from '../sessao-mesa/trava';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import {
  CHAMADO_REPASSADO,
  ChamadoEquipe,
  NovoChamado,
} from './chamados.types';
import { CandidatoGarcom, escolherGarcom } from './escolher-garcom';

type Cliente = Prisma.TransactionClient | PrismaService;

const COM_MESA = {
  mesa: { select: { numero: true, token: true } },
} satisfies Prisma.ChamadoInclude;

type ChamadoComMesa = Prisma.ChamadoGetPayload<{ include: typeof COM_MESA }>;

const CHAMADO_NAO_ENCONTRADO = () =>
  new NotFoundException({ mensagem: 'Chamado não encontrado' });

function paraEquipe(c: ChamadoComMesa): ChamadoEquipe {
  return {
    id: c.id,
    tipo: c.tipo,
    status: c.status,
    mesa: c.mesa,
    criadoEm: c.criadoEm,
    paraTodos: c.paraTodos,
    tentativas: c.tentativas,
  };
}

@Injectable()
export class ChamadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
    private readonly tempoReal: TempoRealService,
    private readonly emissor: EventEmitter2,
  ) {}

  /** Garçons em turno com os números da regra de escolha. */
  private async candidatos(
    db: Cliente,
    restauranteId: string,
  ): Promise<CandidatoGarcom[]> {
    const garcons = await db.usuario.findMany({
      where: { restauranteId, papel: 'GARCOM', emTurno: true },
    });
    return Promise.all(
      garcons.map(async (g) => ({
        id: g.id,
        mesasAbertas: await db.sessaoMesa.count({
          where: { garcomId: g.id, status: 'ABERTA' },
        }),
        mesasAtendidasNoTurno: await db.sessaoMesa.count({
          where: {
            garcomId: g.id,
            garcomDesde: { gte: g.emTurnoDesde ?? new Date(0) },
          },
        }),
        ultimoChamadoEm: g.ultimoChamadoEm,
      })),
    );
  }

  private async escolher(
    db: Cliente,
    restauranteId: string,
    sessaoId: string,
    excluir: string[],
  ): Promise<string | null> {
    const sessao = await db.sessaoMesa.findUnique({ where: { id: sessaoId } });
    return escolherGarcom(
      await this.candidatos(db, restauranteId),
      sessao?.garcomId ?? null,
      excluir,
    );
  }

  private async marcarChamadoPara(db: Cliente, garcomId: string, em: Date) {
    await db.usuario.update({
      where: { id: garcomId },
      data: { ultimoChamadoEm: em },
    });
  }

  /** Todas as telas da equipe buscam a lista de novo. */
  private avisarEquipe(restauranteId: string): void {
    this.tempoReal.paraEquipe(restauranteId, 'chamados-mudaram', {});
  }

  async abrir(novo: NovoChamado): Promise<ChamadoEquipe> {
    const agora = new Date();
    const chamado = await this.prisma.$transaction((tx) =>
      this.criar(tx, novo, agora),
    );
    await this.depoisDeAbrir(chamado);
    return paraEquipe(chamado);
  }

  /** Cria dentro de uma transação já aberta (usada também pela Task 7). */
  async criar(
    tx: Prisma.TransactionClient,
    novo: NovoChamado,
    agora = new Date(),
  ): Promise<ChamadoComMesa> {
    const garcomId = await this.escolher(
      tx,
      novo.restauranteId,
      novo.sessaoId,
      [],
    );
    if (garcomId) await this.marcarChamadoPara(tx, garcomId, agora);
    return tx.chamado.create({
      data: {
        ...novo,
        garcomId,
        paraTodos: garcomId === null,
        atribuidoEm: agora,
      },
      include: COM_MESA,
    });
  }

  /** Persistir evento e avisar telas, depois do commit. */
  async depoisDeAbrir(chamado: ChamadoComMesa): Promise<void> {
    await this.eventos.publicar({
      restauranteId: chamado.restauranteId,
      tipo: 'ChamadoCriado',
      dados: {
        chamadoId: chamado.id,
        tipo: chamado.tipo,
        mesaId: chamado.mesaId,
        garcomId: chamado.garcomId,
      },
    });
    this.avisarEquipe(chamado.restauranteId);
  }

  /**
   * Cliente pede atendente. Já existe um não resolvido na sessão → não cria
   * outro (`criado: false`).
   */
  async chamarAtendente(p: {
    restauranteId: string;
    mesaId: string;
    sessaoId: string;
  }): Promise<{ criado: boolean }> {
    const criado = await this.prisma.$transaction(async (tx) => {
      await travarMesa(tx, p.mesaId);
      const existente = await tx.chamado.findFirst({
        where: {
          sessaoId: p.sessaoId,
          tipo: 'ATENDENTE',
          status: { not: 'RESOLVIDO' },
        },
      });
      if (existente) return null;
      return this.criar(tx, { ...p, tipo: 'ATENDENTE' });
    });
    if (criado) await this.depoisDeAbrir(criado);
    return { criado: criado !== null };
  }

  /** Não resolvidos meus ou para todos, mais antigos primeiro. */
  async listar(usuario: UsuarioToken): Promise<ChamadoEquipe[]> {
    exigirSalao(usuario);
    const chamados = await this.prisma.chamado.findMany({
      where: {
        restauranteId: usuario.restauranteId,
        status: { not: 'RESOLVIDO' },
        OR: [{ garcomId: usuario.id }, { paraTodos: true }],
      },
      orderBy: { criadoEm: 'asc' },
      include: COM_MESA,
    });
    return chamados.map(paraEquipe);
  }

  private async doRestaurante(id: string, restauranteId: string) {
    const chamado = await this.prisma.chamado.findFirst({
      where: { id, restauranteId },
    });
    if (!chamado) throw CHAMADO_NAO_ENCONTRADO();
    return chamado;
  }

  /** Lido para o repasse. */
  /**
   * Só ABERTO → LIDO: lido depois de resolvido não reabre. Ler para o
   * repasse, então só quem recebeu (ou chamado para todos, ou o dono).
   */
  async marcarLido(id: string, usuario: UsuarioToken): Promise<ChamadoEquipe> {
    exigirSalao(usuario);
    const atual = await this.doRestaurante(id, usuario.restauranteId);
    if (
      usuario.papel !== 'DONO' &&
      !atual.paraTodos &&
      atual.garcomId !== usuario.id
    ) {
      throw new ForbiddenException({
        mensagem: 'Este chamado é de outro garçom',
      });
    }
    const { count } = await this.prisma.chamado.updateMany({
      where: { id, status: 'ABERTO' },
      data: { status: 'LIDO', lidoEm: new Date() },
    });
    if (count > 0) this.avisarEquipe(usuario.restauranteId);
    return this.paraEquipePorId(id);
  }

  private async paraEquipePorId(id: string): Promise<ChamadoEquipe> {
    return paraEquipe(
      await this.prisma.chamado.findUniqueOrThrow({
        where: { id },
        include: COM_MESA,
      }),
    );
  }

  /** "Atendido". Só ATENDENTE: confirmar rodada se resolve confirmando. */
  async resolver(id: string, usuario: UsuarioToken): Promise<ChamadoEquipe> {
    exigirSalao(usuario);
    const atual = await this.doRestaurante(id, usuario.restauranteId);
    if (atual.tipo !== 'ATENDENTE') {
      throw new UnprocessableEntityException({
        mensagem: 'Confirme ou recuse a rodada na tela da mesa',
      });
    }
    // Repetir "Atendido" não reemite o aviso.
    const { count } = await this.prisma.chamado.updateMany({
      where: { id, status: { not: 'RESOLVIDO' } },
      data: { status: 'RESOLVIDO', resolvidoEm: new Date() },
    });
    if (count > 0) {
      this.avisarEquipe(usuario.restauranteId);
      this.tempoReal.paraSessao(atual.sessaoId, 'chamado-atendido', {
        chamadoId: id,
      });
    }
    return this.paraEquipePorId(id);
  }

  /**
   * Chamados abertos sem leitura dentro da janela: 1ª vez repassa para outro
   * garçom; 2ª vez (ou sem outro) vai para todos. `agora` injetável no teste.
   */
  async verificarVencidos(agora: Date): Promise<void> {
    const restaurantes = await this.prisma.restaurante.findMany({
      select: { id: true, janelaChamadoSegundos: true },
    });
    for (const r of restaurantes) {
      const limite = new Date(agora.getTime() - r.janelaChamadoSegundos * 1000);
      const vencidos = await this.prisma.chamado.findMany({
        where: {
          restauranteId: r.id,
          status: 'ABERTO',
          paraTodos: false,
          atribuidoEm: { lt: limite },
        },
      });
      for (const chamado of vencidos) {
        await this.repassar(chamado.id, limite, agora);
      }
      if (vencidos.length > 0) this.avisarEquipe(r.id);
    }
  }

  private async repassar(id: string, limite: Date, agora: Date) {
    const repassado = await this.prisma.$transaction(async (tx) => {
      const chamado = await tx.chamado.findUnique({ where: { id } });
      await travarMesa(tx, chamado!.mesaId);
      // Relê sob a trava: pode ter sido lido/resolvido nesse meio-tempo.
      const atual = await tx.chamado.findFirst({
        where: {
          id,
          status: 'ABERTO',
          paraTodos: false,
          atribuidoEm: { lt: limite },
        },
      });
      if (!atual) return false;
      const proximo =
        atual.tentativas === 1
          ? await this.escolher(
              tx,
              atual.restauranteId,
              atual.sessaoId,
              atual.garcomId ? [atual.garcomId] : [],
            )
          : null;
      if (proximo) {
        await this.marcarChamadoPara(tx, proximo, agora);
        await tx.chamado.update({
          where: { id },
          data: { garcomId: proximo, tentativas: 2, atribuidoEm: agora },
        });
      } else {
        await tx.chamado.update({
          where: { id },
          data: { paraTodos: true },
        });
      }
      return true;
    });
    if (repassado) {
      await this.emissor.emitAsync(CHAMADO_REPASSADO, { chamadoId: id });
    }
  }
}

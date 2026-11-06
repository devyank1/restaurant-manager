import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UsuarioToken } from '../equipe/equipe.types';
import { exigirSalao } from '../equipe/papel';
import { EventosService } from '../eventos/eventos.service';
import { COM_OPCOES, NovoItem } from '../pedidos/pratos';
import {
  precoUnitario,
  resumirOpcoes,
  Selecao,
  validarSelecao,
} from '../pedidos/preco';
import { ITEM_NAO_ENCONTRADO, pratoValidado } from '../pedidos/validar-item';
import { PrismaService } from '../prisma/prisma.service';
import { travarMesa } from '../sessao-mesa/trava';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { paraEquipe, somarConfirmadas } from './mapear';
import {
  COM_ITENS,
  MesaEquipe,
  MesaResumo,
  RodadaEquipe,
} from './rodadas.types';

type Tx = Prisma.TransactionClient;

export type EdicaoItem = {
  quantidade?: number;
  selecao?: Selecao;
  observacao?: string;
};

const MESA_NAO_ENCONTRADA = () =>
  new NotFoundException({ mensagem: 'Mesa não encontrada' });
const RODADA_NAO_ENCONTRADA = () =>
  new NotFoundException({ mensagem: 'Rodada não encontrada' });
const RODADA_FECHADA = () =>
  new ConflictException({
    mensagem: 'Esta rodada já foi confirmada ou recusada',
  });

/** Lado da equipe: ver mesas e conferir, editar, confirmar ou recusar. */
@Injectable()
export class RodadasEquipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
    private readonly tempoReal: TempoRealService,
  ) {}

  private async nomes(ids: (string | null)[]): Promise<Map<string, string>> {
    const validos = ids.filter((id): id is string => id !== null);
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: validos } },
      select: { id: true, nome: true },
    });
    return new Map(usuarios.map((u) => [u.id, u.nome]));
  }

  async mesas(usuario: UsuarioToken): Promise<MesaResumo[]> {
    exigirSalao(usuario);
    const mesas = await this.prisma.mesa.findMany({
      where: { restauranteId: usuario.restauranteId },
      orderBy: { numero: 'asc' },
      include: {
        sessoes: {
          where: { status: 'ABERTA' },
          include: {
            rodadas: {
              where: { status: 'AGUARDANDO_GARCOM' },
              select: { id: true },
            },
          },
        },
      },
    });
    const nomes = await this.nomes(
      mesas.map((m) => m.sessoes[0]?.garcomId ?? null),
    );
    return mesas.map((m) => {
      const sessao = m.sessoes[0];
      return {
        numero: m.numero,
        token: m.token,
        aberta: sessao !== undefined,
        garcomNome: (sessao?.garcomId && nomes.get(sessao.garcomId)) || null,
        pendentes: sessao?.rodadas.length ?? 0,
      };
    });
  }

  async mesa(token: string, usuario: UsuarioToken): Promise<MesaEquipe> {
    exigirSalao(usuario);
    const mesa = await this.prisma.mesa.findFirst({
      where: { token, restauranteId: usuario.restauranteId },
    });
    if (!mesa) throw MESA_NAO_ENCONTRADA();
    const sessao = await this.prisma.sessaoMesa.findFirst({
      where: { mesaId: mesa.id, status: 'ABERTA' },
      include: {
        rodadas: { orderBy: { criadoEm: 'asc' }, include: COM_ITENS },
        dispositivos: true,
      },
    });
    const garcomNome = sessao?.garcomId
      ? ((await this.nomes([sessao.garcomId])).get(sessao.garcomId) ?? null)
      : null;
    const confirmados = new Set(
      sessao?.dispositivos
        .filter((d) => d.confirmado)
        .map((d) => d.dispositivoId),
    );
    const rodadas = sessao?.rodadas ?? [];
    return {
      mesa: { numero: mesa.numero, token: mesa.token },
      garcomNome,
      rodadas: rodadas.map((r) =>
        paraEquipe(r, !confirmados.has(r.dispositivoId)),
      ),
      totalConfirmadoCentavos: somarConfirmadas(rodadas),
    };
  }

  /**
   * Rodada do restaurante do usuário, numa transação com a mesa travada.
   * Só AGUARDANDO_GARCOM pode mudar (senão 409).
   */
  private async naRodada<T>(
    rodadaId: string,
    usuario: UsuarioToken,
    trabalho: (
      tx: Tx,
      rodada: Prisma.RodadaGetPayload<{ include: { sessao: true } }>,
    ) => Promise<T>,
  ): Promise<T> {
    exigirSalao(usuario);
    const achada = await this.prisma.rodada.findFirst({
      where: { id: rodadaId, restauranteId: usuario.restauranteId },
      include: { sessao: true },
    });
    if (!achada) throw RODADA_NAO_ENCONTRADA();
    return this.prisma.$transaction(async (tx) => {
      await travarMesa(tx, achada.sessao.mesaId);
      const rodada = await tx.rodada.findUniqueOrThrow({
        where: { id: rodadaId },
        include: { sessao: true },
      });
      if (rodada.status !== 'AGUARDANDO_GARCOM') throw RODADA_FECHADA();
      return trabalho(tx, rodada);
    });
  }

  /** Total recalculado e rodada no formato da equipe. */
  private async fecharEdicao(tx: Tx, rodadaId: string): Promise<RodadaEquipe> {
    const itens = await tx.itemRodada.findMany({ where: { rodadaId } });
    const rodada = await tx.rodada.update({
      where: { id: rodadaId },
      data: {
        totalCentavos: itens.reduce(
          (soma, i) => soma + i.precoUnitarioCentavos * i.quantidade,
          0,
        ),
      },
      include: { ...COM_ITENS, sessao: { include: { dispositivos: true } } },
    });
    const dispositivo = rodada.sessao.dispositivos.find(
      (d) => d.dispositivoId === rodada.dispositivoId,
    );
    return paraEquipe(rodada, !dispositivo?.confirmado);
  }

  private avisar(restauranteId: string, sessaoId: string): void {
    this.tempoReal.paraSessao(sessaoId, 'rodadas-mudaram', {});
    this.tempoReal.paraEquipe(restauranteId, 'mesa-mudou', {});
  }

  /** Quantidade 0 remove; seleção nova é validada e reprecificada. */
  async editarItem(
    rodadaId: string,
    itemId: string,
    edicao: EdicaoItem,
    usuario: UsuarioToken,
  ): Promise<RodadaEquipe> {
    const resultado = await this.naRodada(rodadaId, usuario, async (tx, r) => {
      const item = await tx.itemRodada.findFirst({
        where: { id: itemId, rodadaId },
      });
      if (!item) throw ITEM_NAO_ENCONTRADO();

      if (edicao.quantidade === 0) {
        await tx.itemRodada.delete({ where: { id: item.id } });
      } else {
        const dados: Prisma.ItemRodadaUpdateInput = {
          quantidade: edicao.quantidade,
          observacao: edicao.observacao,
        };
        if (edicao.selecao) {
          // Sem checar esgotado: o garçom corrige o que já foi pedido.
          const prato = await tx.prato.findFirst({
            where: { id: item.pratoId, restauranteId: r.restauranteId },
            include: COM_OPCOES,
          });
          if (!prato) {
            throw new UnprocessableEntityException({
              mensagem: 'Prato não encontrado',
            });
          }
          const erros = validarSelecao(prato, edicao.selecao);
          if (erros.length > 0) {
            throw new UnprocessableEntityException({ mensagem: erros[0] });
          }
          dados.selecao = edicao.selecao;
          dados.resumoOpcoes = resumirOpcoes(prato, edicao.selecao);
          dados.precoUnitarioCentavos = precoUnitario(prato, edicao.selecao);
        }
        await tx.itemRodada.update({ where: { id: item.id }, data: dados });
      }
      return {
        rodada: await this.fecharEdicao(tx, rodadaId),
        sessaoId: r.sessaoId,
      };
    });
    this.avisar(usuario.restauranteId, resultado.sessaoId);
    return resultado.rodada;
  }

  async adicionarItem(
    rodadaId: string,
    novo: NovoItem,
    usuario: UsuarioToken,
  ): Promise<RodadaEquipe> {
    const prato = await pratoValidado(this.prisma, usuario.restauranteId, novo);
    const resultado = await this.naRodada(rodadaId, usuario, async (tx, r) => {
      await tx.itemRodada.create({
        data: {
          restauranteId: r.restauranteId,
          rodadaId,
          pratoId: prato.id,
          nome: prato.nome,
          resumoOpcoes: resumirOpcoes(prato, novo.selecao),
          selecao: novo.selecao,
          observacao: novo.observacao,
          quantidade: novo.quantidade,
          precoUnitarioCentavos: precoUnitario(prato, novo.selecao),
        },
      });
      return {
        rodada: await this.fecharEdicao(tx, rodadaId),
        sessaoId: r.sessaoId,
      };
    });
    this.avisar(usuario.restauranteId, resultado.sessaoId);
    return resultado.rodada;
  }

  /**
   * Confirma: a mesa ganha responsável (se não tinha), o celular passa a
   * confirmado e o chamado CONFIRMAR_RODADA é resolvido.
   */
  async confirmar(
    rodadaId: string,
    usuario: UsuarioToken,
  ): Promise<RodadaEquipe> {
    const agora = new Date();
    const resultado = await this.naRodada(rodadaId, usuario, async (tx, r) => {
      const itens = await tx.itemRodada.count({ where: { rodadaId } });
      if (itens === 0) {
        throw new UnprocessableEntityException({ mensagem: 'Rodada vazia' });
      }
      await tx.rodada.update({
        where: { id: rodadaId },
        data: {
          status: 'CONFIRMADA',
          confirmadaEm: agora,
          confirmadaPorId: usuario.id,
        },
      });
      if (!r.sessao.garcomId) {
        await tx.sessaoMesa.update({
          where: { id: r.sessaoId },
          data: { garcomId: usuario.id, garcomDesde: agora },
        });
      }
      await tx.dispositivoSessao.updateMany({
        where: { sessaoId: r.sessaoId, dispositivoId: r.dispositivoId },
        data: { confirmado: true },
      });
      await this.resolverChamado(tx, rodadaId, agora);
      return { rodada: await this.fecharEdicao(tx, rodadaId), r };
    });
    await this.eventos.publicar({
      restauranteId: usuario.restauranteId,
      tipo: 'PedidoConfirmado',
      dados: {
        rodadaId,
        sessaoId: resultado.r.sessaoId,
        mesaId: resultado.r.sessao.mesaId,
        totalCentavos: resultado.rodada.totalCentavos,
        garcomId: usuario.id,
      },
    });
    this.avisarDecisao(usuario.restauranteId, resultado.r.sessaoId);
    return resultado.rodada;
  }

  async recusar(
    rodadaId: string,
    usuario: UsuarioToken,
  ): Promise<RodadaEquipe> {
    const agora = new Date();
    const resultado = await this.naRodada(rodadaId, usuario, async (tx, r) => {
      await tx.rodada.update({
        where: { id: rodadaId },
        data: { status: 'CANCELADA' },
      });
      await this.resolverChamado(tx, rodadaId, agora);
      return { rodada: await this.fecharEdicao(tx, rodadaId), r };
    });
    await this.eventos.publicar({
      restauranteId: usuario.restauranteId,
      tipo: 'PedidoCancelado',
      dados: {
        rodadaId,
        sessaoId: resultado.r.sessaoId,
        mesaId: resultado.r.sessao.mesaId,
        garcomId: usuario.id,
      },
    });
    this.avisarDecisao(usuario.restauranteId, resultado.r.sessaoId);
    return resultado.rodada;
  }

  private async resolverChamado(tx: Tx, rodadaId: string, agora: Date) {
    await tx.chamado.updateMany({
      where: { rodadaId, status: { not: 'RESOLVIDO' } },
      data: { status: 'RESOLVIDO', resolvidoEm: agora },
    });
  }

  private avisarDecisao(restauranteId: string, sessaoId: string): void {
    this.avisar(restauranteId, sessaoId);
    this.tempoReal.paraEquipe(restauranteId, 'chamados-mudaram', {});
  }
}

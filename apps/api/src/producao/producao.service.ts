import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ItemRodada, Prisma, StatusItem } from '@prisma/client';
import type { UsuarioToken } from '../equipe/equipe.types';
import { exigirProducao } from '../equipe/papel';
import { EventosService } from '../eventos/eventos.service';
import type { TipoEvento } from '../eventos/eventos.types';
import { TEMPO_PADRAO_MIN } from '../paineis/tempo-esperado';
import { PrismaService } from '../prisma/prisma.service';
import { travarMesa } from '../sessao-mesa/trava';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import {
  ESTACAO_PRONTA,
  EstacaoPronta,
  FilaProducao,
  PedidoProducao,
  StatusProducao,
} from './producao.types';

type Tx = Prisma.TransactionClient;

/** Pedido pronto fica na faixa "Prontos" (para desfazer) por este tempo. */
const PRONTO_VISIVEL_MS = 15 * 60_000;
/** Pedido cancelado fica na fila, em vermelho, por este tempo. */
const CANCELADO_VISIVEL_MS = 10 * 60_000;

const EM_ANDAMENTO: StatusItem[] = ['NA_FILA', 'EM_PREPARO'];
const FEITO: StatusItem[] = ['PRONTO', 'ENTREGUE'];

const PEDIDO_MUDOU = () =>
  new ConflictException({ mensagem: 'Este pedido mudou' });
const NAO_ENCONTRADO = () =>
  new NotFoundException({ mensagem: 'Pedido não encontrado' });

const tudoFeito = (itens: { status: StatusItem }[]) =>
  itens.length > 0 && itens.every((i) => FEITO.includes(i.status));

/** Carimbos de hora de cada passo; voltar um passo limpa o carimbo. */
function carimbos(
  item: ItemRodada,
  status: StatusProducao,
  agora: Date,
): Prisma.ItemRodadaUpdateInput {
  if (status === 'NA_FILA') {
    return { status, emPreparoEm: null, prontoEm: null };
  }
  const emPreparoEm = item.emPreparoEm ?? agora;
  if (status === 'EM_PREPARO') return { status, emPreparoEm, prontoEm: null };
  return { status, emPreparoEm, prontoEm: item.prontoEm ?? agora };
}

type Mudanca = {
  restauranteId: string;
  rodadaId: string;
  sessaoId: string;
  mesaId: string;
  eventos: TipoEvento[];
  estacaoPronta: EstacaoPronta | null;
};

/** Telas de produção (cozinha, bar): fila por estação e status por item. */
@Injectable()
export class ProducaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
    private readonly tempoReal: TempoRealService,
    private readonly emissor: EventEmitter2,
  ) {}

  async fila(usuario: UsuarioToken, pedida?: string): Promise<FilaProducao> {
    exigirProducao(usuario);
    const restauranteId = usuario.restauranteId;
    const categorias = await this.prisma.categoria.findMany({
      where: { restauranteId },
      select: { estacao: true },
      distinct: ['estacao'],
    });
    const estacoes = categorias.map((c) => c.estacao).sort();
    const estacao = pedida && estacoes.includes(pedida) ? pedida : estacoes[0];
    if (!estacao) return { estacoes, pedidos: [] };

    const agora = Date.now();
    const rodadas = await this.prisma.rodada.findMany({
      where: {
        restauranteId,
        OR: [
          {
            status: 'CONFIRMADA',
            itens: {
              some: {
                estacao,
                OR: [
                  { status: { in: EM_ANDAMENTO } },
                  { prontoEm: { gte: new Date(agora - PRONTO_VISIVEL_MS) } },
                ],
              },
            },
          },
          {
            status: 'CANCELADA',
            confirmadaEm: { not: null },
            canceladaEm: { gte: new Date(agora - CANCELADO_VISIVEL_MS) },
            itens: { some: { estacao } },
          },
        ],
      },
      orderBy: { confirmadaEm: 'asc' },
      include: {
        itens: { where: { estacao }, orderBy: { id: 'asc' } },
        sessao: {
          select: { garcomId: true, mesa: { select: { numero: true } } },
        },
      },
    });

    // Pronta: some quando o último item ficou pronto há mais de 15 min.
    const visiveis = rodadas.filter((r) => {
      if (r.status === 'CANCELADA') return true;
      if (r.itens.some((i) => EM_ANDAMENTO.includes(i.status))) return true;
      const ultimo = Math.max(
        ...r.itens.map((i) => i.prontoEm?.getTime() ?? 0),
      );
      return ultimo >= agora - PRONTO_VISIVEL_MS;
    });

    const garcomIds = [
      ...new Set(
        visiveis.map((r) => r.sessao.garcomId).filter((id) => id !== null),
      ),
    ];
    const garcons = await this.prisma.usuario.findMany({
      where: { id: { in: garcomIds } },
      select: { id: true, nome: true },
    });
    const nomes = new Map(garcons.map((g) => [g.id, g.nome]));

    const pedidos: PedidoProducao[] = visiveis.map((r) => ({
      rodadaId: r.id,
      mesa: { numero: r.sessao.mesa.numero },
      garcomNome: (r.sessao.garcomId && nomes.get(r.sessao.garcomId)) || null,
      confirmadaEm: r.confirmadaEm,
      esperadoMin: r.itens.length
        ? Math.max(...r.itens.map((i) => i.tempoEsperadoMin))
        : TEMPO_PADRAO_MIN,
      cancelada: r.status === 'CANCELADA',
      itens: r.itens.map((i) => ({
        id: i.id,
        nome: i.nome,
        resumoOpcoes: i.resumoOpcoes,
        observacao: i.observacao,
        quantidade: i.quantidade,
        status: i.status,
      })),
    }));
    return { estacoes, pedidos };
  }

  async mudarItem(
    itemId: string,
    status: StatusProducao,
    usuario: UsuarioToken,
  ): Promise<void> {
    exigirProducao(usuario);
    const item = await this.prisma.itemRodada.findFirst({
      where: { id: itemId, restauranteId: usuario.restauranteId },
      select: { rodadaId: true, estacao: true },
    });
    if (!item) throw NAO_ENCONTRADO();
    await this.mudar(usuario, item.rodadaId, item.estacao, status, [itemId]);
  }

  async mudarRodada(
    rodadaId: string,
    estacao: string,
    status: StatusProducao,
    usuario: UsuarioToken,
  ): Promise<void> {
    exigirProducao(usuario);
    const rodada = await this.prisma.rodada.findFirst({
      where: { id: rodadaId, restauranteId: usuario.restauranteId },
      select: { id: true },
    });
    if (!rodada) throw NAO_ENCONTRADO();
    await this.mudar(usuario, rodadaId, estacao, status, null);
  }

  /**
   * Muda os itens (todos os da estação, se `itemIds` for nulo) com a mesa
   * travada. Depois publica os eventos que a mudança causou.
   */
  private async mudar(
    usuario: UsuarioToken,
    rodadaId: string,
    estacao: string,
    status: StatusProducao,
    itemIds: string[] | null,
  ): Promise<void> {
    const { sessao } = await this.prisma.rodada.findUniqueOrThrow({
      where: { id: rodadaId },
      select: { sessao: { select: { mesaId: true } } },
    });
    const mudanca = await this.prisma.$transaction(async (tx) => {
      await travarMesa(tx, sessao.mesaId);
      const rodada = await tx.rodada.findUniqueOrThrow({
        where: { id: rodadaId },
        include: { itens: true, sessao: { select: { mesaId: true } } },
      });
      if (rodada.status !== 'CONFIRMADA') throw PEDIDO_MUDOU();
      const daEstacao = rodada.itens.filter((i) => i.estacao === estacao);
      const alvos = itemIds
        ? daEstacao.filter((i) => itemIds.includes(i.id))
        : daEstacao.filter((i) => i.status !== 'ENTREGUE');
      if (alvos.length === 0) {
        if (itemIds) throw NAO_ENCONTRADO();
        throw PEDIDO_MUDOU();
      }
      if (alvos.some((i) => i.status === 'ENTREGUE')) throw PEDIDO_MUDOU();

      const agora = new Date();
      for (const alvo of alvos) {
        await tx.itemRodada.update({
          where: { id: alvo.id },
          data: carimbos(alvo, status, agora),
        });
      }
      const depois = await tx.itemRodada.findMany({ where: { rodadaId } });
      return this.consequencias(tx, rodada, estacao, daEstacao, depois);
    });

    for (const tipo of mudanca.eventos) {
      await this.eventos.publicar({
        restauranteId: mudanca.restauranteId,
        tipo,
        dados: {
          rodadaId: mudanca.rodadaId,
          sessaoId: mudanca.sessaoId,
          mesaId: mudanca.mesaId,
        },
      });
    }
    if (mudanca.estacaoPronta) {
      await this.emissor.emitAsync(ESTACAO_PRONTA, mudanca.estacaoPronta);
    }
    this.tempoReal.paraEquipe(usuario.restauranteId, 'producao-mudou', {});
    this.tempoReal.paraEquipe(usuario.restauranteId, 'mesa-mudou', {});
    this.tempoReal.paraSessao(mudanca.sessaoId, 'rodadas-mudaram', {});
  }

  /** Eventos que a mudança causou (cada evento de rodada sai uma vez só). */
  private async consequencias(
    tx: Tx,
    rodada: {
      id: string;
      restauranteId: string;
      sessaoId: string;
      sessao: { mesaId: string };
    },
    estacao: string,
    antesDaEstacao: ItemRodada[],
    depois: ItemRodada[],
  ): Promise<Mudanca> {
    const jaPublicado = async (tipo: TipoEvento) =>
      (await tx.evento.count({
        where: {
          restauranteId: rodada.restauranteId,
          tipo,
          dados: { path: ['rodadaId'], equals: rodada.id },
        },
      })) > 0;

    const eventos: TipoEvento[] = [];
    if (
      depois.some((i) => i.status !== 'NA_FILA') &&
      !(await jaPublicado('PedidoEmPreparo'))
    ) {
      eventos.push('PedidoEmPreparo');
    }
    if (tudoFeito(depois) && !(await jaPublicado('PedidoPronto'))) {
      eventos.push('PedidoPronto');
    }

    const depoisDaEstacao = depois.filter((i) => i.estacao === estacao);
    const estacaoPronta =
      !tudoFeito(antesDaEstacao) && tudoFeito(depoisDaEstacao)
        ? { rodadaId: rodada.id, estacao, itens: depoisDaEstacao.length }
        : null;

    return {
      restauranteId: rodada.restauranteId,
      rodadaId: rodada.id,
      sessaoId: rodada.sessaoId,
      mesaId: rodada.sessao.mesaId,
      eventos,
      estacaoPronta,
    };
  }
}

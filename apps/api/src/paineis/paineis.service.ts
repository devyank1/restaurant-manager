import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Meta, PeriodoMeta, Prisma } from '@prisma/client';
import { inicioDoDiaDeServico } from '../comum/dia-servico';
import { exigirDono, exigirProducao } from '../equipe/papel';
import type { UsuarioToken } from '../equipe/equipe.types';
import { PrismaService } from '../prisma/prisma.service';
import { avisosDeCuidado } from './cuidado';
import { MetasService } from './metas.service';
import type {
  CartaoPessoa,
  PainelEquipe,
  PainelEstacao,
  PainelGarcom,
} from './paineis.types';
import { medirPedidos, type MedidaEstacao } from './pedidos-estacao';
import { periodoDe } from './periodo';
import { progresso, type ProgressoMeta } from './progresso';

type Intervalo = { inicio: Date; fim: Date };

const DIA_MS = 24 * 60 * 60 * 1000;
/** Chamado que levou mais que isso para ser lido/resolvido = demorou. */
export const CHAMADO_DEMORADO_SEG = 180;
const DIAS_MEDIA_SEMANA = 28;
const MAIS_VENDIDOS = 10;

const horaSP = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  hourCycle: 'h23',
});

const vazia = (estacao: string): MedidaEstacao => ({
  estacao,
  pedidos: 0,
  avaliados: 0,
  noTempo: 0,
  noTempoPct: null,
  mediaMin: null,
  esquecidos: [],
});

const porNome = (a: { nome: string }, b: { nome: string }) =>
  a.nome.localeCompare(b.nome, 'pt-BR');

/** Painéis da equipe, do garçom e da estação [spec §4.3–4.5]. */
@Injectable()
export class PaineisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metas: MetasService,
  ) {}

  async equipe(
    periodo: PeriodoMeta,
    usuario: UsuarioToken,
    agora = new Date(),
  ): Promise<PainelEquipe> {
    exigirDono(usuario);
    const r = usuario.restauranteId;
    const intervalo = periodoDe(periodo, agora);
    const [metaEquipe, pessoas, operacao] = await Promise.all([
      this.metaEquipe(r, agora),
      this.cartoes(r, intervalo, agora),
      this.operacao(r, intervalo, agora),
    ]);
    return {
      periodo,
      inicio: intervalo.inicio.toISOString(),
      metaEquipe,
      pessoas,
      operacao,
    };
  }

  async eu(usuario: UsuarioToken, agora = new Date()): Promise<PainelGarcom> {
    if (usuario.papel !== 'GARCOM') {
      throw new ForbiddenException({ mensagem: 'Acesso só para garçom' });
    }
    const r = usuario.restauranteId;
    const [metaEquipe, cartoes] = await Promise.all([
      this.metaEquipe(r, agora),
      this.cartoes(r, periodoDe('DIA', agora), agora, usuario.id),
    ]);
    return { metaEquipe, eu: cartoes[0] };
  }

  async estacao(
    estacao: string,
    usuario: UsuarioToken,
    agora = new Date(),
  ): Promise<PainelEstacao> {
    exigirProducao(usuario);
    const r = usuario.restauranteId;
    if (!(await this.metas.estacoes(r)).includes(estacao)) {
      throw new NotFoundException({ mensagem: 'Estação não encontrada' });
    }
    const [metaEquipe, medidas, metas] = await Promise.all([
      this.metaEquipe(r, agora),
      this.medirEstacoes(r, periodoDe('DIA', agora), agora, estacao),
      this.prisma.meta.findMany({
        where: { restauranteId: r, escopo: 'ESTACAO', estacao },
      }),
    ]);
    const medida = medidas[0] ?? vazia(estacao);
    const ordem = ['NO_TEMPO', 'ESQUECIDOS'];
    return {
      estacao,
      metaEquipe,
      metas: metas
        .sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo))
        .map((m) => {
          if (m.tipo !== 'ESQUECIDOS') {
            return progresso(m, medida.noTempoPct ?? 0);
          }
          // "Zero esquecidos na noite" só se fecha no fim do dia: com o dia
          // em andamento, nenhum esquecido é barra cheia mas sem comemorar.
          return { ...progresso(m, medida.esquecidos.length), batida: false };
        }),
      medida,
    };
  }

  /** Metas da equipe com o andamento e a meta (id) por trás de cada uma. */
  async metasEquipeComId(
    restauranteId: string,
    agora: Date,
  ): Promise<{ meta: Meta; inicio: Date; progresso: ProgressoMeta }[]> {
    const metas = await this.prisma.meta.findMany({
      where: { restauranteId, escopo: 'EQUIPE' },
      orderBy: { tipo: 'asc' },
    });
    return Promise.all(
      metas.map(async (meta) => {
        const intervalo = periodoDe(meta.periodo, agora);
        const atual =
          meta.tipo === 'VALOR'
            ? total(await this.valorPorGarcom(restauranteId, intervalo))
            : total(await this.mesasPorGarcom(restauranteId, intervalo));
        return {
          meta,
          inicio: intervalo.inicio,
          progresso: progresso(meta, atual),
        };
      }),
    );
  }

  private async metaEquipe(
    restauranteId: string,
    agora: Date,
  ): Promise<ProgressoMeta[]> {
    return (await this.metasEquipeComId(restauranteId, agora)).map(
      (m) => m.progresso,
    );
  }

  // ---------- Cartões por pessoa ----------

  /** Garçons em turno ou com turno no intervalo, A→Z (ou só `soEle`). */
  private async cartoes(
    r: string,
    intervalo: Intervalo,
    agora: Date,
    soEle?: string,
  ): Promise<CartaoPessoa[]> {
    const hoje = periodoDe('DIA', agora);
    const [pessoas, trabalharamHoje, metas, restaurante] = await Promise.all([
      soEle
        ? this.prisma.usuario.findMany({
            where: { id: soEle, restauranteId: r, papel: 'GARCOM' },
          })
        : this.garconsNoIntervalo(r, intervalo),
      this.garconsNoIntervalo(r, hoje),
      this.prisma.meta.findMany({
        where: { restauranteId: r, escopo: 'GARCOM' },
      }),
      this.prisma.restaurante.findUniqueOrThrow({ where: { id: r } }),
    ]);

    // Valor e mesas por garçom em cada período que alguma meta usa.
    const cache = new Map<string, Promise<Map<string | null, number>>>();
    const porGarcom = (tipo: 'VALOR' | 'MESAS', periodo: PeriodoMeta) => {
      const chave = `${tipo}:${periodo}`;
      let p = cache.get(chave);
      if (!p) {
        const i = periodoDe(periodo, agora);
        p =
          tipo === 'VALOR'
            ? this.valorPorGarcom(r, i)
            : this.mesasPorGarcom(r, i);
        cache.set(chave, p);
      }
      return p;
    };
    const mesasHoje = await porGarcom('MESAS', 'DIA');

    return Promise.all(
      pessoas.sort(porNome).map(async (u) => {
        const minhasMesas = mesasHoje.get(u.id) ?? 0;
        const colegas = trabalharamHoje.filter((c) => c.id !== u.id);
        const mediaColegas =
          colegas.length > 0
            ? colegas.reduce((s, c) => s + (mesasHoje.get(c.id) ?? 0), 0) /
              colegas.length
            : null;
        const minhas: ProgressoMeta[] = [];
        for (const tipo of ['VALOR', 'MESAS'] as const) {
          const padrao = metas.find((m) => m.tipo === tipo && !m.usuarioId);
          if (!padrao) continue;
          const ajuste = metas.find(
            (m) => m.tipo === tipo && m.usuarioId === u.id,
          );
          const atual = (await porGarcom(tipo, padrao.periodo)).get(u.id) ?? 0;
          minhas.push(
            progresso(
              {
                tipo,
                periodo: padrao.periodo,
                alvo: ajuste?.alvo ?? padrao.alvo,
              },
              atual,
            ),
          );
        }
        return {
          id: u.id,
          nome: u.nome,
          emTurno: u.emTurno,
          emTurnoDesde: u.emTurnoDesde?.toISOString() ?? null,
          avisos: avisosDeCuidado(
            {
              emTurnoDesde: u.emTurno ? u.emTurnoDesde : null,
              horasSemPausa: restaurante.horasSemPausa,
              mesasHoje: minhasMesas,
              mediaColegas,
            },
            agora,
          ),
          metas: minhas,
          mesasHoje: minhasMesas,
        };
      }),
    );
  }

  private garconsNoIntervalo(r: string, { inicio, fim }: Intervalo) {
    return this.prisma.usuario.findMany({
      where: {
        restauranteId: r,
        papel: 'GARCOM',
        OR: [
          { emTurno: true },
          {
            turnos: {
              some: {
                inicio: { lt: fim },
                OR: [{ fim: null }, { fim: { gte: inicio } }],
              },
            },
          },
        ],
      },
    });
  }

  /** Rodadas confirmadas (não canceladas), sem 10% e couvert. */
  private async valorPorGarcom(r: string, i: Intervalo) {
    const linhas = await this.prisma.rodada.groupBy({
      by: ['garcomId'],
      where: { restauranteId: r, ...confirmadasEm(i) },
      _sum: { totalCentavos: true },
    });
    return new Map(
      linhas.map((l) => [l.garcomId, l._sum.totalCentavos ?? 0] as const),
    );
  }

  /** Contas fechadas no intervalo, pelo responsável no fechamento. */
  private async mesasPorGarcom(r: string, i: Intervalo) {
    const linhas = await this.prisma.sessaoMesa.groupBy({
      by: ['garcomId'],
      where: { restauranteId: r, ...fechadasEm(i) },
      _count: { _all: true },
    });
    return new Map(linhas.map((l) => [l.garcomId, l._count._all] as const));
  }

  // ---------- Números da operação ----------

  private async operacao(
    r: string,
    i: Intervalo,
    agora: Date,
  ): Promise<PainelEquipe['operacao']> {
    const [
      faturamento,
      porHora,
      porDiaSemana,
      maisVendidos,
      estacoes,
      chamadosDemorados,
      perdasSemana,
    ] = await Promise.all([
      this.faturamento(r, i),
      this.porHora(r, i),
      this.porDiaSemana(r, agora),
      this.maisVendidos(r, i),
      this.medirEstacoes(r, i, agora),
      this.chamadosDemorados(r, i, agora),
      this.perdasSemana(r, agora),
    ]);
    return {
      ...faturamento,
      porHora,
      porDiaSemana,
      maisVendidos,
      estacoes,
      chamadosDemorados,
      perdasSemana,
    };
  }

  private async faturamento(r: string, i: Intervalo) {
    const a = await this.prisma.sessaoMesa.aggregate({
      where: { restauranteId: r, ...fechadasEm(i) },
      _sum: { totalCentavos: true },
      _count: { _all: true },
    });
    const faturamentoCentavos = a._sum.totalCentavos ?? 0;
    const contas = a._count._all;
    return {
      faturamentoCentavos,
      contas,
      ticketMedioCentavos:
        contas > 0 ? Math.round(faturamentoCentavos / contas) : null,
    };
  }

  /** Rodadas por hora do relógio em SP (só horas com movimento). */
  private async porHora(r: string, i: Intervalo) {
    const rodadas = await this.prisma.rodada.findMany({
      where: { restauranteId: r, ...confirmadasEm(i) },
      select: { confirmadaEm: true },
    });
    const conta = new Map<number, number>();
    for (const { confirmadaEm } of rodadas) {
      if (!confirmadaEm) continue;
      const h = Number(horaSP.format(confirmadaEm));
      conta.set(h, (conta.get(h) ?? 0) + 1);
    }
    return [...conta.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hora, n]) => ({ hora, rodadas: n }));
  }

  /** Média de rodadas por dia da semana nos 28 dias de serviço anteriores. */
  private async porDiaSemana(r: string, agora: Date) {
    const hoje = inicioDoDiaDeServico(agora);
    const desde = new Date(hoje.getTime() - DIAS_MEDIA_SEMANA * DIA_MS);
    const rodadas = await this.prisma.rodada.findMany({
      where: {
        restauranteId: r,
        ...confirmadasEm({ inicio: desde, fim: hoje }),
      },
      select: { confirmadaEm: true },
    });
    const conta = [0, 0, 0, 0, 0, 0, 0];
    for (const { confirmadaEm } of rodadas) {
      if (!confirmadaEm) continue;
      // 05:00 em SP = 08:00Z do mesmo dia: getUTCDay é o dia da semana em SP.
      conta[inicioDoDiaDeServico(confirmadaEm).getUTCDay()] += 1;
    }
    const semanas = DIAS_MEDIA_SEMANA / 7;
    return conta.map((n, dia) => ({
      dia,
      mediaRodadas: Math.round((10 * n) / semanas) / 10,
    }));
  }

  private async maisVendidos(r: string, i: Intervalo) {
    const linhas = await this.prisma.itemRodada.groupBy({
      by: ['nome'],
      where: { restauranteId: r, rodada: confirmadasEm(i) },
      _sum: { quantidade: true },
    });
    return linhas
      .map((l) => ({ nome: l.nome, quantidade: l._sum.quantidade ?? 0 }))
      .sort((a, b) => b.quantidade - a.quantidade || porNome(a, b))
      .slice(0, MAIS_VENDIDOS);
  }

  private async medirEstacoes(
    r: string,
    i: Intervalo,
    agora: Date,
    estacao?: string,
  ): Promise<MedidaEstacao[]> {
    const itens = await this.prisma.itemRodada.findMany({
      where: {
        restauranteId: r,
        ...(estacao ? { estacao } : {}),
        rodada: confirmadasEm(i),
      },
      select: {
        rodadaId: true,
        estacao: true,
        tempoEsperadoMin: true,
        prontoEm: true,
        entregueEm: true,
        rodada: {
          select: {
            confirmadaEm: true,
            sessao: { select: { mesa: { select: { numero: true } } } },
          },
        },
      },
    });
    return medirPedidos(
      itens.map((x) => ({
        rodadaId: x.rodadaId,
        estacao: x.estacao,
        confirmadaEm: x.rodada.confirmadaEm ?? agora,
        tempoEsperadoMin: x.tempoEsperadoMin,
        prontoEm: x.prontoEm ?? x.entregueEm,
        mesa: x.rodada.sessao.mesa.numero,
      })),
      agora,
    );
  }

  /** Resposta = (lido ?? resolvido ?? agora) − criado. Sem nomes. */
  private async chamadosDemorados(r: string, i: Intervalo, agora: Date) {
    const chamados = await this.prisma.chamado.findMany({
      where: { restauranteId: r, criadoEm: { gte: i.inicio, lt: i.fim } },
      select: { criadoEm: true, lidoEm: true, resolvidoEm: true },
    });
    const segundos = chamados.map(
      (c) =>
        ((c.lidoEm ?? c.resolvidoEm ?? agora).getTime() -
          c.criadoEm.getTime()) /
        1000,
    );
    return {
      quantidade: segundos.filter((s) => s > CHAMADO_DEMORADO_SEG).length,
      mediaRespostaSeg:
        segundos.length > 0
          ? Math.round(segundos.reduce((a, b) => a + b, 0) / segundos.length)
          : null,
    };
  }

  /** Perdas (não desfeitas) da semana de serviço, por item e motivo. */
  private async perdasSemana(r: string, agora: Date) {
    const semana = periodoDe('SEMANA', agora);
    const linhas = await this.prisma.movimentoEstoque.groupBy({
      by: ['itemId', 'motivo'],
      where: {
        restauranteId: r,
        tipo: 'PERDA',
        desfeitoEm: null,
        criadoEm: { gte: semana.inicio, lt: semana.fim },
      },
      _sum: { quantidade: true },
    });
    const itens = await this.prisma.itemEstoque.findMany({
      where: { id: { in: [...new Set(linhas.map((l) => l.itemId))] } },
      select: { id: true, nome: true, unidade: true },
    });
    const item = new Map(itens.map((x) => [x.id, x]));
    return linhas
      .flatMap((l) => {
        const x = item.get(l.itemId);
        return x
          ? [
              {
                item: x.nome,
                unidade: x.unidade,
                quantidade: -(l._sum.quantidade ?? 0),
                motivo: l.motivo,
              },
            ]
          : [];
      })
      .sort(
        (a, b) =>
          a.item.localeCompare(b.item, 'pt-BR') ||
          String(a.motivo).localeCompare(String(b.motivo)),
      );
  }
}

function confirmadasEm(i: Intervalo): Prisma.RodadaWhereInput {
  return {
    status: 'CONFIRMADA',
    confirmadaEm: { gte: i.inicio, lt: i.fim },
  };
}

function fechadasEm(i: Intervalo): Prisma.SessaoMesaWhereInput {
  return { status: 'FECHADA', fechadaEm: { gte: i.inicio, lt: i.fim } };
}

function total(m: Map<string | null, number>): number {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

import { Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioToken } from '../equipe/equipe.types';
import { exigirDono } from '../equipe/papel';
import { PrismaService } from '../prisma/prisma.service';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { calcularAlertas, type EntradaAlertas } from './alertas';
import { cargaEstacao, cargaGarcom, faixaDeCarga } from './carga';
import { fechadasEm, horaSP } from './consultas';
import type { CentralResposta, DetalheGarcom } from './central.types';
import { EstadoAlertas } from './estado-alertas';
import { LimitesService } from './limites.service';
import { FATOR_ESQUECIDO } from './pedidos-estacao';
import { periodoDe } from './periodo';

const MIN_MS = 60_000;
const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
const SEMANA_MS = 7 * DIA_MS;
const SEMANAS_HISTORICO = 4;

const porNome = (a: { nome: string }, b: { nome: string }) =>
  a.nome.localeCompare(b.nome, 'pt-BR');

const arredonda1 = (n: number) => Math.round(n * 10) / 10;

/** Central de alertas do gerente: lê o estado do salão e devolve alertas, carga e contexto. */
@Injectable()
export class CentralService {
  /** Um só estado para o processo: a estabilização de 60 s vive aqui. */
  private readonly estado = new EstadoAlertas();

  constructor(
    private readonly prisma: PrismaService,
    private readonly limites: LimitesService,
    private readonly tempoReal: TempoRealService,
  ) {}

  async central(
    usuario: UsuarioToken,
    agora = new Date(),
  ): Promise<CentralResposta> {
    exigirDono(usuario);
    const { resposta, mudou } = await this.calcular(
      usuario.restauranteId,
      agora,
    );
    // Este cálculo já guardou a nova assinatura: sem avisar, o agendador não
    // veria mudança e os outros aparelhos ficariam com a lista velha.
    if (mudou) {
      this.tempoReal.paraEquipe(usuario.restauranteId, 'central-mudou', {});
    }
    return resposta;
  }

  /** Contexto de um garçom do restaurante do dono; sem comparação com colegas. */
  async detalheGarcom(
    usuario: UsuarioToken,
    id: string,
    agora = new Date(),
  ): Promise<DetalheGarcom> {
    exigirDono(usuario);
    const r = usuario.restauranteId;
    const garcom = await this.prisma.usuario.findFirst({
      where: { id, restauranteId: r, papel: 'GARCOM' },
      select: { id: true, nome: true, emTurno: true, emTurnoDesde: true },
    });
    if (!garcom) {
      throw new NotFoundException({ mensagem: 'Garçom não encontrado' });
    }
    const [sessoes, chamados] = await Promise.all([
      this.prisma.sessaoMesa.findMany({
        where: { restauranteId: r, status: 'ABERTA', garcomId: id },
        select: { abertaEm: true, mesa: { select: { numero: true } } },
        orderBy: { abertaEm: 'asc' },
      }),
      this.prisma.chamado.findMany({
        where: {
          restauranteId: r,
          status: 'ABERTO',
          garcomId: id,
          paraTodos: false,
        },
        select: {
          id: true,
          criadoEm: true,
          mesa: { select: { numero: true } },
        },
        orderBy: { criadoEm: 'asc' },
      }),
    ]);
    const desde = garcom.emTurno ? garcom.emTurnoDesde : null;
    return {
      id: garcom.id,
      nome: garcom.nome,
      emTurno: garcom.emTurno,
      emTurnoDesde: garcom.emTurnoDesde?.toISOString() ?? null,
      horasEmTurno: desde
        ? arredonda1((agora.getTime() - desde.getTime()) / HORA_MS)
        : null,
      mesasAbertas: sessoes.map((s) => ({
        numero: s.mesa.numero,
        abertaEm: s.abertaEm.toISOString(),
      })),
      chamadosPendentes: chamados.map((c) => ({
        id: c.id,
        mesa: c.mesa.numero,
        criadoEm: c.criadoEm.toISOString(),
      })),
    };
  }

  async calcular(
    r: string,
    agora: Date,
  ): Promise<{ resposta: CentralResposta; mudou: boolean }> {
    const dia = periodoDe('DIA', agora);
    // Só o que a central lê: hoje (com a última hora, que pode vir de antes da
    // virada do dia) e o mesmo dia de serviço das 4 semanas anteriores.
    const janelas = [
      {
        inicio: new Date(
          Math.min(dia.inicio.getTime(), agora.getTime() - HORA_MS),
        ),
        fim: dia.fim,
      },
      ...Array.from({ length: SEMANAS_HISTORICO }, (_, i) => {
        const inicio = new Date(dia.inicio.getTime() - (i + 1) * SEMANA_MS);
        return { inicio, fim: new Date(inicio.getTime() + DIA_MS) };
      }),
    ];
    const [
      limites,
      restaurante,
      sessoes,
      chamados,
      itens,
      garcons,
      estoque,
      rodadas,
      fechadas,
    ] = await Promise.all([
      this.limites.ler(r),
      this.prisma.restaurante.findUniqueOrThrow({ where: { id: r } }),
      this.prisma.sessaoMesa.findMany({
        where: { restauranteId: r, status: 'ABERTA' },
        select: {
          id: true,
          abertaEm: true,
          garcomId: true,
          mesa: { select: { numero: true } },
          rodadas: { select: { criadoEm: true } },
          chamados: { select: { resolvidoEm: true } },
        },
      }),
      this.prisma.chamado.findMany({
        where: { restauranteId: r, status: 'ABERTO' },
        select: {
          id: true,
          sessaoId: true,
          garcomId: true,
          paraTodos: true,
          criadoEm: true,
          mesa: { select: { numero: true } },
        },
      }),
      this.prisma.itemRodada.findMany({
        where: {
          restauranteId: r,
          status: { in: ['NA_FILA', 'EM_PREPARO'] },
          rodada: { status: 'CONFIRMADA' },
        },
        select: {
          rodadaId: true,
          estacao: true,
          status: true,
          tempoEsperadoMin: true,
          rodada: {
            select: {
              confirmadaEm: true,
              sessaoId: true,
              sessao: { select: { mesa: { select: { numero: true } } } },
            },
          },
        },
      }),
      this.prisma.usuario.findMany({
        where: { restauranteId: r, papel: 'GARCOM', emTurno: true },
        select: { id: true, nome: true, emTurnoDesde: true },
      }),
      this.prisma.itemEstoque.findMany({
        where: {
          restauranteId: r,
          ativo: true,
          nivel: { in: ['ACABANDO', 'ZERADO'] },
        },
        select: { id: true, nome: true, nivel: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.rodada.findMany({
        where: {
          restauranteId: r,
          status: 'CONFIRMADA',
          OR: janelas.map((j) => ({
            confirmadaEm: { gte: j.inicio, lt: j.fim },
          })),
        },
        select: { confirmadaEm: true },
      }),
      this.prisma.sessaoMesa.aggregate({
        where: { restauranteId: r, ...fechadasEm(dia) },
        _sum: { totalCentavos: true },
        _count: { _all: true },
      }),
    ]);

    const agoraMs = agora.getTime();
    const minutosDesde = (d: Date) => (agoraMs - d.getTime()) / MIN_MS;

    // Pedidos (rodada, estação) ainda não prontos.
    const pedidosMap = new Map<
      string,
      EntradaAlertas['pedidos'][number] & { sessaoId: string }
    >();
    for (const i of itens) {
      const chave = `${i.rodadaId}:${i.estacao}`;
      const p = pedidosMap.get(chave);
      if (p) {
        p.esperadoMin = Math.max(p.esperadoMin, i.tempoEsperadoMin);
      } else {
        pedidosMap.set(chave, {
          rodadaId: i.rodadaId,
          estacao: i.estacao,
          sessaoId: i.rodada.sessaoId,
          mesa: i.rodada.sessao.mesa.numero,
          confirmadaEm: i.rodada.confirmadaEm ?? agora,
          esperadoMin: i.tempoEsperadoMin,
        });
      }
    }
    const pedidos = [...pedidosMap.values()];

    // Mesas: última atividade e problema maior (esquecido / chamado vencido).
    const limiteChamado = limites.CHAMADO_SEM_RESPOSTA.valor ?? 3;
    const comProblema = new Set<string>();
    // Só conta como problema maior o tipo que o gerente deixou ligado: o
    // desligado não gera alerta, então não pode esconder o da mesa parada.
    if (limites.PEDIDO_ESQUECIDO.ativo) {
      for (const p of pedidos) {
        if (minutosDesde(p.confirmadaEm) > p.esperadoMin * FATOR_ESQUECIDO) {
          comProblema.add(p.sessaoId);
        }
      }
    }
    if (limites.CHAMADO_SEM_RESPOSTA.ativo) {
      for (const c of chamados) {
        if (minutosDesde(c.criadoEm) > limiteChamado) {
          comProblema.add(c.sessaoId);
        }
      }
    }
    const mesas: EntradaAlertas['mesas'] = sessoes.map((s) => {
      const marcas = [
        s.abertaEm.getTime(),
        ...s.rodadas.map((x) => x.criadoEm.getTime()),
        ...s.chamados.flatMap((x) =>
          x.resolvidoEm ? [x.resolvidoEm.getTime()] : [],
        ),
      ];
      return {
        sessaoId: s.id,
        numero: s.mesa.numero,
        ultimaAtividade: new Date(Math.max(...marcas)),
        temProblemaMaior: comProblema.has(s.id),
      };
    });

    // Estações.
    const porEstacao = new Map<
      string,
      { naFila: number; emPreparo: number; maisAntigo: number | null }
    >();
    for (const i of itens) {
      const e = porEstacao.get(i.estacao) ?? {
        naFila: 0,
        emPreparo: 0,
        maisAntigo: null,
      };
      if (i.status === 'NA_FILA') e.naFila += 1;
      else e.emPreparo += 1;
      const desde = i.rodada.confirmadaEm?.getTime();
      if (
        desde !== undefined &&
        (e.maisAntigo === null || desde < e.maisAntigo)
      ) {
        e.maisAntigo = desde;
      }
      porEstacao.set(i.estacao, e);
    }
    const cargaEstacoes = [...porEstacao.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([estacao, e]) => ({
        estacao,
        naFila: e.naFila,
        emPreparo: e.emPreparo,
        carga: cargaEstacao(e),
        maisAntigoMin:
          e.maisAntigo === null
            ? null
            : Math.max(0, Math.floor((agoraMs - e.maisAntigo) / MIN_MS)),
      }));

    // Garçons.
    const garconsAlerta = [...garcons].sort(porNome).map((g) => ({
      id: g.id,
      nome: g.nome,
      emTurnoDesde: g.emTurnoDesde,
      mesasAbertas: sessoes.filter((s) => s.garcomId === g.id).length,
      chamadosPendentes: chamados.filter(
        (c) => c.garcomId === g.id && !c.paraTodos,
      ).length,
    }));
    const cargas = garconsAlerta.map(cargaGarcom);
    const cargaGarcons = garconsAlerta.map((g, idx) => ({
      id: g.id,
      nome: g.nome,
      mesasAbertas: g.mesasAbertas,
      chamadosPendentes: g.chamadosPendentes,
      carga: cargas[idx],
      faixa: faixaDeCarga(
        cargas[idx],
        cargas.filter((_, j) => j !== idx),
      ),
      emTurnoDesde: g.emTurnoDesde?.toISOString() ?? null,
    }));
    const cargaTotal = cargas.reduce((a, b) => a + b, 0);

    // Movimento: última hora x mesma hora do relógio no mesmo dia da semana.
    const instantes = rodadas.flatMap((x) =>
      x.confirmadaEm ? [x.confirmadaEm.getTime()] : [],
    );
    const ultimaHora = instantes.filter(
      (ms) => ms > agoraMs - HORA_MS && ms <= agoraMs,
    ).length;
    const horaInicio = Math.floor(agoraMs / HORA_MS) * HORA_MS;
    const contagens: number[] = [];
    for (let k = 1; k <= SEMANAS_HISTORICO; k++) {
      const ini = horaInicio - k * SEMANA_MS;
      contagens.push(
        instantes.filter((ms) => ms >= ini && ms < ini + HORA_MS).length,
      );
    }
    const semanasComDados = contagens.filter((n) => n > 0).length;
    const mediaHistorica =
      semanasComDados > 0
        ? contagens.reduce((a, b) => a + b, 0) / semanasComDados
        : null;

    // Contexto por hora: hoje x média do mesmo dia da semana (dias de serviço).
    const hoje = new Array<number>(24).fill(0);
    const hist = new Array<number>(24).fill(0);
    const semanasDia = new Set<number>();
    for (const ms of instantes) {
      const h = Number(horaSP.format(new Date(ms)));
      if (ms >= dia.inicio.getTime()) {
        hoje[h] += 1;
        continue;
      }
      for (let k = 1; k <= SEMANAS_HISTORICO; k++) {
        const ini = dia.inicio.getTime() - k * SEMANA_MS;
        if (ms >= ini && ms < ini + DIA_MS) {
          hist[h] += 1;
          semanasDia.add(k);
        }
      }
    }
    const semanas = semanasDia.size;
    const porHora = hoje.flatMap((n, hora) => {
      const media = semanas > 0 ? arredonda1(hist[hora] / semanas) : 0;
      return n > 0 || media > 0 ? [{ hora, hoje: n, media }] : [];
    });

    const entrada: EntradaAlertas = {
      agora,
      mesas,
      chamados: chamados.map((c) => ({
        id: c.id,
        mesa: c.mesa.numero,
        garcomId: c.garcomId,
        paraTodos: c.paraTodos,
        criadoEm: c.criadoEm,
      })),
      pedidos: pedidos.map((p) => ({
        rodadaId: p.rodadaId,
        estacao: p.estacao,
        mesa: p.mesa,
        confirmadaEm: p.confirmadaEm,
        esperadoMin: p.esperadoMin,
      })),
      filas: cargaEstacoes.map((e) => ({
        estacao: e.estacao,
        naFila: e.naFila,
      })),
      garcons: garconsAlerta,
      horasSemPausa: restaurante.horasSemPausa,
      estoqueCritico: estoque.map((i) => ({
        id: i.id,
        nome: i.nome,
        zerado: i.nivel === 'ZERADO',
      })),
      movimento: { ultimaHora, mediaHistorica, semanasComDados },
      mesasAbertasTotal: sessoes.length,
    };

    const { visiveis, mudou } = this.estado.atualizar(
      r,
      calcularAlertas(entrada, limites),
      agora,
    );

    const faturamento = fechadas._sum.totalCentavos ?? 0;
    const contas = fechadas._count._all;
    return {
      mudou,
      resposta: {
        verificadoEm: agora.toISOString(),
        alertas: visiveis.map((a) => ({ ...a, desde: a.desde.toISOString() })),
        cargaGarcons,
        cargaEstacoes,
        grupo: {
          garconsEmTurno: cargaGarcons.length,
          cargaTotal,
          cargaMedia:
            cargaGarcons.length > 0
              ? arredonda1(cargaTotal / cargaGarcons.length)
              : null,
        },
        contexto: {
          faturamentoCentavos: faturamento,
          ticketMedioCentavos:
            contas > 0 ? Math.round(faturamento / contas) : null,
          porHora,
        },
      },
    };
  }
}

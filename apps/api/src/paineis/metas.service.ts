import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { EscopoMeta, PeriodoMeta, Prisma, TipoMeta } from '@prisma/client';
import { exigirDono } from '../equipe/papel';
import type { UsuarioToken } from '../equipe/equipe.types';
import { PrismaService } from '../prisma/prisma.service';

export type TipoPessoa = 'VALOR' | 'MESAS';
export type MetaValor = { periodo: PeriodoMeta; alvo: number } | null;

export type MetasConfig = {
  equipe: Record<TipoPessoa, MetaValor>;
  garcomPadrao: Record<TipoPessoa, MetaValor>;
  estacoes: {
    estacao: string;
    noTempoPct: number | null;
    zeroEsquecidos: boolean;
  }[];
  /** Só id e nome: a tela não compara valores entre pessoas [spec §4.2]. */
  garcons: { id: string; nome: string }[];
  horasSemPausa: number;
};

export type MetaPessoa = {
  id: string;
  nome: string;
} & Record<TipoPessoa, { padrao: MetaValor; ajuste: number | null }>;

type Chave = {
  escopo: EscopoMeta;
  tipo: TipoMeta;
  usuarioId?: string | null;
  estacao?: string | null;
};

const valorDe = (m: { periodo: PeriodoMeta; alvo: number } | undefined) =>
  m ? { periodo: m.periodo, alvo: m.alvo } : null;

/** Metas definidas pelo gerente (equipe, garçom e estação). */
@Injectable()
export class MetasService {
  constructor(private readonly prisma: PrismaService) {}

  async config(usuario: UsuarioToken): Promise<MetasConfig> {
    exigirDono(usuario);
    const r = usuario.restauranteId;
    const [metas, garcons, estacoes, restaurante] = await Promise.all([
      this.prisma.meta.findMany({ where: { restauranteId: r } }),
      this.garcons(r),
      this.estacoes(r),
      this.prisma.restaurante.findUniqueOrThrow({ where: { id: r } }),
    ]);
    const achar = (c: Chave) =>
      metas.find(
        (m) =>
          m.escopo === c.escopo &&
          m.tipo === c.tipo &&
          (m.usuarioId ?? null) === (c.usuarioId ?? null) &&
          (m.estacao ?? null) === (c.estacao ?? null),
      );
    const par = (escopo: EscopoMeta) => ({
      VALOR: valorDe(achar({ escopo, tipo: 'VALOR' })),
      MESAS: valorDe(achar({ escopo, tipo: 'MESAS' })),
    });
    return {
      equipe: par('EQUIPE'),
      garcomPadrao: par('GARCOM'),
      estacoes: estacoes.map((estacao) => ({
        estacao,
        noTempoPct:
          achar({ escopo: 'ESTACAO', tipo: 'NO_TEMPO', estacao })?.alvo ?? null,
        zeroEsquecidos: !!achar({
          escopo: 'ESTACAO',
          tipo: 'ESQUECIDOS',
          estacao,
        }),
      })),
      garcons,
      horasSemPausa: restaurante.horasSemPausa,
    };
  }

  async salvarEquipe(
    tipo: TipoPessoa,
    valor: MetaValor,
    usuario: UsuarioToken,
  ): Promise<void> {
    exigirDono(usuario);
    const r = usuario.restauranteId;
    await this.naTrava(r, (tx) =>
      this.gravar(r, { escopo: 'EQUIPE', tipo }, valor, tx),
    );
  }

  async salvarPadrao(
    tipo: TipoPessoa,
    valor: MetaValor,
    usuario: UsuarioToken,
  ): Promise<void> {
    exigirDono(usuario);
    const r = usuario.restauranteId;
    await this.naTrava(r, async (tx) => {
      await this.gravar(r, { escopo: 'GARCOM', tipo }, valor, tx);
      // Sem padrão, os ajustes por pessoa perdem o sentido.
      if (!valor) {
        await tx.meta.deleteMany({
          where: { restauranteId: r, escopo: 'GARCOM', tipo },
        });
      }
    });
  }

  async pessoa(id: string, usuario: UsuarioToken): Promise<MetaPessoa> {
    exigirDono(usuario);
    const r = usuario.restauranteId;
    const garcom = await this.garcom(r, id);
    const metas = await this.prisma.meta.findMany({
      where: {
        restauranteId: r,
        escopo: 'GARCOM',
        OR: [{ usuarioId: null }, { usuarioId: id }],
      },
    });
    const de = (tipo: TipoPessoa) => ({
      padrao: valorDe(metas.find((m) => m.tipo === tipo && !m.usuarioId)),
      ajuste:
        metas.find((m) => m.tipo === tipo && m.usuarioId === id)?.alvo ?? null,
    });
    return {
      id: garcom.id,
      nome: garcom.nome,
      VALOR: de('VALOR'),
      MESAS: de('MESAS'),
    };
  }

  async salvarAjuste(
    id: string,
    tipo: TipoPessoa,
    alvo: number | null,
    usuario: UsuarioToken,
  ): Promise<void> {
    exigirDono(usuario);
    const r = usuario.restauranteId;
    await this.garcom(r, id);
    await this.naTrava(r, async (tx) => {
      const padrao = await tx.meta.findFirst({
        where: { restauranteId: r, escopo: 'GARCOM', tipo, usuarioId: null },
      });
      if (alvo !== null && !padrao) {
        throw new UnprocessableEntityException({
          mensagem: 'Defina a meta padrão primeiro',
        });
      }
      // O período do ajuste é sempre o do padrão.
      await this.gravar(
        r,
        { escopo: 'GARCOM', tipo, usuarioId: id },
        alvo === null || !padrao ? null : { periodo: padrao.periodo, alvo },
        tx,
      );
    });
  }

  async salvarEstacao(
    estacao: string,
    valor: { noTempoPct: number | null; zeroEsquecidos: boolean },
    usuario: UsuarioToken,
  ): Promise<void> {
    exigirDono(usuario);
    const r = usuario.restauranteId;
    if (!(await this.estacoes(r)).includes(estacao)) {
      throw new NotFoundException({ mensagem: 'Estação não encontrada' });
    }
    await this.naTrava(r, async (tx) => {
      await this.gravar(
        r,
        { escopo: 'ESTACAO', tipo: 'NO_TEMPO', estacao },
        valor.noTempoPct === null
          ? null
          : { periodo: 'DIA', alvo: valor.noTempoPct },
        tx,
      );
      await this.gravar(
        r,
        { escopo: 'ESTACAO', tipo: 'ESQUECIDOS', estacao },
        valor.zeroEsquecidos ? { periodo: 'DIA', alvo: 0 } : null,
        tx,
      );
    });
  }

  async salvarHorasSemPausa(
    horasSemPausa: number,
    usuario: UsuarioToken,
  ): Promise<{ horasSemPausa: number }> {
    exigirDono(usuario);
    await this.prisma.restaurante.update({
      where: { id: usuario.restauranteId },
      data: { horasSemPausa },
    });
    return { horasSemPausa };
  }

  /** Estações das categorias do cardápio, A→Z. */
  async estacoes(restauranteId: string): Promise<string[]> {
    const linhas = await this.prisma.categoria.findMany({
      where: { restauranteId },
      select: { estacao: true },
      distinct: ['estacao'],
    });
    return linhas
      .map((l) => l.estacao)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  private garcons(restauranteId: string) {
    return this.prisma.usuario.findMany({
      where: { restauranteId, papel: 'GARCOM' },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  private async garcom(restauranteId: string, id: string) {
    const garcom = await this.prisma.usuario.findFirst({
      where: { id, restauranteId, papel: 'GARCOM' },
      select: { id: true, nome: true },
    });
    if (!garcom) {
      throw new NotFoundException({ mensagem: 'Garçom não encontrado' });
    }
    return garcom;
  }

  /** Uma gravação de metas por vez em cada restaurante. */
  private naTrava(
    restauranteId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`metas:${restauranteId}`}))`;
      await fn(tx);
    });
  }

  /**
   * Cria, atualiza ou (valor null) apaga a meta da chave. Sem @@unique
   * (nulos não colidem no Postgres): roda dentro de naTrava.
   */
  private async gravar(
    restauranteId: string,
    chave: Chave,
    valor: MetaValor,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const where = {
      restauranteId,
      escopo: chave.escopo,
      tipo: chave.tipo,
      usuarioId: chave.usuarioId ?? null,
      estacao: chave.estacao ?? null,
    };
    if (!valor) {
      await tx.meta.deleteMany({ where });
      return;
    }
    const atual = await tx.meta.findFirst({ where });
    if (atual) {
      await tx.meta.update({ where: { id: atual.id }, data: valor });
    } else {
      await tx.meta.create({ data: { ...where, ...valor } });
    }
  }
}

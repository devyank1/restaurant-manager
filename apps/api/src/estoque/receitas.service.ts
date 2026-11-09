import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { TipoGrupoOpcao, UnidadeEstoque } from '@prisma/client';
import type { UsuarioToken } from '../equipe/equipe.types';
import { exigirDono } from '../equipe/papel';
import { PrismaService } from '../prisma/prisma.service';
import { TempoRealService } from '../tempo-real/tempo-real.service';

export type LinhaReceitaDto = {
  itemId: string;
  nome: string;
  unidade: UnidadeEstoque;
  quantidade: number;
};

export type PratoReceita = {
  id: string;
  nome: string;
  categoria: string;
  esgotado: boolean;
  receita: LinhaReceitaDto[];
  grupos: {
    id: string;
    nome: string;
    tipo: TipoGrupoOpcao;
    opcoes: {
      id: string;
      nome: string;
      multiplicadorPct: number;
      receita: LinhaReceitaDto[];
    }[];
  }[];
};

type Linha = { itemId: string; quantidade: number };

const porOrdem = { orderBy: { ordem: 'asc' as const } };
const comItem = {
  include: { item: true },
  where: { item: { ativo: true } },
  orderBy: { item: { nome: 'asc' as const } },
};

function linhaDto(l: {
  itemId: string;
  quantidade: number;
  item: { nome: string; unidade: UnidadeEstoque };
}): LinhaReceitaDto {
  return {
    itemId: l.itemId,
    nome: l.item.nome,
    unidade: l.item.unidade,
    quantidade: l.quantidade,
  };
}

@Injectable()
export class ReceitasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tempoReal: TempoRealService,
  ) {}

  async listar(usuario: UsuarioToken): Promise<PratoReceita[]> {
    exigirDono(usuario);
    const categorias = await this.prisma.categoria.findMany({
      where: { restauranteId: usuario.restauranteId },
      ...porOrdem,
      include: {
        pratos: {
          ...porOrdem,
          include: {
            receita: comItem,
            grupos: {
              ...porOrdem,
              include: {
                opcoes: { ...porOrdem, include: { receita: comItem } },
              },
            },
          },
        },
      },
    });
    return categorias.flatMap((c) =>
      c.pratos.map((p) => ({
        id: p.id,
        nome: p.nome,
        categoria: c.nome,
        esgotado: p.esgotado,
        receita: p.receita.map(linhaDto),
        grupos: p.grupos.map((g) => ({
          id: g.id,
          nome: g.nome,
          tipo: g.tipo,
          opcoes: g.opcoes.map((o) => ({
            id: o.id,
            nome: o.nome,
            multiplicadorPct: o.multiplicadorPct,
            receita: o.receita.map(linhaDto),
          })),
        })),
      })),
    );
  }

  private async conferirItens(itens: Linha[], usuario: UsuarioToken) {
    const ids = itens.map((i) => i.itemId);
    if (new Set(ids).size !== ids.length) {
      throw new UnprocessableEntityException({
        mensagem: 'Item repetido na receita',
      });
    }
    const validos = await this.prisma.itemEstoque.count({
      where: {
        id: { in: ids },
        restauranteId: usuario.restauranteId,
        ativo: true,
      },
    });
    if (validos !== ids.length) {
      throw new UnprocessableEntityException({
        mensagem: 'Item de estoque inválido',
      });
    }
  }

  async salvarPrato(
    pratoId: string,
    itens: Linha[],
    usuario: UsuarioToken,
  ): Promise<void> {
    exigirDono(usuario);
    const prato = await this.prisma.prato.findFirst({
      where: { id: pratoId, restauranteId: usuario.restauranteId },
    });
    if (!prato) {
      throw new NotFoundException({ mensagem: 'Prato não encontrado' });
    }
    await this.conferirItens(itens, usuario);
    await this.prisma.$transaction([
      this.prisma.receitaItem.deleteMany({ where: { pratoId } }),
      this.prisma.receitaItem.createMany({
        data: itens.map((i) => ({
          ...i,
          pratoId,
          restauranteId: usuario.restauranteId,
        })),
      }),
    ]);
  }

  async salvarOpcao(
    opcaoId: string,
    itens: Linha[],
    multiplicadorPct: number | undefined,
    usuario: UsuarioToken,
  ): Promise<void> {
    exigirDono(usuario);
    const opcao = await this.prisma.opcao.findFirst({
      where: { id: opcaoId, restauranteId: usuario.restauranteId },
      include: { grupo: true },
    });
    if (!opcao) {
      throw new NotFoundException({ mensagem: 'Opção não encontrada' });
    }
    if (
      multiplicadorPct !== undefined &&
      multiplicadorPct !== 100 &&
      opcao.grupo.tipo !== 'UNICA'
    ) {
      throw new UnprocessableEntityException({
        mensagem: 'Só tamanho tem multiplicador',
      });
    }
    await this.conferirItens(itens, usuario);
    await this.prisma.$transaction([
      this.prisma.receitaItem.deleteMany({ where: { opcaoId } }),
      this.prisma.receitaItem.createMany({
        data: itens.map((i) => ({
          ...i,
          opcaoId,
          restauranteId: usuario.restauranteId,
        })),
      }),
      this.prisma.opcao.update({
        where: { id: opcaoId },
        data: { multiplicadorPct: multiplicadorPct ?? opcao.multiplicadorPct },
      }),
    ]);
  }

  /** Só o gerente esgota um prato; o sistema nunca faz isso sozinho. */
  async esgotar(
    pratoId: string,
    esgotado: boolean,
    usuario: UsuarioToken,
  ): Promise<{ id: string; esgotado: boolean }> {
    exigirDono(usuario);
    const prato = await this.prisma.prato.findFirst({
      where: { id: pratoId, restauranteId: usuario.restauranteId },
    });
    if (!prato) {
      throw new NotFoundException({ mensagem: 'Prato não encontrado' });
    }
    await this.prisma.prato.update({
      where: { id: pratoId },
      data: { esgotado },
    });
    this.tempoReal.paraEquipe(usuario.restauranteId, 'estoque-mudou', {});
    return { id: pratoId, esgotado };
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Fornecedor, ItemEstoque, UnidadeEstoque } from '@prisma/client';
import type { UsuarioToken } from '../equipe/equipe.types';
import { exigirDono } from '../equipe/papel';
import { PrismaService } from '../prisma/prisma.service';
import { AvisosEstoqueService } from './avisos-estoque.service';
import { aplicarMovimentos } from './movimentos';
import { embalagensPara, formatarCompra } from './quantidade';

export type LinhaCompra = {
  itemId: string;
  nome: string;
  unidade: UnidadeEstoque;
  quantidade: number;
  texto: string;
  embalagem: { nome: string; quantidade: number } | null;
};

export type GrupoCompra = {
  fornecedor: { id: string; nome: string; telefone: string | null } | null;
  itens: LinhaCompra[];
};

export type ListaCompraDto = {
  id: string;
  /** Nome do restaurante (texto do pedido no WhatsApp). */
  restaurante: string;
  criadaEm: Date;
  chegouEm: Date | null;
  grupos: GrupoCompra[];
};

type Pedida = { itemId: string; quantidade: number };
type ItemComFornecedor = ItemEstoque & { fornecedor: Fornecedor | null };

function embalagemDe(i: ItemEstoque) {
  return i.embalagemNome && i.embalagemQuantidade
    ? { nome: i.embalagemNome, quantidade: i.embalagemQuantidade }
    : null;
}

/** Agrupa por fornecedor: nome A→Z, "sem fornecedor" por último. */
function agrupar(
  linhas: { item: ItemComFornecedor; quantidade: number }[],
): GrupoCompra[] {
  const grupos = new Map<string, GrupoCompra>();
  for (const { item, quantidade } of linhas) {
    const chave = item.fornecedor?.id ?? '';
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        fornecedor: item.fornecedor
          ? {
              id: item.fornecedor.id,
              nome: item.fornecedor.nome,
              telefone: item.fornecedor.telefone,
            }
          : null,
        itens: [],
      });
    }
    const embalagem = embalagemDe(item);
    grupos.get(chave)!.itens.push({
      itemId: item.id,
      nome: item.nome,
      unidade: item.unidade,
      quantidade,
      texto: formatarCompra(quantidade, item.unidade, embalagem),
      embalagem,
    });
  }
  return [...grupos.values()].sort((a, b) => {
    if (!a.fornecedor) return 1;
    if (!b.fornecedor) return -1;
    return a.fornecedor.nome.localeCompare(b.fornecedor.nome, 'pt-BR');
  });
}

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: AvisosEstoqueService,
  ) {}

  /** Itens no mínimo ou abaixo, com quanto comprar para voltar ao "cheio". */
  async sugestao(usuario: UsuarioToken): Promise<GrupoCompra[]> {
    exigirDono(usuario);
    const itens = await this.prisma.itemEstoque.findMany({
      where: { restauranteId: usuario.restauranteId, ativo: true },
      include: { fornecedor: true },
      orderBy: { nome: 'asc' },
    });
    const linhas = itens
      .filter((i) => i.quantidade <= i.minimo)
      .map((item) => {
        let quantidade = item.cheio - Math.max(item.quantidade, 0);
        if (quantidade <= 0) {
          quantidade = Math.max(item.minimo - item.quantidade, 1);
        }
        const emb = embalagemDe(item);
        if (emb) {
          quantidade =
            embalagensPara(quantidade, emb.quantidade) * emb.quantidade;
        }
        return { item, quantidade };
      });
    return agrupar(linhas);
  }

  private async montar(
    lista: {
      id: string;
      criadaEm: Date;
      chegouEm: Date | null;
      itens: unknown;
    },
    usuario: UsuarioToken,
  ): Promise<ListaCompraDto> {
    const pedidas = lista.itens as Pedida[];
    const itens = await this.prisma.itemEstoque.findMany({
      where: {
        id: { in: pedidas.map((p) => p.itemId) },
        restauranteId: usuario.restauranteId,
      },
      include: { fornecedor: true },
    });
    const restaurante = await this.prisma.restaurante.findUniqueOrThrow({
      where: { id: usuario.restauranteId },
      select: { nome: true },
    });
    const porId = new Map(itens.map((i) => [i.id, i]));
    const linhas = pedidas
      .filter((p) => porId.has(p.itemId))
      .map((p) => ({ item: porId.get(p.itemId)!, quantidade: p.quantidade }));
    return {
      id: lista.id,
      restaurante: restaurante.nome,
      criadaEm: lista.criadaEm,
      chegouEm: lista.chegouEm,
      grupos: agrupar(linhas),
    };
  }

  async salvar(
    itens: Pedida[],
    usuario: UsuarioToken,
  ): Promise<ListaCompraDto> {
    exigirDono(usuario);
    const ids = itens.map((i) => i.itemId);
    const validos = await this.prisma.itemEstoque.count({
      where: {
        id: { in: ids },
        restauranteId: usuario.restauranteId,
        ativo: true,
      },
    });
    if (new Set(ids).size !== ids.length || validos !== ids.length) {
      throw new UnprocessableEntityException({
        mensagem: 'Item de estoque inválido',
      });
    }
    const lista = await this.prisma.listaCompra.create({
      data: { restauranteId: usuario.restauranteId, itens },
    });
    await this.avisos.enviar(usuario.restauranteId, []);
    return this.montar(lista, usuario);
  }

  private async achar(id: string, usuario: UsuarioToken) {
    const lista = await this.prisma.listaCompra.findFirst({
      where: { id, restauranteId: usuario.restauranteId },
    });
    if (!lista) {
      throw new NotFoundException({ mensagem: 'Lista não encontrada' });
    }
    return lista;
  }

  async lista(id: string, usuario: UsuarioToken): Promise<ListaCompraDto> {
    exigirDono(usuario);
    return this.montar(await this.achar(id, usuario), usuario);
  }

  /** Compra chegou: entrada (um lote) com o que o gerente confirmou. */
  async chegou(id: string, itens: Pedida[], usuario: UsuarioToken) {
    exigirDono(usuario);
    const avisos = await this.prisma.$transaction(async (tx) => {
      // Marca primeiro: o segundo clique acha chegouEm preenchido.
      const marcada = await tx.listaCompra.updateMany({
        where: { id, restauranteId: usuario.restauranteId, chegouEm: null },
        data: { chegouEm: new Date() },
      });
      if (marcada.count === 0) {
        await this.achar(id, usuario);
        throw new ConflictException({ mensagem: 'Esta compra já foi lançada' });
      }
      const positivos = itens.filter((i) => i.quantidade > 0);
      const validos = await tx.itemEstoque.count({
        where: {
          id: { in: positivos.map((i) => i.itemId) },
          restauranteId: usuario.restauranteId,
        },
      });
      if (validos !== positivos.length) {
        throw new UnprocessableEntityException({
          mensagem: 'Item de estoque inválido',
        });
      }
      return aplicarMovimentos(
        tx,
        usuario.restauranteId,
        usuario.id,
        positivos.map((i) => ({
          itemId: i.itemId,
          tipo: 'ENTRADA' as const,
          quantidade: i.quantidade,
        })),
      );
    });
    await this.avisos.enviar(usuario.restauranteId, avisos);
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  Fornecedor,
  ItemEstoque,
  MotivoPerda,
  Prisma,
  TipoMovimento,
  UnidadeEstoque,
} from '@prisma/client';
import { inicioDoDiaDeServico } from '../comum/dia-servico';
import type { UsuarioToken } from '../equipe/equipe.types';
import { exigirDono } from '../equipe/papel';
import { PrismaService } from '../prisma/prisma.service';
import { AvisosEstoqueService } from './avisos-estoque.service';
import {
  ajustarItem,
  aplicarMovimentos,
  nivelDe,
  recalcularNivel,
  type AvisoEstoque,
} from './movimentos';
import { formatarQuantidade } from './quantidade';

type Tx = Prisma.TransactionClient;

const DESFAZER_MS = 10 * 60_000;
const DESFAZIVEIS: TipoMovimento[] = ['ENTRADA', 'CONTAGEM', 'PERDA'];

export type ItemEstoqueDto = {
  id: string;
  nome: string;
  unidade: UnidadeEstoque;
  quantidade: number;
  minimo: number;
  cheio: number;
  nivel: ItemEstoque['nivel'];
  fornecedor: { id: string; nome: string } | null;
  embalagem: { nome: string; quantidade: number } | null;
};

export type DadosItem = {
  nome: string;
  unidade: UnidadeEstoque;
  minimo: number;
  cheio: number;
  fornecedorId?: string | null;
  embalagemNome?: string | null;
  embalagemQuantidade?: number | null;
  quantidade?: number;
};

export type DadosFornecedor = {
  nome: string;
  telefone?: string | null;
  observacao?: string | null;
};

export type PerdaPedida = {
  itemId: string;
  quantidade: number;
  motivo: MotivoPerda;
  observacao?: string;
};

export type Desfazivel = { lote: string; descricao: string; ate: string };

export type ResumoEstoque = {
  acabando: ItemEstoqueDto[];
  acabou: (ItemEstoqueDto & {
    pratos: { id: string; nome: string; esgotado: boolean }[];
  })[];
  perdasHoje: {
    itemId: string;
    nome: string;
    quantidade: number;
    unidade: UnidadeEstoque;
    motivo: MotivoPerda | null;
    observacao: string | null;
    criadoEm: Date;
  }[];
  listasAbertas: { id: string; criadaEm: Date }[];
};

type ItemComFornecedor = ItemEstoque & { fornecedor: Fornecedor | null };

export function itemDto(i: ItemComFornecedor): ItemEstoqueDto {
  return {
    id: i.id,
    nome: i.nome,
    unidade: i.unidade,
    quantidade: i.quantidade,
    minimo: i.minimo,
    cheio: i.cheio,
    nivel: i.nivel,
    fornecedor: i.fornecedor
      ? { id: i.fornecedor.id, nome: i.fornecedor.nome }
      : null,
    embalagem:
      i.embalagemNome && i.embalagemQuantidade
        ? { nome: i.embalagemNome, quantidade: i.embalagemQuantidade }
        : null,
  };
}

function fornecedorDto(f: Fornecedor) {
  return {
    id: f.id,
    nome: f.nome,
    telefone: f.telefone,
    observacao: f.observacao,
  };
}

@Injectable()
export class EstoqueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: AvisosEstoqueService,
  ) {}

  // ---------- itens ----------

  async itens(
    usuario: UsuarioToken,
    ordem?: string,
  ): Promise<ItemEstoqueDto[]> {
    const itens = await this.prisma.itemEstoque.findMany({
      where: { restauranteId: usuario.restauranteId, ativo: true },
      include: { fornecedor: true },
      orderBy: { nome: 'asc' },
    });
    const dtos = itens.map(itemDto);
    if (ordem !== 'perdas') return dtos;
    // "Mais usados no topo" do Avisar perda: até 5 com mais perdas em 30 dias.
    const desde = new Date(Date.now() - 30 * 24 * 3600_000);
    const contagem = await this.prisma.movimentoEstoque.groupBy({
      by: ['itemId'],
      where: {
        restauranteId: usuario.restauranteId,
        tipo: 'PERDA',
        desfeitoEm: null,
        criadoEm: { gte: desde },
      },
      _count: { _all: true },
    });
    const topo = contagem
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 5)
      .map((c) => c.itemId);
    const primeiro = topo
      .map((id) => dtos.find((d) => d.id === id))
      .filter((d): d is ItemEstoqueDto => !!d);
    return [...primeiro, ...dtos.filter((d) => !topo.includes(d.id))];
  }

  private async achar(
    db: Tx | PrismaService,
    id: string,
    usuario: UsuarioToken,
  ): Promise<ItemComFornecedor> {
    const item = await db.itemEstoque.findFirst({
      where: { id, restauranteId: usuario.restauranteId, ativo: true },
      include: { fornecedor: true },
    });
    if (!item) throw new NotFoundException({ mensagem: 'Item não encontrado' });
    return item;
  }

  private async conferirFornecedor(
    fornecedorId: string | null | undefined,
    usuario: UsuarioToken,
  ) {
    if (!fornecedorId) return;
    const existe = await this.prisma.fornecedor.count({
      where: { id: fornecedorId, restauranteId: usuario.restauranteId },
    });
    if (!existe) {
      throw new UnprocessableEntityException({
        mensagem: 'Fornecedor inválido',
      });
    }
  }

  async criarItem(
    dados: DadosItem,
    usuario: UsuarioToken,
  ): Promise<ItemEstoqueDto> {
    exigirDono(usuario);
    await this.conferirFornecedor(dados.fornecedorId, usuario);
    const { quantidade = 0, ...campos } = dados;
    const { item, avisos } = await this.prisma.$transaction(async (tx) => {
      const existente = await tx.itemEstoque.findUnique({
        where: {
          restauranteId_nome: {
            restauranteId: usuario.restauranteId,
            nome: dados.nome,
          },
        },
      });
      if (existente?.ativo) {
        throw new ConflictException({
          mensagem: 'Já existe um item com esse nome',
        });
      }
      // Arquivado com o mesmo nome: ganha um nome de arquivo e o item novo
      // começa do zero (sem misturar unidade, quantidade e histórico antigos).
      if (existente) {
        await tx.itemEstoque.update({
          where: { id: existente.id },
          data: {
            nome: `${existente.nome} (arquivado ${existente.id.slice(0, 8)})`,
          },
        });
      }
      const base = await tx.itemEstoque.create({
        data: {
          ...campos,
          restauranteId: usuario.restauranteId,
          nivel: nivelDe(0, campos.minimo),
        },
      });
      const avisos =
        quantidade > 0
          ? await aplicarMovimentos(tx, usuario.restauranteId, usuario.id, [
              { itemId: base.id, tipo: 'ENTRADA', quantidade },
            ])
          : [];
      return { item: await this.achar(tx, base.id, usuario), avisos };
    });
    this.avisos.soltar(usuario.restauranteId, avisos);
    return itemDto(item);
  }

  async editarItem(
    id: string,
    dados: Partial<Omit<DadosItem, 'quantidade'>>,
    usuario: UsuarioToken,
  ): Promise<ItemEstoqueDto> {
    exigirDono(usuario);
    await this.conferirFornecedor(dados.fornecedorId, usuario);
    const { item, aviso } = await this.prisma.$transaction(async (tx) => {
      const atual = await this.achar(tx, id, usuario);
      if (dados.unidade && dados.unidade !== atual.unidade) {
        const movimentos = await tx.movimentoEstoque.count({
          where: { itemId: id },
        });
        if (movimentos > 0) {
          throw new ConflictException({
            mensagem:
              'Não dá para mudar a unidade de um item que já tem movimentos',
          });
        }
      }
      if (dados.nome && dados.nome !== atual.nome) {
        const mesmoNome = await tx.itemEstoque.count({
          where: {
            restauranteId: usuario.restauranteId,
            nome: dados.nome,
          },
        });
        if (mesmoNome) {
          throw new ConflictException({
            mensagem: 'Já existe um item com esse nome',
          });
        }
      }
      const salvo = await tx.itemEstoque.update({
        where: { id },
        data: dados,
      });
      const aviso = await recalcularNivel(tx, salvo);
      return { item: await this.achar(tx, id, usuario), aviso };
    });
    this.avisos.soltar(usuario.restauranteId, aviso ? [aviso] : []);
    return itemDto(item);
  }

  async arquivarItem(id: string, usuario: UsuarioToken): Promise<void> {
    exigirDono(usuario);
    await this.prisma.$transaction(async (tx) => {
      await this.achar(tx, id, usuario);
      await tx.receitaItem.deleteMany({ where: { itemId: id } });
      await tx.itemEstoque.update({ where: { id }, data: { ativo: false } });
    });
    this.avisos.soltar(usuario.restauranteId, []);
  }

  async movimentos(id: string, usuario: UsuarioToken) {
    exigirDono(usuario);
    await this.achar(this.prisma, id, usuario);
    const lista = await this.prisma.movimentoEstoque.findMany({
      where: { itemId: id },
      include: { usuario: { select: { nome: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
    return lista.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      quantidade: m.quantidade,
      motivo: m.motivo,
      observacao: m.observacao,
      usuario: m.usuario?.nome ?? null,
      criadoEm: m.criadoEm,
      desfeito: m.desfeitoEm !== null,
    }));
  }

  // ---------- movimentos manuais ----------

  /** Roda a mudança numa transação e manda os avisos depois do commit. */
  private async lancar<T>(
    usuario: UsuarioToken,
    trabalho: (tx: Tx) => Promise<{ resultado: T; avisos: AvisoEstoque[] }>,
  ): Promise<T> {
    const { resultado, avisos } = await this.prisma.$transaction(trabalho);
    this.avisos.soltar(usuario.restauranteId, avisos);
    return resultado;
  }

  contar(
    id: string,
    quantidade: number,
    usuario: UsuarioToken,
  ): Promise<ItemEstoqueDto> {
    exigirDono(usuario);
    return this.lancar(usuario, async (tx) => {
      const item = await this.achar(tx, id, usuario);
      const avisos = await aplicarMovimentos(
        tx,
        usuario.restauranteId,
        usuario.id,
        [
          {
            itemId: id,
            tipo: 'CONTAGEM',
            quantidade: quantidade - item.quantidade,
          },
        ],
      );
      return { resultado: itemDto(await this.achar(tx, id, usuario)), avisos };
    });
  }

  entrada(
    itens: { itemId: string; quantidade: number }[],
    usuario: UsuarioToken,
  ): Promise<ItemEstoqueDto[]> {
    exigirDono(usuario);
    return this.lancar(usuario, async (tx) => {
      for (const i of itens) await this.achar(tx, i.itemId, usuario);
      const avisos = await aplicarMovimentos(
        tx,
        usuario.restauranteId,
        usuario.id,
        itens.map((i) => ({
          itemId: i.itemId,
          tipo: 'ENTRADA' as const,
          quantidade: i.quantidade,
        })),
      );
      const atualizados: ItemEstoqueDto[] = [];
      for (const i of itens) {
        atualizados.push(itemDto(await this.achar(tx, i.itemId, usuario)));
      }
      return { resultado: atualizados, avisos };
    });
  }

  perda(pedido: PerdaPedida, usuario: UsuarioToken): Promise<ItemEstoqueDto> {
    // Qualquer papel avisa perda [spec 4A §3.4].
    if (pedido.motivo === 'OUTRO' && !pedido.observacao?.trim()) {
      throw new UnprocessableEntityException({
        mensagem: 'Conte o que aconteceu',
      });
    }
    return this.lancar(usuario, async (tx) => {
      await this.achar(tx, pedido.itemId, usuario);
      const avisos = await aplicarMovimentos(
        tx,
        usuario.restauranteId,
        usuario.id,
        [
          {
            itemId: pedido.itemId,
            tipo: 'PERDA',
            quantidade: -pedido.quantidade,
            motivo: pedido.motivo,
            observacao: pedido.observacao?.trim() || undefined,
          },
        ],
      );
      return {
        resultado: itemDto(await this.achar(tx, pedido.itemId, usuario)),
        avisos,
      };
    });
  }

  // ---------- desfazer ----------

  private async ultimoLote(db: Tx | PrismaService, usuario: UsuarioToken) {
    const ultimo = await db.movimentoEstoque.findFirst({
      where: {
        restauranteId: usuario.restauranteId,
        usuarioId: usuario.id,
        tipo: { in: DESFAZIVEIS },
      },
      orderBy: { criadoEm: 'desc' },
    });
    if (
      !ultimo ||
      ultimo.desfeitoEm ||
      Date.now() - ultimo.criadoEm.getTime() > DESFAZER_MS
    ) {
      return null;
    }
    return db.movimentoEstoque.findMany({
      where: { lote: ultimo.lote, desfeitoEm: null },
      include: { item: true },
    });
  }

  async desfazivel(usuario: UsuarioToken): Promise<Desfazivel | null> {
    const lote = await this.ultimoLote(this.prisma, usuario);
    if (!lote?.length) return null;
    const m = lote[0];
    const descricao =
      m.tipo === 'PERDA'
        ? `Perda: ${formatarQuantidade(-m.quantidade, m.item.unidade)} de ${m.item.nome}`
        : m.tipo === 'CONTAGEM'
          ? `Contagem de ${m.item.nome}`
          : lote.length === 1
            ? `Chegada de ${m.item.nome}`
            : `Chegada de compra (${lote.length} itens)`;
    return {
      lote: m.lote,
      descricao,
      ate: new Date(m.criadoEm.getTime() + DESFAZER_MS).toISOString(),
    };
  }

  desfazer(usuario: UsuarioToken): Promise<void> {
    return this.lancar(usuario, async (tx) => {
      const lote = await this.ultimoLote(tx, usuario);
      if (!lote?.length) {
        throw new ConflictException({ mensagem: 'Nada para desfazer' });
      }
      const avisos: AvisoEstoque[] = [];
      const agora = new Date();
      // Só desfaz o que ainda não foi desfeito: dois toques ao mesmo tempo
      // esperam a trava da linha e o segundo não acha nada.
      const marcados = await tx.movimentoEstoque.updateMany({
        where: { lote: lote[0].lote, desfeitoEm: null },
        data: { desfeitoEm: agora },
      });
      if (marcados.count !== lote.length) {
        throw new ConflictException({ mensagem: 'Nada para desfazer' });
      }
      const ordenados = [...lote].sort((a, b) =>
        a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0,
      );
      for (const m of ordenados) {
        const aviso = await ajustarItem(tx, m.itemId, -m.quantidade);
        if (aviso) avisos.push(aviso);
      }
      // Chegada de compra desfeita: a lista volta a ficar aberta.
      await tx.listaCompra.updateMany({
        where: { loteChegada: lote[0].lote },
        data: { chegouEm: null, loteChegada: null },
      });
      return { resultado: undefined, avisos };
    });
  }

  // ---------- resumo ----------

  async resumo(usuario: UsuarioToken): Promise<ResumoEstoque> {
    exigirDono(usuario);
    const restauranteId = usuario.restauranteId;
    const itens = await this.prisma.itemEstoque.findMany({
      where: { restauranteId, ativo: true, nivel: { not: 'OK' } },
      include: {
        fornecedor: true,
        receitas: {
          include: {
            prato: true,
            opcao: { include: { grupo: { include: { prato: true } } } },
          },
        },
      },
      orderBy: { nome: 'asc' },
    });
    const perdas = await this.prisma.movimentoEstoque.findMany({
      where: {
        restauranteId,
        tipo: 'PERDA',
        desfeitoEm: null,
        criadoEm: { gte: inicioDoDiaDeServico(new Date()) },
      },
      include: { item: true },
      orderBy: { criadoEm: 'desc' },
    });
    const listas = await this.prisma.listaCompra.findMany({
      where: { restauranteId, chegouEm: null },
      orderBy: { criadaEm: 'desc' },
      select: { id: true, criadaEm: true },
    });

    return {
      acabando: itens.filter((i) => i.nivel === 'ACABANDO').map(itemDto),
      acabou: itens
        .filter((i) => i.nivel === 'ZERADO')
        .map((i) => {
          const pratos = new Map<
            string,
            { id: string; nome: string; esgotado: boolean }
          >();
          for (const r of i.receitas) {
            const prato = r.prato ?? r.opcao?.grupo.prato;
            if (prato) {
              pratos.set(prato.id, {
                id: prato.id,
                nome: prato.nome,
                esgotado: prato.esgotado,
              });
            }
          }
          return { ...itemDto(i), pratos: [...pratos.values()] };
        }),
      perdasHoje: perdas.map((m) => ({
        itemId: m.itemId,
        nome: m.item.nome,
        quantidade: -m.quantidade,
        unidade: m.item.unidade,
        motivo: m.motivo,
        observacao: m.observacao,
        criadoEm: m.criadoEm,
      })),
      listasAbertas: listas,
    };
  }

  // ---------- fornecedores ----------

  async fornecedores(usuario: UsuarioToken) {
    exigirDono(usuario);
    const lista = await this.prisma.fornecedor.findMany({
      where: { restauranteId: usuario.restauranteId },
      orderBy: { nome: 'asc' },
    });
    return lista.map(fornecedorDto);
  }

  async criarFornecedor(dados: DadosFornecedor, usuario: UsuarioToken) {
    exigirDono(usuario);
    return fornecedorDto(
      await this.prisma.fornecedor.create({
        data: { ...dados, restauranteId: usuario.restauranteId },
      }),
    );
  }

  private async acharFornecedor(id: string, usuario: UsuarioToken) {
    const f = await this.prisma.fornecedor.findFirst({
      where: { id, restauranteId: usuario.restauranteId },
    });
    if (!f) {
      throw new NotFoundException({ mensagem: 'Fornecedor não encontrado' });
    }
    return f;
  }

  async editarFornecedor(
    id: string,
    dados: Partial<DadosFornecedor>,
    usuario: UsuarioToken,
  ) {
    exigirDono(usuario);
    await this.acharFornecedor(id, usuario);
    return fornecedorDto(
      await this.prisma.fornecedor.update({ where: { id }, data: dados }),
    );
  }

  async excluirFornecedor(id: string, usuario: UsuarioToken): Promise<void> {
    exigirDono(usuario);
    await this.acharFornecedor(id, usuario);
    await this.prisma.fornecedor.delete({ where: { id } });
  }
}

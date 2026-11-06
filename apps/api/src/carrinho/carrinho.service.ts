import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { COM_OPCOES, NovoItem } from '../pedidos/pratos';
import { precoUnitario, resumirOpcoes, Selecao } from '../pedidos/preco';
import { ITEM_NAO_ENCONTRADO, pratoValidado } from '../pedidos/validar-item';
import { Participante } from '../sessao-mesa/participante';
import { CarrinhoPublico } from './carrinho.types';

@Injectable()
export class CarrinhoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Preço sempre recalculado com os valores atuais do cardápio. */
  async ler(sessaoId: string): Promise<CarrinhoPublico> {
    const itens = await this.prisma.itemCarrinho.findMany({
      where: { sessaoId },
      orderBy: { criadoEm: 'asc' },
    });
    const pratos = await this.prisma.prato.findMany({
      where: { id: { in: itens.map((i) => i.pratoId) } },
      include: COM_OPCOES,
    });
    const porId = new Map(pratos.map((p) => [p.id, p]));

    const publicos = itens.flatMap((item) => {
      const prato = porId.get(item.pratoId);
      // Prato apagado do cardápio depois de adicionado: some do carrinho.
      if (!prato) return [];
      const selecao = item.selecao as Selecao;
      return [
        {
          id: item.id,
          pratoId: item.pratoId,
          nome: prato.nome,
          resumoOpcoes: resumirOpcoes(prato, selecao),
          selecao,
          observacao: item.observacao,
          quantidade: item.quantidade,
          precoUnitarioCentavos: precoUnitario(prato, selecao),
        },
      ];
    });
    return {
      itens: publicos,
      totalCentavos: publicos.reduce(
        (soma, i) => soma + i.precoUnitarioCentavos * i.quantidade,
        0,
      ),
    };
  }

  async adicionar(p: Participante, item: NovoItem): Promise<CarrinhoPublico> {
    await pratoValidado(this.prisma, p.restauranteId, item);
    await this.prisma.itemCarrinho.create({
      data: {
        restauranteId: p.restauranteId,
        sessaoId: p.sessao.id,
        pratoId: item.pratoId,
        selecao: item.selecao,
        observacao: item.observacao,
        quantidade: item.quantidade,
        adicionadoPor: p.dispositivo.dispositivoId,
      },
    });
    return this.depoisDeMudar(p.sessao.id);
  }

  /** Quantidade 0 remove. Item de outra sessão → 404. */
  async alterarQuantidade(
    p: Participante,
    itemId: string,
    quantidade: number,
  ): Promise<CarrinhoPublico> {
    const item = await this.prisma.itemCarrinho.findFirst({
      where: { id: itemId, sessaoId: p.sessao.id },
    });
    if (!item) throw ITEM_NAO_ENCONTRADO();
    if (quantidade === 0) {
      await this.prisma.itemCarrinho.deleteMany({ where: { id: item.id } });
    } else {
      await this.prisma.itemCarrinho.update({
        where: { id: item.id },
        data: { quantidade },
      });
    }
    return this.depoisDeMudar(p.sessao.id);
  }

  /** Remover o que outro celular já removeu não é erro: devolve o atual. */
  async remover(p: Participante, itemId: string): Promise<CarrinhoPublico> {
    const { count } = await this.prisma.itemCarrinho.deleteMany({
      where: { id: itemId, sessaoId: p.sessao.id },
    });
    return count > 0 ? this.depoisDeMudar(p.sessao.id) : this.ler(p.sessao.id);
  }

  /** Ponto de aviso de mudança (ligado ao tempo real na Task 5). */
  async depoisDeMudar(sessaoId: string): Promise<CarrinhoPublico> {
    return this.ler(sessaoId);
  }
}

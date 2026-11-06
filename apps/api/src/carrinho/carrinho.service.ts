import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { COM_OPCOES, NovoItem } from '../pedidos/pratos';
import { precoUnitario, resumirOpcoes, Selecao } from '../pedidos/preco';
import { ITEM_NAO_ENCONTRADO, pratoValidado } from '../pedidos/validar-item';
import { Participante } from '../sessao-mesa/participante';
import { travarMesa } from '../sessao-mesa/trava';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { CarrinhoPublico } from './carrinho.types';

type Db = Prisma.TransactionClient | PrismaService;

let ultimaVersao = 0;
/** Carimbo crescente neste processo (dois no mesmo ms não empatam). */
function novaVersao(): number {
  ultimaVersao = Math.max(Date.now(), ultimaVersao + 1);
  return ultimaVersao;
}

/**
 * Toda mudança roda com a mesa travada e relê o carrinho ainda sob a trava,
 * para envio, adições e avisos ficarem numa ordem só.
 */
@Injectable()
export class CarrinhoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tempoReal: TempoRealService,
  ) {}

  /**
   * Preço sempre recalculado com os valores atuais do cardápio. A versão é
   * tirada antes de ler: versão maior nunca traz foto mais velha.
   */
  async ler(sessaoId: string, db: Db = this.prisma): Promise<CarrinhoPublico> {
    const versao = novaVersao();
    const itens = await db.itemCarrinho.findMany({
      where: { sessaoId },
      orderBy: { criadoEm: 'asc' },
    });
    const pratos = await db.prato.findMany({
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
      versao,
    };
  }

  /** Muda com a mesa travada, relê sob a trava e avisa após o commit. */
  private async mudar(
    p: Participante,
    mudanca: (tx: Prisma.TransactionClient) => Promise<boolean>,
  ): Promise<CarrinhoPublico> {
    const { carrinho, mudou } = await this.prisma.$transaction(async (tx) => {
      await travarMesa(tx, p.mesa.id);
      const mudou = await mudanca(tx);
      return { mudou, carrinho: await this.ler(p.sessao.id, tx) };
    });
    if (mudou) this.tempoReal.paraSessao(p.sessao.id, 'carrinho', carrinho);
    return carrinho;
  }

  async adicionar(p: Participante, item: NovoItem): Promise<CarrinhoPublico> {
    await pratoValidado(this.prisma, p.restauranteId, item);
    return this.mudar(p, async (tx) => {
      await tx.itemCarrinho.create({
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
      return true;
    });
  }

  /**
   * Quantidade 0 remove; remover o que já sumiu (outro celular, envio)
   * devolve o carrinho atual. Mudar quantidade de item inexistente → 404.
   */
  async alterarQuantidade(
    p: Participante,
    itemId: string,
    quantidade: number,
  ): Promise<CarrinhoPublico> {
    if (quantidade === 0) return this.remover(p, itemId);
    return this.mudar(p, async (tx) => {
      const { count } = await tx.itemCarrinho.updateMany({
        where: { id: itemId, sessaoId: p.sessao.id },
        data: { quantidade },
      });
      if (count === 0) throw ITEM_NAO_ENCONTRADO();
      return true;
    });
  }

  async remover(p: Participante, itemId: string): Promise<CarrinhoPublico> {
    return this.mudar(p, async (tx) => {
      const { count } = await tx.itemCarrinho.deleteMany({
        where: { id: itemId, sessaoId: p.sessao.id },
      });
      return count > 0;
    });
  }

  /** Relê sob a trava e manda para todos (ex.: depois de enviar rodada). */
  avisar(p: Participante): Promise<CarrinhoPublico> {
    return this.mudar(p, () => Promise.resolve(true));
  }
}

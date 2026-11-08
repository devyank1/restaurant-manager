import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FormaPagamento } from '@prisma/client';
import type { UsuarioToken } from '../equipe/equipe.types';
import { exigirSalao } from '../equipe/papel';
import { EventosService } from '../eventos/eventos.service';
import { PrismaService } from '../prisma/prisma.service';
import { somarConfirmadas } from '../rodadas/mapear';
import { travarMesa } from '../sessao-mesa/trava';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { calcularConta } from './calcular-conta';

/** Corpo já validado do fechamento. */
export type PedidoFechamento = {
  servico: boolean;
  couvert: boolean;
  pessoas?: number;
  formaPagamento: FormaPagamento;
  /** O total que o garçom viu na tela. */
  totalCentavos: number;
};

export type Fechamento = {
  mesa: { numero: number };
  totalCentavos: number;
  formaPagamento: FormaPagamento;
};

@Injectable()
export class ContaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
    private readonly tempoReal: TempoRealService,
  ) {}

  /**
   * Dá baixa na conta da mesa: confere o total, encerra a sessão, resolve os
   * chamados e limpa o carrinho. Itens ainda na produção continuam lá.
   */
  async fechar(
    token: string,
    pedido: PedidoFechamento,
    usuario: UsuarioToken,
  ): Promise<Fechamento> {
    exigirSalao(usuario);
    const mesa = await this.prisma.mesa.findFirst({
      where: { token, restauranteId: usuario.restauranteId },
    });
    if (!mesa) throw new NotFoundException({ mensagem: 'Mesa não encontrada' });

    const fechada = await this.prisma.$transaction(async (tx) => {
      await travarMesa(tx, mesa.id);
      const sessao = await tx.sessaoMesa.findFirst({
        where: { mesaId: mesa.id, status: 'ABERTA' },
        include: { rodadas: { include: { itens: true } } },
      });
      if (!sessao) {
        throw new ConflictException({ mensagem: 'Esta mesa já foi fechada' });
      }
      if (sessao.rodadas.some((r) => r.status === 'AGUARDANDO_GARCOM')) {
        throw new ConflictException({
          mensagem: 'Confirme ou recuse os pedidos pendentes antes de fechar',
        });
      }
      const config = await tx.restaurante.findUniqueOrThrow({
        where: { id: mesa.restauranteId },
      });
      if (
        (pedido.servico && !config.servicoHabilitado) ||
        (pedido.couvert && !config.couvertHabilitado)
      ) {
        throw new HttpException(
          { mensagem: 'Serviço ou couvert desligado neste restaurante' },
          422,
        );
      }
      const conta = calcularConta({
        subtotalCentavos: somarConfirmadas(sessao.rodadas),
        servico: pedido.servico,
        couvert: pedido.couvert,
        pessoas: pedido.pessoas ?? 0,
        couvertUnitarioCentavos: config.couvertCentavos,
      });
      if (conta.totalCentavos !== pedido.totalCentavos) {
        throw new ConflictException({
          mensagem: 'A conta mudou. Confira o novo total.',
        });
      }

      const pessoas = pedido.couvert ? (pedido.pessoas ?? null) : null;
      await tx.sessaoMesa.update({
        where: { id: sessao.id },
        data: {
          status: 'FECHADA',
          fechadaEm: new Date(),
          formaPagamento: pedido.formaPagamento,
          subtotalCentavos: conta.subtotalCentavos,
          servicoCentavos: conta.servicoCentavos,
          couvertCentavos: conta.couvertCentavos,
          pessoas,
          totalCentavos: conta.totalCentavos,
          fechadaPorId: usuario.id,
        },
      });
      await tx.chamado.updateMany({
        where: { sessaoId: sessao.id, status: { not: 'RESOLVIDO' } },
        data: { status: 'RESOLVIDO' },
      });
      await tx.itemCarrinho.deleteMany({ where: { sessaoId: sessao.id } });
      return { sessao, conta, pessoas };
    });

    const { sessao, conta, pessoas } = fechada;
    await this.eventos.publicar({
      restauranteId: mesa.restauranteId,
      tipo: 'ContaFechada',
      dados: {
        sessaoId: sessao.id,
        mesaId: mesa.id,
        mesaNumero: mesa.numero,
        garcomId: sessao.garcomId,
        fechadaPorId: usuario.id,
        formaPagamento: pedido.formaPagamento,
        subtotalCentavos: conta.subtotalCentavos,
        servicoCentavos: conta.servicoCentavos,
        couvertCentavos: conta.couvertCentavos,
        pessoas,
        totalCentavos: conta.totalCentavos,
      },
    });
    this.tempoReal.paraSessao(sessao.id, 'conta-fechada', {});
    this.tempoReal.paraEquipe(mesa.restauranteId, 'mesa-mudou', {});
    this.tempoReal.paraEquipe(mesa.restauranteId, 'chamados-mudaram', {});

    return {
      mesa: { numero: mesa.numero },
      totalCentavos: conta.totalCentavos,
      formaPagamento: pedido.formaPagamento,
    };
  }
}

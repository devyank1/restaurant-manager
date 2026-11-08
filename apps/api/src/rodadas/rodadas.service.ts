import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CarrinhoService } from '../carrinho/carrinho.service';
import { ChamadosService } from '../chamados/chamados.service';
import { EventosService } from '../eventos/eventos.service';
import { COM_OPCOES } from '../pedidos/pratos';
import { precoUnitario, resumirOpcoes, Selecao } from '../pedidos/preco';
import { PrismaService } from '../prisma/prisma.service';
import { Participante } from '../sessao-mesa/participante';
import { travarMesa } from '../sessao-mesa/trava';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { paraPublica, somarConfirmadas } from './mapear';
import { COM_ITENS, RodadaPublica, RodadasDaMesa } from './rodadas.types';

/** Lado do cliente: enviar o carrinho como rodada e ver as rodadas. */
@Injectable()
export class RodadasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carrinho: CarrinhoService,
    private readonly chamados: ChamadosService,
    private readonly eventos: EventosService,
    private readonly tempoReal: TempoRealService,
  ) {}

  async listar(sessaoId: string): Promise<RodadasDaMesa> {
    const rodadas = await this.prisma.rodada.findMany({
      where: { sessaoId },
      orderBy: { criadoEm: 'asc' },
      include: COM_ITENS,
    });
    const chamados = await this.prisma.chamado.count({
      where: { sessaoId, tipo: 'ATENDENTE', status: { not: 'RESOLVIDO' } },
    });
    return {
      rodadas: rodadas.map(paraPublica),
      totalParcialCentavos: somarConfirmadas(rodadas),
      chamadoAberto: chamados > 0,
    };
  }

  /**
   * Congela o carrinho numa rodada, com preço calculado agora, e esvazia o
   * carrinho. A trava da mesa faz o toque duplo achar o carrinho vazio.
   */
  async enviar(p: Participante): Promise<RodadaPublica> {
    const resultado = await this.prisma.$transaction(async (tx) => {
      await travarMesa(tx, p.mesa.id);
      const itens = await tx.itemCarrinho.findMany({
        where: { sessaoId: p.sessao.id },
        orderBy: { criadoEm: 'asc' },
      });
      if (itens.length === 0) {
        throw new UnprocessableEntityException({ mensagem: 'Carrinho vazio' });
      }
      const pratos = await tx.prato.findMany({
        where: { id: { in: itens.map((i) => i.pratoId) } },
        include: COM_OPCOES,
      });
      const porId = new Map(pratos.map((prato) => [prato.id, prato]));

      // Esgotou (ou saiu do cardápio) depois de ir para o carrinho.
      const fora = itens.filter((i) => porId.get(i.pratoId)?.esgotado ?? true);
      if (fora.length > 0) {
        await tx.itemCarrinho.deleteMany({
          where: { id: { in: fora.map((i) => i.id) } },
        });
        const pratoIds = [...new Set(fora.map((i) => i.pratoId))];
        const nomes = pratoIds.map((id) => porId.get(id)?.nome ?? 'Um prato');
        return { tipo: 'esgotou' as const, nomes, pratoIds };
      }

      // Relidos sob a trava: o garçom pode ter acabado de confirmar.
      const sessao = await tx.sessaoMesa.findUniqueOrThrow({
        where: { id: p.sessao.id },
      });
      const dispositivo = await tx.dispositivoSessao.findUniqueOrThrow({
        where: { id: p.dispositivo.id },
      });
      const restaurante = await tx.restaurante.findUniqueOrThrow({
        where: { id: p.restauranteId },
      });
      const agora = new Date();

      const congelados = itens.map((item) => {
        const prato = porId.get(item.pratoId)!;
        const selecao = item.selecao as Selecao;
        return {
          restauranteId: p.restauranteId,
          pratoId: prato.id,
          nome: prato.nome,
          resumoOpcoes: resumirOpcoes(prato, selecao),
          selecao,
          observacao: item.observacao,
          quantidade: item.quantidade,
          precoUnitarioCentavos: precoUnitario(prato, selecao),
          estacao: prato.categoria.estacao,
        };
      });
      const total = congelados.reduce(
        (soma, i) => soma + i.precoUnitarioCentavos * i.quantidade,
        0,
      );
      const limite = restaurante.limiteConfirmacaoCentavos;
      // Exceções [spec §5.5]: acima do limite ou prato que exige confirmação.
      const precisaConfirmar =
        !sessao.garcomId ||
        !dispositivo.confirmado ||
        (limite !== null && total > limite) ||
        pratos.some((prato) => prato.exigeConfirmacao);
      const rodada = await tx.rodada.create({
        data: {
          restauranteId: p.restauranteId,
          sessaoId: p.sessao.id,
          dispositivoId: p.dispositivo.dispositivoId,
          status: precisaConfirmar ? 'AGUARDANDO_GARCOM' : 'CONFIRMADA',
          confirmadaEm: precisaConfirmar ? null : agora,
          direta: !precisaConfirmar,
          totalCentavos: total,
          itens: { create: congelados },
        },
        include: COM_ITENS,
      });
      // Só os itens lidos: algo adicionado agora fica para a próxima rodada.
      await tx.itemCarrinho.deleteMany({
        where: { id: { in: itens.map((i) => i.id) } },
      });

      const chamado = precisaConfirmar
        ? await this.chamados.criar(tx, {
            restauranteId: p.restauranteId,
            mesaId: p.mesa.id,
            sessaoId: p.sessao.id,
            tipo: 'CONFIRMAR_RODADA',
            rodadaId: rodada.id,
          })
        : null;
      return {
        tipo: 'criada' as const,
        rodada,
        chamado,
        garcomId: sessao.garcomId,
      };
    });

    await this.carrinho.avisar(p);
    if (resultado.tipo === 'esgotou') {
      const { nomes, pratoIds } = resultado;
      throw new ConflictException({
        mensagem: `${nomes.join(', ')} esgotou`,
        pratoIds,
      });
    }

    const { rodada, chamado, garcomId } = resultado;
    const dados = {
      rodadaId: rodada.id,
      sessaoId: p.sessao.id,
      mesaId: p.mesa.id,
      totalCentavos: rodada.totalCentavos,
    };
    await this.eventos.publicar({
      restauranteId: p.restauranteId,
      tipo: 'PedidoCriado',
      dados,
    });
    if (chamado) {
      await this.chamados.depoisDeAbrir(chamado);
    } else {
      await this.eventos.publicar({
        restauranteId: p.restauranteId,
        tipo: 'PedidoConfirmado',
        dados: { ...dados, direto: true, garcomId },
      });
      if (garcomId) this.tempoReal.paraGarcom(garcomId, 'chamados-mudaram', {});
      // Foi direto: a tela da produção precisa buscar já (e tocar o bipe).
      this.tempoReal.paraEquipe(p.restauranteId, 'producao-mudou', {});
    }
    this.tempoReal.paraSessao(p.sessao.id, 'rodadas-mudaram', {});
    this.tempoReal.paraEquipe(p.restauranteId, 'mesa-mudou', {
      numero: p.mesa.numero,
    });
    return paraPublica(rodada);
  }
}

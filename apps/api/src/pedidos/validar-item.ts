import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { COM_OPCOES, NovoItem, PratoComOpcoes } from './pratos';
import { validarSelecao } from './preco';

/**
 * Busca o prato do restaurante e valida esgotado + seleção.
 * Usado pelo carrinho (cliente) e pela edição de rodada (garçom).
 */
export async function pratoValidado(
  prisma: PrismaService,
  restauranteId: string,
  item: Pick<NovoItem, 'pratoId' | 'selecao'>,
): Promise<PratoComOpcoes> {
  const prato = await prisma.prato.findFirst({
    where: { id: item.pratoId, restauranteId },
    include: COM_OPCOES,
  });
  if (!prato) {
    throw new UnprocessableEntityException({
      mensagem: 'Prato não encontrado',
    });
  }
  if (prato.esgotado) {
    throw new UnprocessableEntityException({
      mensagem: `${prato.nome} está esgotado`,
    });
  }
  const erros = validarSelecao(prato, item.selecao);
  if (erros.length > 0) {
    throw new UnprocessableEntityException({ mensagem: erros[0] });
  }
  return prato;
}

export const ITEM_NAO_ENCONTRADO = () =>
  new NotFoundException({ mensagem: 'Item não encontrado' });

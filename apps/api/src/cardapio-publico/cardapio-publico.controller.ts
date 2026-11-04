import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CardapioPublicoService } from './cardapio-publico.service';
import { CardapioPublico } from './cardapio-publico.types';

@Controller('publico/mesas')
export class CardapioPublicoController {
  constructor(private readonly cardapio: CardapioPublicoService) {}

  @Get(':token/cardapio')
  async buscar(@Param('token') token: string): Promise<CardapioPublico> {
    const resultado = await this.cardapio.buscarPorToken(token);
    if (!resultado) {
      throw new NotFoundException({ mensagem: 'Mesa não encontrada' });
    }
    return resultado;
  }
}

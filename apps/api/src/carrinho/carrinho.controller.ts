import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { novoItemSchema, QUANTIDADE_MAXIMA } from '../pedidos/pratos';
import { Dispositivo } from '../sessao-mesa/dispositivo.decorator';
import { SessaoMesaService } from '../sessao-mesa/sessao-mesa.service';
import { CarrinhoService } from './carrinho.service';
import type { CarrinhoPublico } from './carrinho.types';

const quantidadeSchema = z.object({
  quantidade: z.number().int().min(0).max(QUANTIDADE_MAXIMA),
});

@Controller('publico/mesas/:token/carrinho')
export class CarrinhoController {
  constructor(
    private readonly sessoes: SessaoMesaService,
    private readonly carrinho: CarrinhoService,
  ) {}

  @Get()
  async ler(
    @Param('token') token: string,
    @Dispositivo() dispositivo: string | undefined,
  ): Promise<CarrinhoPublico> {
    const p = await this.sessoes.exigirParticipante(token, dispositivo);
    return this.carrinho.ler(p.sessao.id);
  }

  @Post('itens')
  async adicionar(
    @Param('token') token: string,
    @Dispositivo() dispositivo: string | undefined,
    @Body() corpo: unknown,
  ): Promise<CarrinhoPublico> {
    const p = await this.sessoes.exigirParticipante(token, dispositivo);
    return this.carrinho.adicionar(p, lerCorpo(novoItemSchema, corpo));
  }

  @Patch('itens/:id')
  async alterar(
    @Param('token') token: string,
    @Param('id') id: string,
    @Dispositivo() dispositivo: string | undefined,
    @Body() corpo: unknown,
  ): Promise<CarrinhoPublico> {
    const p = await this.sessoes.exigirParticipante(token, dispositivo);
    const { quantidade } = lerCorpo(quantidadeSchema, corpo);
    return this.carrinho.alterarQuantidade(p, id, quantidade);
  }

  @Delete('itens/:id')
  async remover(
    @Param('token') token: string,
    @Param('id') id: string,
    @Dispositivo() dispositivo: string | undefined,
  ): Promise<CarrinhoPublico> {
    const p = await this.sessoes.exigirParticipante(token, dispositivo);
    return this.carrinho.remover(p, id);
  }
}

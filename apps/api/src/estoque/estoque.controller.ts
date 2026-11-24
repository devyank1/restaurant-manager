import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { EstoqueService } from './estoque.service';
import { QUANTIDADE_MAXIMA } from './quantidade';

const inteiro = z.number().int().max(QUANTIDADE_MAXIMA);
const textoOpcional = z.string().trim().max(200).nullish();

const itemSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  unidade: z.enum(['UN', 'G', 'ML']),
  minimo: inteiro.min(0),
  cheio: inteiro.min(0),
  fornecedorId: z.string().uuid().nullish(),
  embalagemNome: z.string().trim().max(40).nullish(),
  embalagemQuantidade: inteiro.min(1).nullish(),
  quantidade: inteiro.min(0).optional(),
});
const edicaoItemSchema = itemSchema.omit({ quantidade: true }).partial();

const linhasSchema = z.object({
  itens: z
    .array(z.object({ itemId: z.string().uuid(), quantidade: inteiro.min(1) }))
    .min(1),
});

const perdaSchema = z.object({
  itemId: z.string().uuid(),
  quantidade: inteiro.min(1),
  motivo: z.enum(['ACIDENTE', 'VALIDADE', 'PREPARO', 'OUTRO']),
  observacao: z.string().max(300).optional(),
});

const fornecedorSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  telefone: z.string().trim().max(30).nullish(),
  observacao: textoOpcional,
});

@Controller('equipe/estoque')
@UseGuards(EquipeGuard)
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  @Get()
  resumo(@UsuarioAtual() usuario: UsuarioToken) {
    return this.estoque.resumo(usuario);
  }

  @Get('itens')
  itens(@UsuarioAtual() usuario: UsuarioToken, @Query('ordem') ordem?: string) {
    return this.estoque.itens(usuario, ordem);
  }

  @Post('itens')
  criarItem(@Body() corpo: unknown, @UsuarioAtual() usuario: UsuarioToken) {
    return this.estoque.criarItem(lerCorpo(itemSchema, corpo), usuario);
  }

  @Patch('itens/:id')
  editarItem(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    return this.estoque.editarItem(
      id,
      lerCorpo(edicaoItemSchema, corpo),
      usuario,
    );
  }

  @Delete('itens/:id')
  @HttpCode(204)
  arquivarItem(@Param('id') id: string, @UsuarioAtual() usuario: UsuarioToken) {
    return this.estoque.arquivarItem(id, usuario);
  }

  @Get('itens/:id/movimentos')
  movimentos(@Param('id') id: string, @UsuarioAtual() usuario: UsuarioToken) {
    return this.estoque.movimentos(id, usuario);
  }

  @Post('itens/:id/contagem')
  @HttpCode(200)
  contar(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    const { quantidade } = lerCorpo(
      z.object({ quantidade: inteiro.min(0) }),
      corpo,
    );
    return this.estoque.contar(id, quantidade, usuario);
  }

  @Post('entradas')
  @HttpCode(200)
  entrada(@Body() corpo: unknown, @UsuarioAtual() usuario: UsuarioToken) {
    return this.estoque.entrada(lerCorpo(linhasSchema, corpo).itens, usuario);
  }

  @Post('perdas')
  @HttpCode(200)
  perda(@Body() corpo: unknown, @UsuarioAtual() usuario: UsuarioToken) {
    return this.estoque.perda(lerCorpo(perdaSchema, corpo), usuario);
  }

  @Get('desfazer')
  async desfazivel(@UsuarioAtual() usuario: UsuarioToken) {
    return { desfazivel: await this.estoque.desfazivel(usuario) };
  }

  @Post('desfazer')
  @HttpCode(200)
  async desfazer(@UsuarioAtual() usuario: UsuarioToken) {
    await this.estoque.desfazer(usuario);
    return {};
  }

  @Get('fornecedores')
  fornecedores(@UsuarioAtual() usuario: UsuarioToken) {
    return this.estoque.fornecedores(usuario);
  }

  @Post('fornecedores')
  criarFornecedor(
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    return this.estoque.criarFornecedor(
      lerCorpo(fornecedorSchema, corpo),
      usuario,
    );
  }

  @Patch('fornecedores/:id')
  editarFornecedor(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    return this.estoque.editarFornecedor(
      id,
      lerCorpo(fornecedorSchema.partial(), corpo),
      usuario,
    );
  }

  @Delete('fornecedores/:id')
  @HttpCode(204)
  excluirFornecedor(
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioToken,
  ) {
    return this.estoque.excluirFornecedor(id, usuario);
  }
}

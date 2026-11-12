import { Injectable, NotFoundException } from '@nestjs/common';
import { exigirDono } from '../equipe/papel';
import type { UsuarioToken } from '../equipe/equipe.types';
import { PrismaService } from '../prisma/prisma.service';

export type TemposCardapio = {
  categorias: {
    id: string;
    nome: string;
    estacao: string;
    tempoPreparoMin: number | null;
    pratos: { id: string; nome: string; tempoPreparoMin: number | null }[];
  }[];
};

/** Tempo de preparo esperado: padrão da categoria e tempo de cada prato. */
@Injectable()
export class TemposService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuario: UsuarioToken): Promise<TemposCardapio> {
    exigirDono(usuario);
    const categorias = await this.prisma.categoria.findMany({
      where: { restauranteId: usuario.restauranteId },
      orderBy: { ordem: 'asc' },
      include: { pratos: { orderBy: { ordem: 'asc' } } },
    });
    return {
      categorias: categorias.map((c) => ({
        id: c.id,
        nome: c.nome,
        estacao: c.estacao,
        tempoPreparoMin: c.tempoPreparoMin,
        pratos: c.pratos.map((p) => ({
          id: p.id,
          nome: p.nome,
          tempoPreparoMin: p.tempoPreparoMin,
        })),
      })),
    };
  }

  async mudarCategoria(
    id: string,
    tempoPreparoMin: number | null,
    usuario: UsuarioToken,
  ) {
    exigirDono(usuario);
    const { count } = await this.prisma.categoria.updateMany({
      where: { id, restauranteId: usuario.restauranteId },
      data: { tempoPreparoMin },
    });
    if (count === 0) {
      throw new NotFoundException({ mensagem: 'Categoria não encontrada' });
    }
    return { id, tempoPreparoMin };
  }

  async mudarPrato(
    id: string,
    tempoPreparoMin: number | null,
    usuario: UsuarioToken,
  ) {
    exigirDono(usuario);
    const { count } = await this.prisma.prato.updateMany({
      where: { id, restauranteId: usuario.restauranteId },
      data: { tempoPreparoMin },
    });
    if (count === 0) {
      throw new NotFoundException({ mensagem: 'Prato não encontrado' });
    }
    return { id, tempoPreparoMin };
  }
}

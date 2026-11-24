import { Injectable } from '@nestjs/common';
import type { UsuarioToken } from '../equipe/equipe.types';
import { exigirDono } from '../equipe/papel';
import { PrismaService } from '../prisma/prisma.service';
import { LIMITES_PADRAO, type LimitesAlerta, type TipoAlerta } from './alertas';

/** Limites de alerta do restaurante: padrões mesclados com o que o gerente gravou. */
@Injectable()
export class LimitesService {
  constructor(private readonly prisma: PrismaService) {}

  async ler(restauranteId: string): Promise<LimitesAlerta> {
    const linhas = await this.prisma.limiteAlerta.findMany({
      where: { restauranteId },
    });
    const limites = structuredClone(LIMITES_PADRAO);
    for (const l of linhas) {
      const tipo = l.tipo as TipoAlerta;
      if (!(tipo in limites)) continue;
      limites[tipo] = {
        ativo: l.ativo,
        valor: l.valor ?? limites[tipo].valor,
      };
    }
    return limites;
  }

  async gravar(
    usuario: UsuarioToken,
    tipo: TipoAlerta,
    v: { ativo: boolean; valor: number | null },
  ): Promise<LimitesAlerta> {
    exigirDono(usuario);
    const restauranteId = usuario.restauranteId;
    await this.prisma.limiteAlerta.upsert({
      where: { restauranteId_tipo: { restauranteId, tipo } },
      create: { restauranteId, tipo, ativo: v.ativo, valor: v.valor },
      update: { ativo: v.ativo, valor: v.valor },
    });
    return this.ler(restauranteId);
  }
}

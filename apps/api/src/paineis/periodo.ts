import type { PeriodoMeta } from '@prisma/client';
import {
  inicioDaSemanaDeServico,
  inicioDoDiaDeServico,
} from '../comum/dia-servico';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Dia ou semana de serviço que contém `agora` (fim exclusivo). */
export function periodoDe(
  periodo: PeriodoMeta,
  agora: Date,
): { inicio: Date; fim: Date } {
  const inicio =
    periodo === 'DIA'
      ? inicioDoDiaDeServico(agora)
      : inicioDaSemanaDeServico(agora);
  const dias = periodo === 'DIA' ? 1 : 7;
  return { inicio, fim: new Date(inicio.getTime() + dias * DIA_MS) };
}

import type { PeriodoMeta, TipoMeta } from '@prisma/client';

export type ProgressoMeta = {
  tipo: TipoMeta;
  periodo: PeriodoMeta;
  alvo: number;
  atual: number;
  batida: boolean;
  /** 0 a 100, para a barra. */
  pct: number;
};

export function progresso(
  meta: { tipo: TipoMeta; periodo: PeriodoMeta; alvo: number },
  atual: number,
): ProgressoMeta {
  if (meta.tipo === 'ESQUECIDOS') {
    const batida = atual === 0;
    return { ...meta, atual, batida, pct: batida ? 100 : 0 };
  }
  const batida = atual >= meta.alvo;
  const pct =
    meta.alvo > 0 ? Math.min(100, Math.round((100 * atual) / meta.alvo)) : 100;
  return { ...meta, atual, batida, pct };
}

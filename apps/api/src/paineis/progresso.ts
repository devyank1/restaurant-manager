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
  {
    tipo,
    periodo,
    alvo,
  }: { tipo: TipoMeta; periodo: PeriodoMeta; alvo: number },
  atual: number,
): ProgressoMeta {
  // Só os três campos: a linha da Meta tem ids que não vão para a tela.
  const meta = { tipo, periodo, alvo };
  if (meta.tipo === 'ESQUECIDOS') {
    const batida = atual === 0;
    return { ...meta, atual, batida, pct: batida ? 100 : 0 };
  }
  const batida = atual >= meta.alvo;
  const pct =
    meta.alvo > 0 ? Math.min(100, Math.round((100 * atual) / meta.alvo)) : 100;
  return { ...meta, atual, batida, pct };
}

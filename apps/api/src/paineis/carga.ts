// Medidas de carga de garçom e de estação [spec §4.3]. Só números e faixa; nunca ranking.

import { MESAS_A_MAIS } from './cuidado';

export type FaixaCarga = 'TRANQUILO' | 'CHEIO' | 'SOBRECARREGADO';

/** Chamado pendente pesa como duas mesas [nossa decisão]. */
const PESO_CHAMADO = 2;
/** Carga mínima para sobrecarga quando há colegas para comparar. */
const CARGA_MINIMA_SOBRECARGA = 8;
/** Tetos fixos quando não há colegas no turno. */
const TETO_TRANQUILO_SOLO = 4;
const TETO_CHEIO_SOLO = 8;

export function cargaGarcom(g: {
  mesasAbertas: number;
  chamadosPendentes: number;
}): number {
  return g.mesasAbertas + g.chamadosPendentes * PESO_CHAMADO;
}

export function cargaEstacao(e: { naFila: number; emPreparo: number }): number {
  return e.naFila + e.emPreparo;
}

export function faixaDeCarga(
  carga: number,
  cargasColegas: number[],
): FaixaCarga {
  if (cargasColegas.length === 0) {
    if (carga <= TETO_TRANQUILO_SOLO) return 'TRANQUILO';
    if (carga <= TETO_CHEIO_SOLO) return 'CHEIO';
    return 'SOBRECARREGADO';
  }
  const media =
    cargasColegas.reduce((soma, c) => soma + c, 0) / cargasColegas.length;
  if (carga > media + MESAS_A_MAIS && carga >= CARGA_MINIMA_SOBRECARGA) {
    return 'SOBRECARREGADO';
  }
  if (carga > media) return 'CHEIO';
  return 'TRANQUILO';
}

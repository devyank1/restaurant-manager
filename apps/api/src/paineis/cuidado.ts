// Avisos de cuidado no cartão da pessoa [spec §4.3]. Nunca ranking.

const HORA_MS = 3_600_000;
/** "Bem mais mesas": passa da média dos colegas + 3 [nossa decisão]. */
export const MESAS_A_MAIS = 3;

export function avisosDeCuidado(
  p: {
    emTurnoDesde: Date | null;
    horasSemPausa: number;
    mesasHoje: number;
    mediaColegas: number | null;
  },
  agora: Date,
): string[] {
  const avisos: string[] = [];
  if (p.emTurnoDesde) {
    const h = Math.floor(
      (agora.getTime() - p.emTurnoDesde.getTime()) / HORA_MS,
    );
    if (h >= p.horasSemPausa) avisos.push(`${h} h em turno sem pausa`);
  }
  if (p.mediaColegas !== null && p.mesasHoje > p.mediaColegas + MESAS_A_MAIS) {
    avisos.push('Pegou bem mais mesas que os colegas');
  }
  return avisos;
}

/** Prato e categoria sem tempo cadastrado [spec §4.1]. */
export const TEMPO_PADRAO_MIN = 15;

/** Tempo esperado de preparo: o do prato, senão o padrão da categoria, senão 15. */
export function tempoEsperadoDe(prato: {
  tempoPreparoMin: number | null;
  categoria: { tempoPreparoMin: number | null };
}): number {
  return (
    prato.tempoPreparoMin ?? prato.categoria.tempoPreparoMin ?? TEMPO_PADRAO_MIN
  );
}

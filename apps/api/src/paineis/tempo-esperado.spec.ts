import { TEMPO_PADRAO_MIN, tempoEsperadoDe } from './tempo-esperado';

describe('tempoEsperadoDe', () => {
  it('prato vence categoria, categoria vence o padrão de 15', () => {
    expect(
      tempoEsperadoDe({
        tempoPreparoMin: 25,
        categoria: { tempoPreparoMin: 12 },
      }),
    ).toBe(25);
    expect(
      tempoEsperadoDe({
        tempoPreparoMin: null,
        categoria: { tempoPreparoMin: 12 },
      }),
    ).toBe(12);
    expect(
      tempoEsperadoDe({
        tempoPreparoMin: null,
        categoria: { tempoPreparoMin: null },
      }),
    ).toBe(15);
    expect(TEMPO_PADRAO_MIN).toBe(15);
  });
});

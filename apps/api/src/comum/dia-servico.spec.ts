import { inicioDoDiaDeServico } from './dia-servico';

describe('inicioDoDiaDeServico', () => {
  it('03:00 de sábado em SP ainda é sexta', () => {
    expect(
      inicioDoDiaDeServico(new Date('2026-11-14T06:00:00Z')).toISOString(),
    ).toBe('2026-11-13T08:00:00.000Z');
  });
  it('05:00 em SP começa o dia', () => {
    expect(
      inicioDoDiaDeServico(new Date('2026-11-14T08:00:00Z')).toISOString(),
    ).toBe('2026-11-14T08:00:00.000Z');
  });
  it('virada de mês', () => {
    expect(
      inicioDoDiaDeServico(new Date('2026-12-01T03:00:00Z')).toISOString(),
    ).toBe('2026-11-30T08:00:00.000Z');
  });
});

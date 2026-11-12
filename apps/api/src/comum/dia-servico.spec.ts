import { inicioDaSemanaDeServico, inicioDoDiaDeServico } from './dia-servico';

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

describe('inicioDaSemanaDeServico', () => {
  it('semana começa segunda 05:00 em SP', () => {
    // domingo 08/11 01:00 SP (04:00Z) → semana que começou segunda 02/11 05:00 SP (08:00Z)
    expect(
      inicioDaSemanaDeServico(new Date('2026-11-08T04:00:00Z')).toISOString(),
    ).toBe('2026-11-02T08:00:00.000Z');
    // segunda 04:59 SP ainda é a semana anterior
    expect(
      inicioDaSemanaDeServico(new Date('2026-11-09T07:59:00Z')).toISOString(),
    ).toBe('2026-11-02T08:00:00.000Z');
    expect(
      inicioDaSemanaDeServico(new Date('2026-11-09T08:00:00Z')).toISOString(),
    ).toBe('2026-11-09T08:00:00.000Z');
  });
  it('quarta à noite volta para a segunda', () => {
    expect(
      inicioDaSemanaDeServico(new Date('2026-11-12T01:00:00Z')).toISOString(),
    ).toBe('2026-11-09T08:00:00.000Z');
  });
});

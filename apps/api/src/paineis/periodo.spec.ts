import { periodoDe } from './periodo';

describe('periodoDe', () => {
  it('venda sábado 01:00 conta na sexta', () => {
    const p = periodoDe('DIA', new Date('2026-11-07T04:00:00Z'));
    expect(p.inicio.toISOString()).toBe('2026-11-06T08:00:00.000Z');
    expect(p.fim.toISOString()).toBe('2026-11-07T08:00:00.000Z');
  });
  it('semana vai de segunda a segunda', () => {
    const p = periodoDe('SEMANA', new Date('2026-11-12T01:00:00Z'));
    expect(p.inicio.toISOString()).toBe('2026-11-09T08:00:00.000Z');
    expect(p.fim.toISOString()).toBe('2026-11-16T08:00:00.000Z');
  });
});

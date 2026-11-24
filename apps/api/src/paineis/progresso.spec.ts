import { progresso } from './progresso';

describe('progresso', () => {
  it('abaixo do alvo não está batida e pct proporcional', () => {
    expect(
      progresso({ tipo: 'VALOR', periodo: 'DIA', alvo: 2000 }, 1200),
    ).toEqual({
      tipo: 'VALOR',
      periodo: 'DIA',
      alvo: 2000,
      atual: 1200,
      batida: false,
      pct: 60,
    });
  });

  it('acima do alvo pct limita em 100', () => {
    expect(
      progresso({ tipo: 'MESAS', periodo: 'SEMANA', alvo: 10 }, 13),
    ).toMatchObject({ batida: true, pct: 100 });
  });

  it('no alvo está batida', () => {
    expect(
      progresso({ tipo: 'NO_TEMPO', periodo: 'DIA', alvo: 85 }, 85),
    ).toMatchObject({ batida: true, pct: 100 });
  });

  it('esquecidos: 0 bate, 1 não', () => {
    expect(
      progresso({ tipo: 'ESQUECIDOS', periodo: 'DIA', alvo: 0 }, 0),
    ).toMatchObject({ batida: true, pct: 100 });
    expect(
      progresso({ tipo: 'ESQUECIDOS', periodo: 'DIA', alvo: 0 }, 1),
    ).toMatchObject({ batida: false, pct: 0 });
  });
});

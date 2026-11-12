import { avisosDeCuidado } from './cuidado';

const agora = new Date('2026-11-10T23:00:00Z');
const horasAtras = (h: number) => new Date(agora.getTime() - h * 3_600_000);

describe('avisosDeCuidado', () => {
  it('5 h sem pausa com limite 4 avisa', () => {
    expect(
      avisosDeCuidado(
        {
          emTurnoDesde: horasAtras(5.5),
          horasSemPausa: 4,
          mesasHoje: 0,
          mediaColegas: null,
        },
        agora,
      ),
    ).toEqual(['5 h em turno sem pausa']);
  });

  it('3 h com limite 4 não avisa', () => {
    expect(
      avisosDeCuidado(
        {
          emTurnoDesde: horasAtras(3),
          horasSemPausa: 4,
          mesasHoje: 0,
          mediaColegas: null,
        },
        agora,
      ),
    ).toEqual([]);
  });

  it('fora do turno não avisa pausa', () => {
    expect(
      avisosDeCuidado(
        {
          emTurnoDesde: null,
          horasSemPausa: 4,
          mesasHoje: 0,
          mediaColegas: null,
        },
        agora,
      ),
    ).toEqual([]);
  });

  it('média 2, ele 6 → bem mais mesas; ele 5 → não', () => {
    const base = { emTurnoDesde: null, horasSemPausa: 4, mediaColegas: 2 };
    expect(avisosDeCuidado({ ...base, mesasHoje: 6 }, agora)).toEqual([
      'Pegou bem mais mesas que os colegas',
    ]);
    expect(avisosDeCuidado({ ...base, mesasHoje: 5 }, agora)).toEqual([]);
  });

  it('sem colegas no dia não compara', () => {
    expect(
      avisosDeCuidado(
        {
          emTurnoDesde: null,
          horasSemPausa: 4,
          mesasHoje: 20,
          mediaColegas: null,
        },
        agora,
      ),
    ).toEqual([]);
  });
});

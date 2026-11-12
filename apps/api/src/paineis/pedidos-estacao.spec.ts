import { ItemMedido, medirPedidos } from './pedidos-estacao';

const T0 = new Date('2026-11-10T23:00:00Z'); // 20:00 em SP
const min = (m: number) => new Date(T0.getTime() + m * 60_000);
const item = (p: Partial<ItemMedido>): ItemMedido => ({
  rodadaId: 'r1',
  estacao: 'Cozinha',
  confirmadaEm: T0,
  tempoEsperadoMin: 20,
  prontoEm: null,
  mesa: 7,
  ...p,
});

describe('medirPedidos', () => {
  it('pronto em 22 min está no tempo; em 23 não', () => {
    const [m] = medirPedidos(
      [
        item({ prontoEm: min(22) }),
        item({ rodadaId: 'r2', prontoEm: min(23) }),
      ],
      min(60),
    );
    expect(m).toMatchObject({
      estacao: 'Cozinha',
      pedidos: 2,
      avaliados: 2,
      noTempo: 1,
      noTempoPct: 50,
      mediaMin: 23,
      esquecidos: [],
    });
  });

  it('rodada com 2 pratos usa o maior esperado da estação', () => {
    const [m] = medirPedidos(
      [
        item({ tempoEsperadoMin: 10, prontoEm: min(8) }),
        item({ tempoEsperadoMin: 30, prontoEm: min(25) }),
      ],
      min(60),
    );
    expect(m).toMatchObject({ pedidos: 1, noTempo: 1, noTempoPct: 100 });
  });

  it('só fica pronto quando todos os itens da estação ficam', () => {
    const [m] = medirPedidos(
      [item({ prontoEm: min(5) }), item({ prontoEm: null })],
      min(10),
    );
    expect(m).toMatchObject({ pedidos: 1, avaliados: 0, mediaMin: null });
  });

  it('em andamento antes do prazo não entra no %', () => {
    const [m] = medirPedidos([item({})], min(10));
    expect(m).toMatchObject({
      pedidos: 1,
      avaliados: 0,
      noTempoPct: null,
      esquecidos: [],
    });
  });

  it('em andamento há 41 min com esperado 20 é esquecido', () => {
    const [m] = medirPedidos([item({})], min(41));
    expect(m).toMatchObject({ avaliados: 1, noTempo: 0, noTempoPct: 0 });
    expect(m.esquecidos).toEqual([{ rodadaId: 'r1', mesa: 7, minutos: 41 }]);
  });

  it('pronto depois do dobro também é esquecido', () => {
    const [m] = medirPedidos([item({ prontoEm: min(45) })], min(60));
    expect(m.esquecidos).toEqual([{ rodadaId: 'r1', mesa: 7, minutos: 45 }]);
    expect(m.noTempo).toBe(0);
  });

  it('estações separadas na mesma rodada, em ordem alfabética', () => {
    const r = medirPedidos(
      [
        item({ prontoEm: min(5) }),
        item({ estacao: 'Bar', tempoEsperadoMin: 5, prontoEm: min(30) }),
      ],
      min(60),
    );
    expect(r.map((m) => [m.estacao, m.noTempo])).toEqual([
      ['Bar', 0],
      ['Cozinha', 1],
    ]);
  });

  it('sem itens devolve lista vazia', () => {
    expect(medirPedidos([], min(0))).toEqual([]);
  });
});

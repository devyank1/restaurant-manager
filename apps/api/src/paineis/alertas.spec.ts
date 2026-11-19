import {
  calcularAlertas,
  EntradaAlertas,
  LIMITES_PADRAO,
  LimitesAlerta,
} from './alertas';

const agora = new Date('2026-11-10T23:00:00Z');
const minAtras = (m: number) => new Date(agora.getTime() - m * 60_000);

function entrada(parcial: Partial<EntradaAlertas> = {}): EntradaAlertas {
  return {
    agora,
    mesas: [],
    chamados: [],
    pedidos: [],
    filas: [],
    garcons: [],
    horasSemPausa: 4,
    estoqueCritico: [],
    movimento: { ultimaHora: 0, mediaHistorica: null, semanasComDados: 0 },
    mesasAbertasTotal: 0,
    ...parcial,
  };
}

const garcom = (id: string, nome: string, mesasAbertas: number) => ({
  id,
  nome,
  emTurnoDesde: null,
  mesasAbertas,
  chamadosPendentes: 0,
});

const calcular = (e: EntradaAlertas, limites: LimitesAlerta = LIMITES_PADRAO) =>
  calcularAlertas(e, limites);

describe('calcularAlertas', () => {
  it('entrada toda vazia devolve []', () => {
    expect(calcular(entrada())).toEqual([]);
  });

  it('mesa parada há 11 min gera MESA_SEM_ATENDIMENTO MEDIA', () => {
    const ultimaAtividade = minAtras(11);
    const r = calcular(
      entrada({
        mesas: [
          {
            sessaoId: 's1',
            numero: 4,
            ultimaAtividade,
            temProblemaMaior: false,
          },
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      chave: 'MESA_SEM_ATENDIMENTO:s1',
      tipo: 'MESA_SEM_ATENDIMENTO',
      gravidade: 'MEDIA',
      desde: ultimaAtividade,
    });
  });

  it('mesa parada há 9 min não gera', () => {
    expect(
      calcular(
        entrada({
          mesas: [
            {
              sessaoId: 's1',
              numero: 4,
              ultimaAtividade: minAtras(9),
              temProblemaMaior: false,
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('mesa com problema maior não gera', () => {
    expect(
      calcular(
        entrada({
          mesas: [
            {
              sessaoId: 's1',
              numero: 4,
              ultimaAtividade: minAtras(30),
              temProblemaMaior: true,
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('chamado aberto há 4 min gera CHAMADO_SEM_RESPOSTA ALTA', () => {
    const r = calcular(
      entrada({
        chamados: [
          {
            id: 'c1',
            mesa: 3,
            garcomId: 'g1',
            paraTodos: false,
            criadoEm: minAtras(4),
          },
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      chave: 'CHAMADO_SEM_RESPOSTA:c1',
      tipo: 'CHAMADO_SEM_RESPOSTA',
      gravidade: 'ALTA',
    });
  });

  it('chamado há 2 min não gera', () => {
    expect(
      calcular(
        entrada({
          chamados: [
            {
              id: 'c1',
              mesa: 3,
              garcomId: 'g1',
              paraTodos: false,
              criadoEm: minAtras(2),
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('chamado para todos há 4 min gera só CHAMADO_PARA_TODOS', () => {
    const r = calcular(
      entrada({
        chamados: [
          {
            id: 'c1',
            mesa: 3,
            garcomId: null,
            paraTodos: true,
            criadoEm: minAtras(4),
          },
        ],
      }),
    );
    expect(r.map((a) => a.tipo)).toEqual(['CHAMADO_PARA_TODOS']);
  });

  const pedido = (min: number) =>
    entrada({
      pedidos: [
        {
          rodadaId: 'r1',
          estacao: 'Cozinha',
          mesa: 5,
          confirmadaEm: minAtras(min),
          esperadoMin: 10,
        },
      ],
    });

  it('pedido com 12 min (esperado 10) gera PEDIDO_ATRASADO MEDIA', () => {
    const r = calcular(pedido(12));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      chave: 'PEDIDO_ATRASADO:r1:Cozinha',
      tipo: 'PEDIDO_ATRASADO',
      gravidade: 'MEDIA',
    });
  });

  it('pedido com 21 min gera só PEDIDO_ESQUECIDO ALTA', () => {
    const r = calcular(pedido(21));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      chave: 'PEDIDO_ESQUECIDO:r1:Cozinha',
      tipo: 'PEDIDO_ESQUECIDO',
      gravidade: 'ALTA',
    });
  });

  it('pedido com 10 min não gera', () => {
    expect(calcular(pedido(10))).toEqual([]);
  });

  it('com PEDIDO_ESQUECIDO desativado, pedido esquecido não gera nada', () => {
    const limites: LimitesAlerta = {
      ...LIMITES_PADRAO,
      PEDIDO_ESQUECIDO: { ativo: false, valor: null },
    };
    expect(calcular(pedido(21), limites)).toEqual([]);
  });

  it('fila com 7 gera FILA_ACUMULADA MEDIA; com 6 não', () => {
    const r = calcular(entrada({ filas: [{ estacao: 'Bar', naFila: 7 }] }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      chave: 'FILA_ACUMULADA:Bar',
      tipo: 'FILA_ACUMULADA',
      gravidade: 'MEDIA',
    });
    expect(
      calcular(entrada({ filas: [{ estacao: 'Bar', naFila: 6 }] })),
    ).toEqual([]);
  });

  it('garçom com bem mais mesas que os colegas gera GARCOM_CARGA_ALTA', () => {
    const r = calcular(
      entrada({
        garcons: [
          garcom('g1', 'Ana', 9),
          garcom('g2', 'Bruno', 2),
          garcom('g3', 'Caio', 2),
        ],
        mesasAbertasTotal: 13,
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      chave: 'GARCOM_CARGA_ALTA:g1',
      tipo: 'GARCOM_CARGA_ALTA',
      link: '/central/garcom/g1',
    });
    expect(r[0].detalhe).toContain('Ana');
  });

  it('com um só garçom não gera carga alta', () => {
    expect(
      calcular(
        entrada({ garcons: [garcom('g1', 'Ana', 9)], mesasAbertasTotal: 9 }),
      ),
    ).toEqual([]);
  });

  it('5 h em turno com limite de 4 h gera GARCOM_SEM_PAUSA BAIXA', () => {
    const emTurnoDesde = new Date(agora.getTime() - 5 * 3_600_000);
    const r = calcular(
      entrada({
        garcons: [{ ...garcom('g1', 'Ana', 1), emTurnoDesde }],
        mesasAbertasTotal: 1,
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      chave: 'GARCOM_SEM_PAUSA:g1',
      tipo: 'GARCOM_SEM_PAUSA',
      gravidade: 'BAIXA',
      desde: emTurnoDesde,
    });
  });

  it('estoque crítico gera MEDIA; ALTA se algum zerado', () => {
    const medio = calcular(
      entrada({ estoqueCritico: [{ id: 'i1', nome: 'Limão', zerado: false }] }),
    );
    expect(medio).toHaveLength(1);
    expect(medio[0]).toMatchObject({
      chave: 'ESTOQUE_CRITICO',
      tipo: 'ESTOQUE_CRITICO',
      gravidade: 'MEDIA',
    });
    const alto = calcular(
      entrada({
        estoqueCritico: [
          { id: 'i1', nome: 'Limão', zerado: false },
          { id: 'i2', nome: 'Gelo', zerado: true },
        ],
      }),
    );
    expect(alto[0].gravidade).toBe('ALTA');
  });

  it('mesas abertas sem garçom em turno gera SEM_GARCOM ALTA', () => {
    const r = calcular(entrada({ mesasAbertasTotal: 3 }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      chave: 'SEM_GARCOM',
      tipo: 'SEM_GARCOM',
      gravidade: 'ALTA',
    });
  });

  it('sem mesas abertas e sem garçom não gera', () => {
    expect(calcular(entrada({ mesasAbertasTotal: 0 }))).toEqual([]);
  });

  describe('movimento', () => {
    const mov = (
      ultimaHora: number,
      mediaHistorica: number | null,
      semanasComDados: number,
    ) =>
      entrada({ movimento: { ultimaHora, mediaHistorica, semanasComDados } });

    it('15 contra média 10 gera MOVIMENTO_ALTO BAIXA', () => {
      const r = calcular(mov(15, 10, 2));
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({
        chave: 'MOVIMENTO_ALTO',
        tipo: 'MOVIMENTO_ALTO',
        gravidade: 'BAIXA',
      });
    });

    it('9 contra média 10 não gera', () => {
      expect(calcular(mov(9, 10, 2))).toEqual([]);
    });

    it('3 contra média 2 (150%) não gera: abaixo de 10 pedidos', () => {
      expect(calcular(mov(3, 2, 2))).toEqual([]);
    });

    it('10 contra média 7 (>= 140%) gera', () => {
      expect(calcular(mov(10, 7, 2)).map((a) => a.tipo)).toEqual([
        'MOVIMENTO_ALTO',
      ]);
    });

    it('sem semanas com dados não gera', () => {
      expect(calcular(mov(15, 10, 0))).toEqual([]);
    });

    it('sem média histórica não gera', () => {
      expect(calcular(mov(15, null, 2))).toEqual([]);
    });
  });
});

import { consumoDaRodada, type Receitas } from './consumo';

const linha = (itemId: string, quantidade: number) => ({ itemId, quantidade });

function receitasPizza(): Receitas {
  return {
    prato: new Map([
      ['pizza', [linha('massa', 300)]],
      ['chopp', [linha('chopp', 500)]],
    ]),
    opcao: new Map([
      ['G', { multiplicadorPct: 150, grupoId: 'tam', tipoGrupo: 'UNICA' as const }],
      ['M', { multiplicadorPct: 100, grupoId: 'tam', tipoGrupo: 'UNICA' as const }],
      ['marg', { multiplicadorPct: 100, grupoId: 'sab', tipoGrupo: 'SABORES' as const }],
      ['cala', { multiplicadorPct: 100, grupoId: 'sab', tipoGrupo: 'SABORES' as const }],
      ['quatro', { multiplicadorPct: 100, grupoId: 'sab', tipoGrupo: 'SABORES' as const }],
      ['bacon', { multiplicadorPct: 100, grupoId: 'adi', tipoGrupo: 'MULTIPLA' as const }],
    ]),
    linhasOpcao: new Map([
      ['marg', [linha('queijo', 200)]],
      ['cala', [linha('calabresa', 150)]],
      ['quatro', [linha('queijo', 100)]],
      ['bacon', [linha('bacon', 50)]],
    ]),
  };
}

const obj = (m: Map<string, number>) => Object.fromEntries(m);

describe('consumoDaRodada', () => {
  it('pizza G meio a meio com bacon, 2 unidades', () => {
    const r = consumoDaRodada(
      [
        {
          pratoId: 'pizza',
          selecao: { tam: ['G'], sab: ['marg', 'cala'], adi: ['bacon'] },
          quantidade: 2,
        },
      ],
      receitasPizza(),
    );
    expect(obj(r)).toEqual({ massa: 900, queijo: 300, calabresa: 225, bacon: 100 });
  });

  it('pizza M só margherita', () => {
    const r = consumoDaRodada(
      [{ pratoId: 'pizza', selecao: { tam: ['M'], sab: ['marg'] }, quantidade: 1 }],
      receitasPizza(),
    );
    expect(obj(r)).toEqual({ massa: 300, queijo: 200 });
  });

  it('duas linhas do mesmo prato somam', () => {
    const r = consumoDaRodada(
      [
        { pratoId: 'chopp', selecao: {}, quantidade: 1 },
        { pratoId: 'chopp', selecao: {}, quantidade: 1 },
      ],
      receitasPizza(),
    );
    expect(obj(r)).toEqual({ chopp: 1000 });
  });

  it('prato sem receita não consome nada', () => {
    const r = consumoDaRodada(
      [{ pratoId: 'mix', selecao: {}, quantidade: 3 }],
      receitasPizza(),
    );
    expect(r.size).toBe(0);
  });

  it('opção que não existe mais é ignorada', () => {
    const r = consumoDaRodada(
      [{ pratoId: 'pizza', selecao: { tam: ['sumiu'], sab: ['marg'] }, quantidade: 1 }],
      receitasPizza(),
    );
    expect(obj(r)).toEqual({ massa: 300, queijo: 200 });
  });

  it('arredonda só no fim', () => {
    const r = consumoDaRodada(
      [
        {
          pratoId: 'pizza',
          selecao: { sab: ['quatro', 'quatro2', 'quatro3'] },
          quantidade: 1,
        },
      ],
      {
        ...receitasPizza(),
        opcao: new Map([
          ['quatro', { multiplicadorPct: 100, grupoId: 'sab', tipoGrupo: 'SABORES' as const }],
          ['quatro2', { multiplicadorPct: 100, grupoId: 'sab', tipoGrupo: 'SABORES' as const }],
          ['quatro3', { multiplicadorPct: 100, grupoId: 'sab', tipoGrupo: 'SABORES' as const }],
        ]),
        linhasOpcao: new Map([
          ['quatro', [linha('queijo', 100)]],
          ['quatro2', [linha('queijo', 100)]],
          ['quatro3', [linha('queijo', 100)]],
        ]),
      },
    );
    expect(obj(r)).toEqual({ massa: 300, queijo: 100 });
  });
});

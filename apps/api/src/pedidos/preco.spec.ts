import {
  PratoComGrupos,
  precoUnitario,
  resumirOpcoes,
  validarSelecao,
} from './preco';

const opcao = (id: string, nome: string, precoCentavos: number) => ({
  id,
  nome,
  precoCentavos,
  precoPromocionalCentavos: null,
});

const mix: PratoComGrupos = {
  nome: 'Mix da Casa',
  precoCentavos: 6990,
  precoPromocionalCentavos: 5990,
  grupos: [],
};

const pizza: PratoComGrupos = {
  nome: 'Pizza Margherita',
  precoCentavos: 0,
  precoPromocionalCentavos: null,
  grupos: [
    {
      id: 'tam',
      nome: 'Tamanho',
      tipo: 'UNICA',
      obrigatorio: true,
      min: 1,
      max: 1,
      opcoes: [
        opcao('p', 'P', 4990),
        opcao('m', 'M', 6990),
        opcao('g', 'G', 8990),
      ],
    },
    {
      id: 'sab',
      nome: 'Sabores',
      tipo: 'SABORES',
      obrigatorio: true,
      min: 1,
      max: 2,
      opcoes: [
        opcao('margherita', 'Margherita', 0),
        opcao('calabresa', 'Calabresa', 0),
        opcao('quatroQueijos', 'Quatro Queijos', 1000),
      ],
    },
    {
      id: 'adic',
      nome: 'Adicionais',
      tipo: 'MULTIPLA',
      obrigatorio: false,
      min: 0,
      max: 3,
      opcoes: [
        opcao('borda', 'Borda recheada', 1200),
        opcao('bacon', 'Bacon', 800),
      ],
    },
  ],
};

const picanha: PratoComGrupos = {
  nome: 'Picanha na Chapa',
  precoCentavos: 9890,
  precoPromocionalCentavos: 8990,
  grupos: [
    {
      id: 'ponto',
      nome: 'Ponto da carne',
      tipo: 'UNICA',
      obrigatorio: true,
      min: 1,
      max: 1,
      opcoes: [opcao('mal', 'Mal passada', 0), opcao('bem', 'Bem passada', 0)],
    },
  ],
};

describe('precoUnitario (mesmas regras do cliente)', () => {
  it('pizza G + meio a meio com Quatro Queijos + borda', () => {
    expect(
      precoUnitario(pizza, {
        tam: ['g'],
        sab: ['margherita', 'quatroQueijos'],
        adic: ['borda'],
      }),
    ).toBe(8990 + 1000 + 1200);
  });

  it('soma tamanho, maior sabor do meio a meio e adicionais', () => {
    expect(
      precoUnitario(pizza, {
        tam: ['m'],
        sab: ['margherita', 'quatroQueijos'],
        adic: ['bacon'],
      }),
    ).toBe(8790);
  });

  it('prato sem opções usa o preço efetivo', () => {
    expect(precoUnitario(mix, {})).toBe(5990);
  });

  it('escolha única sem preço não zera o prato', () => {
    expect(precoUnitario(picanha, { ponto: ['mal'] })).toBe(8990);
  });

  it('promo só vale quando 0 < promo < preço', () => {
    expect(precoUnitario({ ...mix, precoPromocionalCentavos: 7990 }, {})).toBe(
      6990,
    );
    expect(precoUnitario({ ...mix, precoPromocionalCentavos: 0 }, {})).toBe(
      6990,
    );
  });
});

describe('validarSelecao', () => {
  it('exige os grupos obrigatórios', () => {
    expect(validarSelecao(pizza, {})).toEqual([
      'Escolha Tamanho',
      'Escolha Sabores',
    ]);
  });

  it('limita ao máximo do grupo', () => {
    expect(
      validarSelecao(pizza, {
        tam: ['m'],
        sab: ['margherita', 'calabresa', 'quatroQueijos'],
      }),
    ).toEqual(['Escolha até 2 em Sabores']);
  });

  it('aceita seleção válida', () => {
    expect(validarSelecao(pizza, { tam: ['p'], sab: ['margherita'] })).toEqual(
      [],
    );
  });

  it('recusa opção ou grupo que não existe e opção repetida', () => {
    expect(validarSelecao(pizza, { tam: ['xx'], sab: ['margherita'] })).toEqual(
      ['Opção inválida'],
    );
    expect(
      validarSelecao(pizza, { tam: ['p'], sab: ['margherita'], hack: ['a'] }),
    ).toEqual(['Opção inválida']);
    expect(
      validarSelecao(pizza, { tam: ['p'], sab: ['margherita', 'margherita'] }),
    ).toEqual(['Opção inválida']);
  });
});

describe('resumirOpcoes', () => {
  it('junta os grupos com · e os sabores com /', () => {
    expect(
      resumirOpcoes(pizza, {
        tam: ['g'],
        sab: ['margherita', 'quatroQueijos'],
        adic: ['borda'],
      }),
    ).toBe('G · Margherita / Quatro Queijos · Borda recheada');
  });
});

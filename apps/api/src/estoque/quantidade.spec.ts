import { embalagensPara, formatarCompra, formatarQuantidade } from './quantidade';

describe('formatarQuantidade', () => {
  it.each([
    [1500, 'G', '1,5 kg'],
    [800, 'G', '800 g'],
    [2000, 'ML', '2 L'],
    [1250, 'ML', '1,25 L'],
    [30, 'UN', '30 un'],
    [-5, 'UN', '0 (conferir)'],
  ] as const)('%d %s → %s', (base, unidade, texto) => {
    expect(formatarQuantidade(base, unidade)).toBe(texto);
  });
});

describe('compra', () => {
  it('embalagens arredondam para cima', () => {
    expect(embalagensPara(45, 30)).toBe(2);
  });
  it('com embalagem', () => {
    expect(formatarCompra(60, 'UN', { nome: 'Cartela', quantidade: 30 })).toBe(
      '2 Cartela (60 un)',
    );
    expect(formatarCompra(45, 'UN', { nome: 'Cartela', quantidade: 30 })).toBe(
      '2 Cartela (60 un)',
    );
  });
  it('sem embalagem', () => {
    expect(formatarCompra(500, 'G', null)).toBe('500 g');
  });
});

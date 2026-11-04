import { garantirBancoDeTeste } from './banco-teste';

describe('garantirBancoDeTeste', () => {
  it('recusa DATABASE_URL ausente', () => {
    expect(() => garantirBancoDeTeste(undefined)).toThrow(/DATABASE_URL/);
  });

  it('recusa banco que não termina em _test', () => {
    expect(() =>
      garantirBancoDeTeste('postgresql://u:p@localhost:5433/cardapio'),
    ).toThrow(/cardapio_test|_test/);
  });

  it('aceita banco de teste', () => {
    expect(() =>
      garantirBancoDeTeste('postgresql://u:p@localhost:5433/cardapio_test'),
    ).not.toThrow();
  });
});

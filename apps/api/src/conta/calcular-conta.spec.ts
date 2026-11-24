// Mesmos casos de packages/opcoes/src/conta.test.ts: o front mostra, o servidor cobra.
import { calcularConta } from './calcular-conta';

describe('calcularConta', () => {
  it('10% sobre os itens, sem couvert', () => {
    expect(
      calcularConta({
        subtotalCentavos: 5990,
        servico: true,
        couvert: false,
        pessoas: 1,
        couvertUnitarioCentavos: 1500,
      }),
    ).toEqual({
      subtotalCentavos: 5990,
      servicoCentavos: 599,
      couvertCentavos: 0,
      totalCentavos: 6589,
    });
  });

  it('serviço arredonda meio centavo para cima e couvert é por pessoa', () => {
    expect(
      calcularConta({
        subtotalCentavos: 12345,
        servico: true,
        couvert: true,
        pessoas: 3,
        couvertUnitarioCentavos: 1500,
      }),
    ).toEqual({
      subtotalCentavos: 12345,
      servicoCentavos: 1235,
      couvertCentavos: 4500,
      totalCentavos: 18080,
    });
  });

  it('mesa sem consumo pode ter só couvert', () => {
    expect(
      calcularConta({
        subtotalCentavos: 0,
        servico: true,
        couvert: true,
        pessoas: 2,
        couvertUnitarioCentavos: 1500,
      }),
    ).toEqual({
      subtotalCentavos: 0,
      servicoCentavos: 0,
      couvertCentavos: 3000,
      totalCentavos: 3000,
    });
  });

  it('sem serviço e sem couvert o total é o subtotal', () => {
    expect(
      calcularConta({
        subtotalCentavos: 4321,
        servico: false,
        couvert: false,
        pessoas: 4,
        couvertUnitarioCentavos: 1500,
      }).totalCentavos,
    ).toBe(4321);
  });

  it('couvert desmarcado ignora as pessoas', () => {
    expect(
      calcularConta({
        subtotalCentavos: 1000,
        servico: false,
        couvert: false,
        pessoas: 4,
        couvertUnitarioCentavos: 1500,
      }).couvertCentavos,
    ).toBe(0);
  });
});

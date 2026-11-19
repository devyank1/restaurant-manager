import { cargaEstacao, cargaGarcom, faixaDeCarga } from './carga';

describe('cargaGarcom', () => {
  it('mesas + chamados × 2', () => {
    expect(cargaGarcom({ mesasAbertas: 3, chamadosPendentes: 2 })).toBe(7);
  });
});

describe('cargaEstacao', () => {
  it('soma fila e em preparo', () => {
    expect(cargaEstacao({ naFila: 4, emPreparo: 2 })).toBe(6);
  });
});

describe('faixaDeCarga', () => {
  it('sem colegas usa tetos fixos', () => {
    expect(faixaDeCarga(3, [])).toBe('TRANQUILO');
    expect(faixaDeCarga(4, [])).toBe('TRANQUILO');
    expect(faixaDeCarga(6, [])).toBe('CHEIO');
    expect(faixaDeCarga(8, [])).toBe('CHEIO');
    expect(faixaDeCarga(9, [])).toBe('SOBRECARREGADO');
  });

  it('com colegas: acima da média + 3 e >= 8 é sobrecarregado', () => {
    expect(faixaDeCarga(12, [4, 4])).toBe('SOBRECARREGADO');
  });

  it('com colegas: acima da média é cheio', () => {
    expect(faixaDeCarga(6, [4, 4])).toBe('CHEIO');
  });

  it('com colegas: na média ou abaixo é tranquilo', () => {
    expect(faixaDeCarga(3, [4, 4])).toBe('TRANQUILO');
    expect(faixaDeCarga(4, [4, 4])).toBe('TRANQUILO');
  });
});

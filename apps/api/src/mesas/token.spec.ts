import { gerarTokenMesa } from './token';

describe('gerarTokenMesa', () => {
  it('gera token base64url de 22 caracteres', () => {
    expect(gerarTokenMesa()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('não repete em 1000 gerações', () => {
    const tokens = new Set(Array.from({ length: 1000 }, gerarTokenMesa));
    expect(tokens.size).toBe(1000);
  });
});

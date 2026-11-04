import { validarEnv } from './env';

describe('validarEnv', () => {
  it('falha sem DATABASE_URL citando a variável', () => {
    expect(() => validarEnv({})).toThrow(/DATABASE_URL/);
  });

  it('aplica PORT padrão 3000', () => {
    expect(validarEnv({ DATABASE_URL: 'postgresql://x' }).PORT).toBe(3000);
  });

  it('converte PORT string em número', () => {
    expect(
      validarEnv({ DATABASE_URL: 'postgresql://x', PORT: '4000' }).PORT,
    ).toBe(4000);
  });
});

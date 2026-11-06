import { validarEnv } from './env';

const BASE = {
  DATABASE_URL: 'postgresql://x',
  JWT_SEGREDO: 'x'.repeat(32),
};

describe('validarEnv', () => {
  it('falha sem DATABASE_URL citando a variável', () => {
    expect(() => validarEnv({})).toThrow(/DATABASE_URL/);
  });

  it('aplica PORT padrão 3000', () => {
    expect(validarEnv(BASE).PORT).toBe(3000);
  });

  it('converte PORT string em número', () => {
    expect(validarEnv({ ...BASE, PORT: '4000' }).PORT).toBe(4000);
  });

  it('recusa JWT_SEGREDO curto citando a variável', () => {
    expect(() => validarEnv({ ...BASE, JWT_SEGREDO: 'curto' })).toThrow(
      /JWT_SEGREDO/,
    );
  });

  it('verificação de chamados padrão 5000 ms e aceita 0', () => {
    expect(validarEnv(BASE).CHAMADOS_VERIFICAR_MS).toBe(5000);
    expect(
      validarEnv({ ...BASE, CHAMADOS_VERIFICAR_MS: '0' }).CHAMADOS_VERIFICAR_MS,
    ).toBe(0);
  });

  it('VAPID vazio (como no .env.example) conta como ausente', () => {
    const env = validarEnv({ ...BASE, VAPID_PUBLICA: '', VAPID_PRIVADA: '' });
    expect(env.VAPID_PUBLICA).toBeUndefined();
    expect(env.VAPID_PRIVADA).toBeUndefined();
  });
});

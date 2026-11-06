import { conferirSenha, hashSenha } from './senha';

describe('senha', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const hash = await hashSenha('demo1234');
    expect(await conferirSenha('demo1234', hash)).toBe(true);
    expect(await conferirSenha('outra', hash)).toBe(false);
  });

  it('dois hashes da mesma senha são diferentes', async () => {
    expect(await hashSenha('demo1234')).not.toBe(await hashSenha('demo1234'));
  });

  it('hash malformado devolve false, sem exceção', async () => {
    expect(await conferirSenha('demo1234', 'lixo')).toBe(false);
    expect(await conferirSenha('demo1234', 'scrypt$$')).toBe(false);
  });
});

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
) => Promise<Buffer>;

const TAMANHO_HASH = 64;

/** Formato: `scrypt$<sal base64>$<hash base64>`. */
export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(senha, sal, TAMANHO_HASH);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function conferirSenha(
  senha: string,
  guardado: string,
): Promise<boolean> {
  const [algoritmo, salB64, hashB64] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !salB64 || !hashB64) return false;
  const esperado = Buffer.from(hashB64, 'base64');
  if (esperado.length !== TAMANHO_HASH) return false;
  const calculado = await scryptAsync(
    senha,
    Buffer.from(salB64, 'base64'),
    TAMANHO_HASH,
  );
  return timingSafeEqual(calculado, esperado);
}

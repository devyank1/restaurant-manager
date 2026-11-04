import { randomBytes } from 'node:crypto';

export function gerarTokenMesa(): string {
  return randomBytes(16).toString('base64url');
}

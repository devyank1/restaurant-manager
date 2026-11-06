import { randomBytes } from 'node:crypto';

export function gerarTokenMesa(): string {
  return randomBytes(16).toString('base64url');
}

// Tokens reais são base64url de 22 caracteres. Qualquer outra coisa nem vai ao
// banco (o Postgres recusa byte nulo em texto e a consulta estouraria 500).
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;

export function tokenValido(token: string): boolean {
  return FORMATO_TOKEN.test(token);
}

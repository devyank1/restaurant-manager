import { HttpException } from '@nestjs/common';
import { z } from 'zod';

/**
 * Valida o corpo da requisição com zod. Falha → `status` (padrão 422) com
 * `{ mensagem }` (padrão: 'Dados inválidos').
 */
export function lerCorpo<T extends z.ZodType>(
  schema: T,
  corpo: unknown,
  status = 422,
  resposta: { mensagem: string } = { mensagem: 'Dados inválidos' },
): z.infer<T> {
  const resultado = schema.safeParse(corpo);
  if (!resultado.success) throw new HttpException(resposta, status);
  return resultado.data;
}

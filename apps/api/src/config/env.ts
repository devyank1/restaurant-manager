import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

export function validarEnv(raw: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(raw);
  if (!resultado.success) {
    const variaveis = resultado.error.issues
      .map((issue) => issue.path.join('.'))
      .join(', ');
    throw new Error(`Variáveis de ambiente inválidas: ${variaveis}`);
  }
  return resultado.data;
}

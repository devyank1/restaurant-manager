import { z } from 'zod';

// Variável opcional: vazia no .env (ex.: copiada do .env.example) = ausente.
const opcional = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().min(1).optional(),
);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SEGREDO: z.string().min(32),
  // Intervalo da verificação de chamados sem resposta; 0 desliga (testes).
  CHAMADOS_VERIFICAR_MS: z.coerce.number().int().min(0).default(5000),
  CENTRAL_VERIFICAR_MS: z.coerce.number().int().min(0).default(30000),
  // Web Push (gerar com `pnpm vapid`). Sem as três, o push fica desligado.
  VAPID_PUBLICA: opcional,
  VAPID_PRIVADA: opcional,
  VAPID_CONTATO: opcional,
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

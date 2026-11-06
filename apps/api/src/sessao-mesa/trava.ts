import { Prisma } from '@prisma/client';

/**
 * Trava por mesa até o fim da transação (`pg_advisory_xact_lock`).
 * Serializa abrir sessão e enviar rodada da mesma mesa: o Prisma não tem
 * índice único parcial para "uma sessão ABERTA por mesa".
 */
export async function travarMesa(
  tx: Prisma.TransactionClient,
  mesaId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${mesaId}))`;
}

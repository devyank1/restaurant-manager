import { Prisma } from '@prisma/client';
import { z } from 'zod';

/** Include do prato com grupos e opções na ordem do cardápio. */
export const COM_OPCOES = {
  grupos: {
    orderBy: { ordem: 'asc' },
    include: { opcoes: { orderBy: { ordem: 'asc' } } },
  },
  categoria: { select: { estacao: true } },
} satisfies Prisma.PratoInclude;

export type PratoComOpcoes = Prisma.PratoGetPayload<{
  include: typeof COM_OPCOES;
}>;

export const LIMITE_OBSERVACAO = 140;
export const QUANTIDADE_MAXIMA = 20;

export const selecaoSchema = z.record(z.string(), z.array(z.string()).max(20));

/** Corpo para adicionar um item (carrinho ou rodada). */
export const novoItemSchema = z.object({
  pratoId: z.string().max(64),
  selecao: selecaoSchema.default({}),
  observacao: z.string().trim().max(LIMITE_OBSERVACAO).default(''),
  quantidade: z.number().int().min(1).max(QUANTIDADE_MAXIMA),
});

export type NovoItem = z.infer<typeof novoItemSchema>;

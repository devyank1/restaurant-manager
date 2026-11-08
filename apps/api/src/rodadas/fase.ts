import { StatusItem, StatusRodada } from '@prisma/client';

/** Andamento da rodada como o cliente vê; sempre calculado pelos itens. */
export type FaseRodada =
  'AGUARDANDO_GARCOM' | 'NA_COZINHA' | 'PRONTO' | 'ENTREGUE' | 'CANCELADA';

const PRONTOS: StatusItem[] = ['PRONTO', 'ENTREGUE'];

export function faseDa(r: {
  status: StatusRodada;
  itens: { status: StatusItem }[];
}): FaseRodada {
  if (r.status !== 'CONFIRMADA') return r.status;
  if (r.itens.length === 0) return 'NA_COZINHA';
  if (r.itens.every((i) => i.status === 'ENTREGUE')) return 'ENTREGUE';
  if (r.itens.every((i) => PRONTOS.includes(i.status))) return 'PRONTO';
  return 'NA_COZINHA';
}

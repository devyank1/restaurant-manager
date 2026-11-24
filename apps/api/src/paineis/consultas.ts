// Filtros e formatadores compartilhados pelas consultas dos painéis.
import type { Prisma } from '@prisma/client';

export type Intervalo = { inicio: Date; fim: Date };

/** Hora do relógio (0–23) em São Paulo. */
export const horaSP = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  hourCycle: 'h23',
});

export function confirmadasEm(i: Intervalo): Prisma.RodadaWhereInput {
  return {
    status: 'CONFIRMADA',
    confirmadaEm: { gte: i.inicio, lt: i.fim },
  };
}

export function fechadasEm(i: Intervalo): Prisma.SessaoMesaWhereInput {
  return { status: 'FECHADA', fechadaEm: { gte: i.inicio, lt: i.fim } };
}

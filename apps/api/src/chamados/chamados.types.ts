import { StatusChamado, TipoChamado } from '@prisma/client';

export type ChamadoEquipe = {
  id: string;
  tipo: TipoChamado;
  status: StatusChamado;
  mesa: { numero: number; token: string };
  criadoEm: Date;
  paraTodos: boolean;
  tentativas: number;
};

export type NovoChamado = {
  restauranteId: string;
  mesaId: string;
  sessaoId: string;
  tipo: TipoChamado;
  rodadaId?: string;
};

/** Evento interno (não persistido) a cada repasse; a Task 8 manda push. */
export const CHAMADO_REPASSADO = 'chamado.repassado';

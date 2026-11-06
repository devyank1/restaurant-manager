import { Prisma, StatusRodada } from '@prisma/client';

export type ItemRodadaPublico = {
  nome: string;
  resumoOpcoes: string;
  observacao: string;
  quantidade: number;
  precoUnitarioCentavos: number;
};

export type RodadaPublica = {
  id: string;
  status: StatusRodada;
  criadoEm: Date;
  totalCentavos: number;
  itens: ItemRodadaPublico[];
};

export type RodadasDaMesa = {
  rodadas: RodadaPublica[];
  /** Soma só das rodadas CONFIRMADA. */
  totalParcialCentavos: number;
};

export type ItemRodadaEquipe = ItemRodadaPublico & {
  id: string;
  pratoId: string;
  selecao: Record<string, string[]>;
};

export type RodadaEquipe = Omit<RodadaPublica, 'itens'> & {
  /** Celular que ainda não teve rodada confirmada nesta sessão. */
  dispositivoNovo: boolean;
  itens: ItemRodadaEquipe[];
};

export type MesaEquipe = {
  mesa: { numero: number; token: string };
  garcomNome: string | null;
  rodadas: RodadaEquipe[];
  totalConfirmadoCentavos: number;
};

export type MesaResumo = {
  numero: number;
  token: string;
  aberta: boolean;
  garcomNome: string | null;
  /** Rodadas aguardando garçom. */
  pendentes: number;
};

export const COM_ITENS = {
  itens: { orderBy: { id: 'asc' } },
} satisfies Prisma.RodadaInclude;

export type RodadaComItens = Prisma.RodadaGetPayload<{
  include: typeof COM_ITENS;
}>;

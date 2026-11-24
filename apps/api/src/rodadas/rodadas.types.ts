import { Prisma, StatusItem, StatusRodada } from '@prisma/client';
import type { FaseRodada } from './fase';

export type ItemRodadaPublico = {
  nome: string;
  resumoOpcoes: string;
  observacao: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  status: StatusItem;
};

export type RodadaPublica = {
  id: string;
  status: StatusRodada;
  fase: FaseRodada;
  criadoEm: Date;
  totalCentavos: number;
  itens: ItemRodadaPublico[];
};

export type RodadasDaMesa = {
  rodadas: RodadaPublica[];
  /** Soma só das rodadas CONFIRMADA. */
  totalParcialCentavos: number;
  /** Há chamado de atendente não resolvido (aviso "Garçom chamado!"). */
  chamadoAberto: boolean;
};

export type ItemRodadaEquipe = ItemRodadaPublico & {
  id: string;
  pratoId: string;
  selecao: Record<string, string[]>;
  estacao: string;
};

export type RodadaEquipe = Omit<RodadaPublica, 'itens'> & {
  /** Celular que ainda não teve rodada confirmada nesta sessão. */
  dispositivoNovo: boolean;
  /** Rodada que foi direto para a produção: o garçom cancela até esta hora (ISO). */
  cancelavelAte: string | null;
  itens: ItemRodadaEquipe[];
};

/** Opções da conta que o restaurante liga (e se vêm marcadas). */
export type ConfigConta = {
  servico: { habilitado: boolean; padrao: boolean };
  couvert: { habilitado: boolean; padrao: boolean; valorCentavos: number };
};

export type MesaEquipe = {
  mesa: { numero: number; token: string };
  /** Há sessão aberta (dá para fechar a conta). */
  aberta: boolean;
  conta: ConfigConta;
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
  /** Itens prontos esperando o garçom entregar. */
  prontos: number;
};

export const COM_ITENS = {
  itens: { orderBy: { id: 'asc' } },
} satisfies Prisma.RodadaInclude;

export type RodadaComItens = Prisma.RodadaGetPayload<{
  include: typeof COM_ITENS;
}>;

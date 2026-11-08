import { StatusItem } from '@prisma/client';

/** Status que a produção pode dar a um item (ENTREGUE é do garçom). */
export const STATUS_PRODUCAO = ['NA_FILA', 'EM_PREPARO', 'PRONTO'] as const;
export type StatusProducao = (typeof STATUS_PRODUCAO)[number];

/** Evento interno (não persistido): uma estação terminou sua parte da rodada. */
export const ESTACAO_PRONTA = 'producao.estacao-pronta';
export type EstacaoPronta = {
  rodadaId: string;
  estacao: string;
  itens: number;
};

export type ItemProducao = {
  id: string;
  nome: string;
  resumoOpcoes: string;
  observacao: string;
  quantidade: number;
  status: StatusItem;
};

export type PedidoProducao = {
  rodadaId: string;
  mesa: { numero: number };
  garcomNome: string | null;
  confirmadaEm: Date | null;
  cancelada: boolean;
  itens: ItemProducao[];
};

export type FilaProducao = {
  estacoes: string[];
  pedidos: PedidoProducao[];
};

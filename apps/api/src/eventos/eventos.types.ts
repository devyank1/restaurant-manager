export type TipoEvento =
  | 'ChamadoCriado'
  | 'PedidoCriado'
  | 'PedidoConfirmado'
  | 'PedidoCancelado'
  | 'PedidoEmPreparo'
  | 'PedidoPronto'
  | 'PedidoEntregue'
  | 'ContaFechada'
  | 'EstoqueMovimentado'
  | 'EstoqueAcabando'
  | 'PerdaRegistrada';

/** Evento de domínio: persistido em `Evento` e emitido internamente. */
export type EventoDominio = {
  restauranteId: string;
  tipo: TipoEvento;
  dados: Record<string, unknown>;
};

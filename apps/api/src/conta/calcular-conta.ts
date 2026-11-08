// Regra da conta do servidor. Espelha packages/opcoes/src/conta.ts (mesmos
// casos de teste): o app do garçom mostra, o servidor cobra.

export type EntradaConta = {
  subtotalCentavos: number;
  servico: boolean;
  couvert: boolean;
  pessoas: number;
  couvertUnitarioCentavos: number;
};

export type Conta = {
  subtotalCentavos: number;
  servicoCentavos: number;
  couvertCentavos: number;
  totalCentavos: number;
};

/** 10% só sobre os itens; couvert por pessoa. */
export function calcularConta(e: EntradaConta): Conta {
  const servicoCentavos = e.servico ? Math.round(e.subtotalCentavos / 10) : 0;
  const couvertCentavos = e.couvert ? e.couvertUnitarioCentavos * e.pessoas : 0;
  return {
    subtotalCentavos: e.subtotalCentavos,
    servicoCentavos,
    couvertCentavos,
    totalCentavos: e.subtotalCentavos + servicoCentavos + couvertCentavos,
  };
}

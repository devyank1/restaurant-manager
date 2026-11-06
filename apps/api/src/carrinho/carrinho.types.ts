import { Selecao } from '../pedidos/preco';

/** Mesmos campos do ItemCarrinho do app cliente. */
export type ItemCarrinhoPublico = {
  id: string;
  pratoId: string;
  nome: string;
  resumoOpcoes: string;
  selecao: Selecao;
  observacao: string;
  quantidade: number;
  precoUnitarioCentavos: number;
};

export type CarrinhoPublico = {
  itens: ItemCarrinhoPublico[];
  totalCentavos: number;
};

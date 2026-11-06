import type { Selecao } from '../preco/preco'

/** Item do carrinho da mesa como o servidor devolve (preço calculado lá). */
export type ItemCarrinho = {
  id: string
  pratoId: string
  nome: string
  resumoOpcoes: string
  selecao: Selecao
  observacao: string
  quantidade: number
  precoUnitarioCentavos: number
}

export type AcaoCarrinho =
  | { tipo: 'adicionar'; item: Omit<ItemCarrinho, 'id'> }
  | { tipo: 'remover'; id: string }
  | { tipo: 'quantidade'; id: string; quantidade: number }

export function contarItens(itens: ItemCarrinho[]): number {
  return itens.reduce((total, item) => total + item.quantidade, 0)
}

import { useEffect, useReducer } from 'react'
import {
  carregarCarrinho,
  contarItens,
  reduzirCarrinho,
  salvarCarrinho,
  totalCarrinho,
  type AcaoCarrinho,
  type ItemCarrinho,
} from './carrinho'

export function useCarrinho(token: string): {
  itens: ItemCarrinho[]
  despachar: (acao: AcaoCarrinho) => void
  total: number
  quantidade: number
} {
  const [itens, despachar] = useReducer(reduzirCarrinho, token, carregarCarrinho)

  useEffect(() => {
    salvarCarrinho(token, itens)
  }, [token, itens])

  return { itens, despachar, total: totalCarrinho(itens), quantidade: contarItens(itens) }
}

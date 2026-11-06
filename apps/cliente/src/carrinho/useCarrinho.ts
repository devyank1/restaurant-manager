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

/** `pratosDisponiveis`: ids do cardápio atual; itens de pratos removidos são descartados. */
export function useCarrinho(
  token: string,
  pratosDisponiveis?: ReadonlySet<string>,
): {
  itens: ItemCarrinho[]
  despachar: (acao: AcaoCarrinho) => void
  total: number
  quantidade: number
} {
  const [itens, despachar] = useReducer(reduzirCarrinho, token, (t) => {
    const salvos = carregarCarrinho(t)
    return pratosDisponiveis ? salvos.filter((item) => pratosDisponiveis.has(item.pratoId)) : salvos
  })

  useEffect(() => {
    salvarCarrinho(token, itens)
  }, [token, itens])

  return { itens, despachar, total: totalCarrinho(itens), quantidade: contarItens(itens) }
}

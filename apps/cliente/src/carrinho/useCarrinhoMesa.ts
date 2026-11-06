import { useCallback, useEffect, useRef, useState } from 'react'
import { ErroRede } from '../api/cardapio'
import {
  adicionarAoCarrinho,
  alterarQuantidade,
  buscarCarrinho,
  enviarPedido,
  ErroPedido,
  removerDoCarrinho,
} from '../api/mesa'
import type { CarrinhoPublico } from '../api/tipos'
import { contarItens, type AcaoCarrinho, type ItemCarrinho } from './carrinho'

const SEM_CONEXAO = 'Sem conexão. Tente de novo.'
const VAZIO: CarrinhoPublico = { itens: [], totalCentavos: 0 }

function mensagemDe(erro: unknown): string {
  return erro instanceof ErroPedido ? erro.message : SEM_CONEXAO
}

/**
 * Carrinho compartilhado da mesa. O estado vem sempre do servidor
 * (resposta da ação ou evento `carrinho`); nada é calculado aqui.
 * `aoErro` recebe a mensagem de cada recusa (esgotado, sem conexão…).
 */
export function useCarrinhoMesa(
  token: string,
  aoErro?: (mensagem: string) => void,
): {
  itens: ItemCarrinho[]
  total: number
  quantidade: number
  despachar: (acao: AcaoCarrinho) => Promise<boolean>
  enviar: () => Promise<boolean>
  aplicar: (carrinho: CarrinhoPublico) => void
  recarregar: () => void
  erro: string | null
} {
  const [carrinho, setCarrinho] = useState<CarrinhoPublico>(VAZIO)
  const [erro, setErroEstado] = useState<string | null>(null)
  const avisar = useRef(aoErro)
  useEffect(() => {
    avisar.current = aoErro
  })
  const setErro = useCallback((mensagem: string | null) => {
    setErroEstado(mensagem)
    if (mensagem) avisar.current?.(mensagem)
  }, [])

  const recarregar = useCallback(() => {
    buscarCarrinho(token)
      .then(setCarrinho)
      .catch(() => {
        // Sem rede: fica o último carrinho conhecido.
      })
  }, [token])

  useEffect(recarregar, [recarregar])

  /** Roda a ação; em erro mostra a mensagem e busca o carrinho atual. */
  const executar = useCallback(
    async (acao: () => Promise<CarrinhoPublico>): Promise<boolean> => {
      try {
        setCarrinho(await acao())
        setErro(null)
        return true
      } catch (e) {
        setErro(mensagemDe(e))
        if (!(e instanceof ErroRede)) recarregar()
        return false
      }
    },
    [recarregar, setErro],
  )

  const despachar = useCallback(
    (acao: AcaoCarrinho) => {
      switch (acao.tipo) {
        case 'adicionar': {
          const { pratoId, selecao, observacao, quantidade } = acao.item
          return executar(() => adicionarAoCarrinho(token, { pratoId, selecao, observacao, quantidade }))
        }
        case 'quantidade':
          return executar(() => alterarQuantidade(token, acao.id, Math.max(0, acao.quantidade)))
        case 'remover':
          return executar(() => removerDoCarrinho(token, acao.id))
      }
    },
    [executar, token],
  )

  const enviar = useCallback(async () => {
    try {
      await enviarPedido(token)
      setCarrinho(VAZIO)
      setErro(null)
      return true
    } catch (e) {
      setErro(mensagemDe(e))
      recarregar()
      return false
    }
  }, [recarregar, setErro, token])

  return {
    itens: carrinho.itens,
    total: carrinho.totalCentavos,
    quantidade: contarItens(carrinho.itens),
    despachar,
    enviar,
    aplicar: setCarrinho,
    recarregar,
    erro,
  }
}

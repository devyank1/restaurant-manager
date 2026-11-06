import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import type { CarrinhoPublico } from '../api/tipos'

export type AoMudarMesa = {
  /** Com o carrinho do evento, aplica; sem ele, busca de novo. */
  carrinho: (carrinho?: CarrinhoPublico) => void
  rodadas: () => void
  atendido: () => void
}

/**
 * Ouve a mesa em tempo real. Ao reconectar ou voltar para a aba, busca o
 * estado de novo: eventos perdidos com o celular bloqueado não voltam.
 */
export function useMesaAoVivo(token: string, aoMudar: AoMudarMesa): void {
  const atual = useRef(aoMudar)
  useEffect(() => {
    atual.current = aoMudar
  })

  useEffect(() => {
    const recarregar = () => {
      atual.current.carrinho()
      atual.current.rodadas()
    }
    let jaConectou = false
    const socket = io({ transports: ['websocket', 'polling'] })
    socket.on('connect', () => {
      socket.emit('entrar-mesa', { token })
      if (jaConectou) recarregar()
      jaConectou = true
    })
    socket.on('carrinho', (carrinho: CarrinhoPublico) => atual.current.carrinho(carrinho))
    socket.on('rodadas-mudaram', () => atual.current.rodadas())
    socket.on('chamado-atendido', () => atual.current.atendido())

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') recarregar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      socket.disconnect()
    }
  }, [token])
}

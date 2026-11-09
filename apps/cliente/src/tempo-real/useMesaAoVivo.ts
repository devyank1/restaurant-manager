import { useCallback, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import type { CarrinhoPublico } from '../api/tipos'

export type AoMudarMesa = {
  /** Com o carrinho do evento, aplica; sem ele, busca de novo. */
  carrinho: (carrinho?: CarrinhoPublico) => void
  rodadas: () => void
  atendido: () => void
  /** O garçom fechou a conta. */
  contaFechada: () => void
}

/**
 * Ouve a mesa em tempo real. Toda conexão (a primeira e cada reconexão)
 * reentra na sala da mesa e busca o estado: eventos perdidos não voltam.
 *
 * Celular bloqueado derruba a conexão sem o navegador perceber por até ~45 s.
 * Por isso, ao voltar para a aba ou recuperar a rede, a conexão é refeita na
 * hora; ela só completa quando a rede voltou de fato, e aí busca o estado.
 */
export function useMesaAoVivo(token: string, aoMudar: AoMudarMesa): { reentrar: () => void } {
  const atual = useRef(aoMudar)
  const socketAtual = useRef<ReturnType<typeof io> | null>(null)
  useEffect(() => {
    atual.current = aoMudar
  })

  useEffect(() => {
    const recarregar = () => {
      atual.current.carrinho()
      atual.current.rodadas()
    }
    const socket = io({ transports: ['websocket', 'polling'] })
    socketAtual.current = socket
    socket.on('connect', () => {
      socket.emit('entrar-mesa', { token })
      recarregar()
    })
    socket.on('carrinho', (carrinho: CarrinhoPublico) => atual.current.carrinho(carrinho))
    socket.on('rodadas-mudaram', () => atual.current.rodadas())
    socket.on('chamado-atendido', () => atual.current.atendido())
    socket.on('conta-fechada', () => atual.current.contaFechada())

    const reconectar = () => {
      socket.disconnect()
      socket.connect()
    }
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return
      // Busca já (pode falhar se a rede ainda não voltou) e refaz a conexão.
      recarregar()
      reconectar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', reconectar)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', reconectar)
      socket.disconnect()
    }
  }, [token])

  /** Entrou numa sessão nova (conta fechada): passa a ouvir a sala dela. */
  const reentrar = useCallback(() => {
    socketAtual.current?.emit('entrar-mesa', { token })
  }, [token])
  return { reentrar }
}

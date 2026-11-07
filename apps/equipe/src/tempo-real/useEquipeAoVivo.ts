import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

export type AoMudarEquipe = {
  chamados?: () => void
  mesas?: () => void
}

/**
 * Ouve a equipe em tempo real (o cookie `equipe` coloca o socket nas salas
 * do restaurante e do garçom). Eventos só pedem para buscar de novo.
 *
 * Toda conexão (a primeira e cada reconexão) busca o estado: eventos perdidos
 * não voltam. Celular bloqueado deixa a conexão "zumbi"; ao voltar para a aba
 * ou recuperar a rede, a conexão é refeita na hora.
 */
export function useEquipeAoVivo(aoMudar: AoMudarEquipe): void {
  const atual = useRef(aoMudar)
  useEffect(() => {
    atual.current = aoMudar
  })

  useEffect(() => {
    const recarregar = () => {
      atual.current.chamados?.()
      atual.current.mesas?.()
    }
    const socket = io({ transports: ['websocket', 'polling'] })
    socket.on('connect', recarregar)
    socket.on('chamados-mudaram', () => atual.current.chamados?.())
    socket.on('mesa-mudou', () => atual.current.mesas?.())

    const reconectar = () => {
      socket.disconnect()
      socket.connect()
    }
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return
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
  }, [])
}

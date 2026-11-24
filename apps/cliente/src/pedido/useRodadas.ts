import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarRodadas, ErroContaFechada } from '../api/mesa'
import type { RodadasDaMesa } from '../api/tipos'

/**
 * Rodadas já enviadas pela mesa, com o total parcial (só confirmadas).
 * `aoFechar`: a conta já foi fechada (celular que voltou depois do fechamento).
 */
export function useRodadas(token: string, aoFechar?: () => void): RodadasDaMesa & { recarregar: () => void } {
  const [dados, setDados] = useState<RodadasDaMesa>({
    rodadas: [],
    totalParcialCentavos: 0,
    chamadoAberto: false,
  })

  const fechou = useRef(aoFechar)
  useEffect(() => {
    fechou.current = aoFechar
  })

  const recarregar = useCallback(() => {
    buscarRodadas(token)
      .then(setDados)
      .catch((erro: unknown) => {
        if (erro instanceof ErroContaFechada) fechou.current?.()
        // Sem rede: ficam as últimas conhecidas.
      })
  }, [token])

  useEffect(recarregar, [recarregar])

  return { ...dados, recarregar }
}

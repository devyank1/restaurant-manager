import { useCallback, useEffect, useState } from 'react'
import { buscarRodadas } from '../api/mesa'
import type { RodadasDaMesa } from '../api/tipos'

/** Rodadas já enviadas pela mesa, com o total parcial (só confirmadas). */
export function useRodadas(token: string): RodadasDaMesa & { recarregar: () => void } {
  const [dados, setDados] = useState<RodadasDaMesa>({
    rodadas: [],
    totalParcialCentavos: 0,
    chamadoAberto: false,
  })

  const recarregar = useCallback(() => {
    buscarRodadas(token)
      .then(setDados)
      .catch(() => {
        // Sem rede: ficam as últimas conhecidas.
      })
  }, [token])

  useEffect(recarregar, [recarregar])

  return { ...dados, recarregar }
}

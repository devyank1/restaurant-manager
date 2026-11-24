import { useEffect, useState } from 'react'
import type { MetaBatida } from '../api/tipos'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import '../estilo/paineis.css'
import { textoAlvo } from './numeros'

const DURACAO_MS = 15_000

/** Faixa para toda a equipe quando a meta da equipe é batida. */
export default function Comemoracao() {
  const [meta, setMeta] = useState<MetaBatida | null>(null)
  useEquipeAoVivo({ metaBatida: setMeta })

  useEffect(() => {
    if (!meta) return
    const t = setTimeout(() => setMeta(null), DURACAO_MS)
    return () => clearTimeout(t)
  }, [meta])

  if (!meta) return null
  return (
    <div className="comemoracao" role="status">
      <p>{`A equipe bateu a meta de ${textoAlvo(meta)}! 🎉`}</p>
      <button type="button" className="botao botao--secundario" onClick={() => setMeta(null)}>
        Fechar
      </button>
    </div>
  )
}

import { useId } from 'react'
import type { Unidade } from '../api/tipos'
import { digitadaDe, type ValorCampo } from './campo'
import { unidadesDe, type UnidadeDigitada } from './unidades'

export default function CampoQuantidade({
  rotulo,
  rotuloUnidade,
  unidade,
  valor,
  onMudar,
}: {
  rotulo: string
  rotuloUnidade: string
  unidade: Unidade
  valor: ValorCampo
  onMudar: (valor: ValorCampo) => void
}) {
  const id = useId()
  const digitada = digitadaDe(valor, unidade)
  return (
    <div className="campo-quantidade">
      <label htmlFor={`${id}-n`}>{rotulo}</label>
      <div className="campo-quantidade-linha">
        <input
          id={`${id}-n`}
          inputMode="decimal"
          autoComplete="off"
          value={valor.texto}
          onChange={(e) => onMudar({ texto: e.target.value, digitada })}
        />
        <select
          aria-label={rotuloUnidade}
          value={digitada}
          onChange={(e) => onMudar({ texto: valor.texto, digitada: e.target.value as UnidadeDigitada })}
        >
          {unidadesDe(unidade).map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

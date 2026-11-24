// Peças pequenas repetidas nas telas do estoque.
import type { ReactNode } from 'react'
import type { NivelEstoque, Unidade } from '../api/tipos'
import { falarQuantidade, formatarQuantidade } from './unidades'

/** Título da tela (o Voltar fica no topo do app). */
export function BarraTitulo({ titulo }: { titulo: string }) {
  return (
    <div className="barra-titulo">
      <h2>{titulo}</h2>
    </div>
  )
}

/** Quantidade visível ("1,5 kg") e lida por extenso ("1,5 quilo"). */
export function Quantidade({ base, unidade }: { base: number; unidade: Unidade }) {
  return <span aria-label={falarQuantidade(base, unidade)}>{formatarQuantidade(base, unidade)}</span>
}

export function SeloNivel({ nivel }: { nivel: NivelEstoque }) {
  if (nivel === 'OK') return null
  return (
    <span className={`selo ${nivel === 'ZERADO' ? 'selo--perigo' : 'selo--alerta'}`}>
      {nivel === 'ZERADO' ? 'Acabou' : 'Acabando'}
    </span>
  )
}

/** Pergunta antes de algo que muda muito o estoque. */
export function Confirmacao({
  texto,
  onSim,
  onNao,
}: {
  texto: ReactNode
  onSim: () => void
  onNao: () => void
}) {
  return (
    <div role="alertdialog" aria-labelledby="confirmacao-texto" className="confirmacao">
      <p id="confirmacao-texto">{texto}</p>
      <div className="confirmacao-botoes">
        <button type="button" className="botao botao--secundario" onClick={onNao}>
          Cancelar
        </button>
        <button type="button" className="botao botao--primario" onClick={onSim}>
          Confirmar
        </button>
      </div>
    </div>
  )
}

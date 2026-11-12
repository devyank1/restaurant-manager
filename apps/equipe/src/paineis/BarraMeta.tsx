import type { ProgressoMeta } from '../api/tipos'
import '../estilo/paineis.css'
import { textoMeta, textoPeriodo } from './numeros'

/**
 * Barra de uma meta. Abaixo do alvo fica neutra (nunca vermelha);
 * batida fica verde [spec §4.2].
 */
export default function BarraMeta({ meta, rotulo }: { meta: ProgressoMeta; rotulo: string }) {
  const texto = textoMeta(meta)
  return (
    <div className={`barra-meta${meta.batida ? ' barra-meta--batida' : ''}`}>
      <div className="barra-meta-topo">
        <span className="barra-meta-rotulo">{rotulo}</span>
        <span className="barra-meta-periodo">{textoPeriodo(meta.periodo)}</span>
      </div>
      <div
        className="barra-meta-trilho"
        role="meter"
        aria-label={rotulo}
        aria-valuemin={0}
        aria-valuemax={Math.max(meta.alvo, meta.atual)}
        aria-valuenow={meta.atual}
        aria-valuetext={texto}
      >
        <div className="barra-meta-cheio" style={{ width: `${meta.pct}%` }} />
      </div>
      <p className="barra-meta-texto">
        {texto}
        {meta.batida && <strong className="barra-meta-batida">{' · Meta batida! 🎉'}</strong>}
      </p>
    </div>
  )
}

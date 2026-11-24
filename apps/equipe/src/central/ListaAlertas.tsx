import { useState } from 'react'
import type { CentralResposta, Gravidade } from '../api/tipos'
import { navegar } from '../rotas'
import '../estilo/central.css'

const ROTULO: Record<Gravidade, string> = { ALTA: 'Urgente', MEDIA: 'Atenção', BAIXA: 'Aviso' }

function haQuanto(desde: string, agora: string): string {
  const min = Math.max(0, Math.floor((new Date(agora).getTime() - new Date(desde).getTime()) / 60000))
  if (min < 60) return `há ${min} min`
  return `há ${Math.floor(min / 60)} h ${min % 60} min`
}

/** Alertas na ordem recebida; gravidade em texto, nunca só cor. `agora` padrão: relógio. */
export default function ListaAlertas({
  alertas,
  agora,
}: {
  alertas: CentralResposta['alertas']
  agora?: string
}) {
  const [relogio] = useState(() => new Date().toISOString())
  if (alertas.length === 0) return <p className="vazio central-ok">Tudo certo agora</p>
  const referencia = agora ?? relogio
  return (
    <ul className="alertas" aria-label="Alertas">
      {alertas.map((a) => (
        <li key={a.chave} className={`alerta alerta--${a.gravidade.toLowerCase()}`}>
          <div className="alerta-corpo">
            <span className="alerta-rotulo">{ROTULO[a.gravidade]}</span>
            <strong className="alerta-titulo">{a.titulo}</strong>
            <span className="alerta-detalhe">{a.detalhe}</span>
            <span className="alerta-tempo">{haQuanto(a.desde, referencia)}</span>
          </div>
          {a.link !== null && (
            <button type="button" className="botao botao--secundario" onClick={() => navegar(a.link as string)}>
              Ver
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

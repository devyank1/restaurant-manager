import { useEffect, useState } from 'react'
import { buscarMesas } from '../api/equipe'
import type { MesaResumo } from '../api/tipos'
import { navegar } from '../rotas'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import { useMaisRecente } from '../tempo-real/useMaisRecente'

export default function TodasMesas() {
  const [mesas, setMesas] = useState<MesaResumo[] | null>(null)

  const recarregar = useMaisRecente(buscarMesas, setMesas)
  useEffect(() => {
    void recarregar()
  }, [recarregar])
  useEquipeAoVivo({ mesas: recarregar })

  return (
    <main className="todas-mesas">
      <div className="barra-titulo">
        <button type="button" className="voltar" onClick={() => navegar('/')}>
          ‹ Início
        </button>
        <h2>Todas as mesas</h2>
      </div>
      {mesas === null ? (
        <p className="vazio">Carregando…</p>
      ) : (
        <ul className="grade-mesas">
          {mesas.map((m) => (
            <li key={m.token}>
              <button
                type="button"
                className={`mesa-quadro${m.aberta ? '' : ' mesa-quadro--livre'}`}
                onClick={() => navegar(`/mesa/${encodeURIComponent(m.token)}`)}
              >
                <span className="mesa-numero">{`Mesa ${m.numero}`}</span>
                <span className="mesa-quem">{m.aberta ? (m.garcomNome ?? 'Sem garçom') : 'Livre'}</span>
                {m.pendentes > 0 && <span className="selo selo--alerta">{`${m.pendentes} aguardando`}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

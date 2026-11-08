import { useState } from 'react'
import { mudarTurno } from '../api/equipe'
import type { UsuarioEquipe } from '../api/tipos'

const PAPEL: Record<UsuarioEquipe['papel'], string> = { DONO: 'Dono', GARCOM: 'Garçom', COZINHA: 'Produção' }

export default function Topo({
  usuario,
  onMudou,
  onSair,
}: {
  usuario: UsuarioEquipe
  onMudou: (usuario: UsuarioEquipe) => void
  onSair: () => void
}) {
  const [mudando, setMudando] = useState(false)

  const alternar = async () => {
    setMudando(true)
    try {
      onMudou(await mudarTurno(!usuario.emTurno))
    } catch {
      // 401 já levou ao login; sem rede, o interruptor fica como estava.
    } finally {
      setMudando(false)
    }
  }

  return (
    <header className="topo">
      <div className="topo-quem">
        <strong>{usuario.nome}</strong>
        <span className="topo-papel">{PAPEL[usuario.papel]}</span>
      </div>
      {usuario.papel !== 'COZINHA' && (
      <button
        type="button"
        role="switch"
        aria-checked={usuario.emTurno}
        aria-label="Em turno"
        className={`turno${usuario.emTurno ? ' turno--ligado' : ''}`}
        disabled={mudando}
        onClick={alternar}
      >
        <span className="turno-bolinha" aria-hidden="true" />
        {usuario.emTurno ? 'Em turno' : 'Fora do turno'}
      </button>
      )}
      <button type="button" className="topo-sair" onClick={onSair}>
        Sair
      </button>
    </header>
  )
}

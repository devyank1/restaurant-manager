import { useState } from 'react'
import { mudarTurno } from '../api/equipe'
import type { UsuarioEquipe } from '../api/tipos'
import AvisarPerda from '../estoque/AvisarPerda'
import { navegar } from '../rotas'

const PAPEL: Record<UsuarioEquipe['papel'], string> = { DONO: 'Dono', GARCOM: 'Garçom', COZINHA: 'Produção' }

export default function Topo({
  usuario,
  onMudou,
  onSair,
  volta = null,
}: {
  usuario: UsuarioEquipe
  onMudou: (usuario: UsuarioEquipe) => void
  onSair: () => void
  /** Tela de cima; null = sem botão Voltar (início). */
  volta?: string | null
}) {
  const [mudando, setMudando] = useState(false)
  const [perda, setPerda] = useState(false)

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
      {volta && (
        <button type="button" className="topo-voltar" onClick={() => navegar(volta)}>
          <span aria-hidden="true">‹ </span>Voltar
        </button>
      )}
      <div className="topo-quem">
        <strong>{usuario.nome}</strong>
        <span className="topo-papel">{PAPEL[usuario.papel]}</span>
      </div>
      {usuario.papel === 'GARCOM' && (
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
      <button type="button" className="topo-perda" onClick={() => setPerda(true)}>
        Avisar perda
      </button>
      {perda && <AvisarPerda onFechar={() => setPerda(false)} />}
      <button type="button" className="topo-sair" onClick={onSair}>
        Sair
      </button>
    </header>
  )
}

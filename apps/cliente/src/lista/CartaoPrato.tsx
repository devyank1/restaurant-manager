import type { PratoPublico } from '../api/tipos'
import PrecoPrato from './PrecoPrato'

export default function CartaoPrato({ prato, onAbrir }: { prato: PratoPublico; onAbrir: () => void }) {
  return (
    <button
      type="button"
      className={`cartao${prato.esgotado ? ' cartao--esgotado' : ''}`}
      aria-disabled={prato.esgotado ? 'true' : undefined}
      onClick={onAbrir}
    >
      <span className="cartao-miniatura">
        {prato.posterUrl && <img src={prato.posterUrl} alt="" loading="lazy" />}
        {prato.videoUrl && (
          <span className="cartao-play" aria-hidden="true">
            ▶
          </span>
        )}
      </span>
      <span className="cartao-info">
        <span className="cartao-nome">
          {prato.nome}
          {prato.destaque && <span className="selo">DESTAQUE</span>}
        </span>
        <span className="cartao-descricao">{prato.esgotado ? 'Esgotado' : prato.descricao}</span>
        <PrecoPrato prato={prato} />
      </span>
    </button>
  )
}

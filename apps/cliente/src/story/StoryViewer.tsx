import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { PratoPublico } from '../api/tipos'
import PrecoPrato from '../lista/PrecoPrato'
import './story.css'

const LIMIAR_DESLIZE = 50
const LIMIAR_TOQUE = 10

export default function StoryViewer({
  pratos,
  indiceInicial,
  onFechar,
  onAdicionar,
}: {
  pratos: PratoPublico[]
  indiceInicial: number
  onFechar: () => void
  onAdicionar: (prato: PratoPublico) => void
}) {
  const [indice, setIndice] = useState(indiceInicial)
  const [mudo, setMudo] = useState(true)
  const [progresso, setProgresso] = useState(0)
  const [falharam, setFalharam] = useState<Set<string>>(() => new Set())
  const [descricaoAberta, setDescricaoAberta] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const inicioToque = useRef<number | null>(null)

  const prato = pratos[indice]
  const proximo = pratos[indice + 1]
  const mostrarVideo = prato.videoUrl !== null && !falharam.has(prato.id)

  const irPara = (novo: number) => {
    const limitado = Math.min(Math.max(novo, 0), pratos.length - 1)
    if (limitado === indice) return
    setIndice(limitado)
    setProgresso(0)
    setDescricaoAberta(false)
  }

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'ArrowDown') irPara(indice + 1)
      if (evento.key === 'ArrowUp') irPara(indice - 1)
      if (evento.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  // O atributo `muted` do React não acompanha mudanças; a propriedade sim.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = mudo
  }, [mudo, indice, mostrarVideo])

  const aoPressionar = (evento: PointerEvent) => {
    inicioToque.current = evento.clientY
  }

  const aoSoltar = (evento: PointerEvent) => {
    if (inicioToque.current === null) return
    const deslocamento = evento.clientY - inicioToque.current
    inicioToque.current = null

    if (deslocamento <= -LIMIAR_DESLIZE) irPara(indice + 1)
    else if (deslocamento >= LIMIAR_DESLIZE) irPara(indice - 1)
    else if (Math.abs(deslocamento) < LIMIAR_TOQUE) alternarPausa()
  }

  const alternarPausa = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  const marcarFalha = () => {
    setFalharam((anteriores) => new Set(anteriores).add(prato.id))
  }

  return (
    <div className="story" role="dialog" aria-modal="true" aria-label={prato.nome}>
      <div
        className="story-palco"
        data-testid="story-palco"
        onPointerDown={aoPressionar}
        onPointerUp={aoSoltar}
      >
        {mostrarVideo ? (
          <video
            key={prato.id}
            ref={videoRef}
            className="story-midia"
            data-testid="story-video"
            src={prato.videoUrl ?? undefined}
            poster={prato.posterUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            onTimeUpdate={(evento) => {
              const { currentTime, duration } = evento.currentTarget
              if (duration > 0) setProgresso(currentTime / duration)
            }}
            onError={marcarFalha}
          />
        ) : prato.posterUrl ? (
          <img className="story-midia" src={prato.posterUrl} alt={prato.nome} />
        ) : (
          <div className="story-midia story-fundo" data-testid="story-fundo" />
        )}
      </div>

      {proximo?.videoUrl && (
        <video
          key={`pre-${proximo.id}`}
          data-testid="story-pre-carga"
          src={proximo.videoUrl}
          preload="auto"
          muted
          hidden
        />
      )}

      <div className="story-progresso">
        {pratos.map((p, i) => (
          <span key={p.id} className="story-segmento" data-testid="story-segmento">
            <span
              className="story-segmento-cheio"
              style={{ width: `${i < indice ? 100 : i === indice ? progresso * 100 : 0}%` }}
            />
          </span>
        ))}
      </div>

      <div className="story-topo">
        <button type="button" className="story-pilula" onClick={onFechar}>
          ← Voltar
        </button>
        <span className="story-pilula">{`${indice + 1} de ${pratos.length}`}</span>
        <button type="button" className="story-pilula" onClick={() => setMudo((m) => !m)}>
          {mudo ? 'Ativar som' : 'Desativar som'}
        </button>
      </div>

      <div className="story-setas" aria-hidden="true">
        <span>▲</span>
        <span>▼</span>
      </div>

      <div className="story-rodape">
        <div className="story-selos">
          <span className="story-selo story-selo--video">VÍDEO DO PRATO</span>
          {prato.destaque && <span className="story-selo story-selo--destaque">DESTAQUE</span>}
        </div>
        <h2 className="story-nome">{prato.nome}</h2>
        <PrecoPrato prato={prato} grande />
        <p className={`story-descricao${descricaoAberta ? ' story-descricao--aberta' : ''}`}>
          {prato.descricao}
        </p>
        {!descricaoAberta && (
          <button type="button" className="story-ler-mais" onClick={() => setDescricaoAberta(true)}>
            ler mais
          </button>
        )}
        {prato.esgotado ? (
          <button type="button" className="botao botao--primario story-adicionar" disabled>
            Esgotado
          </button>
        ) : (
          <button type="button" className="botao botao--primario story-adicionar" onClick={() => onAdicionar(prato)}>
            + Adicionar ao pedido
          </button>
        )}
      </div>
    </div>
  )
}

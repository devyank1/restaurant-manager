import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { PratoPublico } from '../api/tipos'
import PrecoPrato from '../lista/PrecoPrato'
import './story.css'

const LIMIAR_DESLIZE = 50
const LIMIAR_TOQUE = 10
// Nas pontas (primeiro/último prato) o arrasto anda 1/3 do dedo, como um elástico.
const RESISTENCIA_PONTA = 3
const ELEMENTOS_INTERATIVOS = 'button, a, input, textarea, select, label'

// Navegadores antigos devolvem undefined em vez de Promise.
const tocar = (video: HTMLVideoElement) => Promise.resolve(video.play())

function Chevron({ para }: { para: 'cima' | 'baixo' }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d={para === 'cima' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Prato vizinho durante o arrasto: só o poster (ou o fundo), aparece na hora. */
function MidiaVizinha({ prato }: { prato: PratoPublico }) {
  return prato.posterUrl ? (
    <img className="story-midia" src={prato.posterUrl} alt="" />
  ) : (
    <div className="story-midia story-fundo" />
  )
}

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
  const [descricaoCortada, setDescricaoCortada] = useState(false)
  // Deslocamento vertical do trilho de pratos, em px; acompanha o dedo.
  const [arrasto, setArrasto] = useState(0)
  const [animado, setAnimado] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const palcoRef = useRef<HTMLDivElement>(null)
  const descricaoRef = useRef<HTMLParagraphElement>(null)
  const inicioToque = useRef<number | null>(null)

  const prato = pratos[indice]
  const anterior = pratos[indice - 1]
  const proximo = pratos[indice + 1]
  const mostrarVideo = prato.videoUrl !== null && !falharam.has(prato.id)

  const irPara = (novo: number) => {
    const limitado = Math.min(Math.max(novo, 0), pratos.length - 1)
    if (limitado === indice) return false
    setIndice(limitado)
    setProgresso(0)
    setDescricaoAberta(false)
    return true
  }

  // Troca de prato com o novo entrando de onde está na tela e deslizando até o lugar.
  // `deslocamentoAtual`: quanto o trilho já tinha andado (o dedo, no caso do arrasto).
  const deslizarPara = (novo: number, deslocamentoAtual = 0) => {
    const altura = palcoRef.current?.clientHeight || window.innerHeight
    const direcao = novo > indice ? 1 : -1
    if (!irPara(novo)) {
      setAnimado(true)
      setArrasto(0)
      return
    }
    setAnimado(false)
    setArrasto(deslocamentoAtual + direcao * altura)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimado(true)
        setArrasto(0)
      }),
    )
  }

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'ArrowDown') deslizarPara(indice + 1)
      if (evento.key === 'ArrowUp') deslizarPara(indice - 1)
      if (evento.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  // O atributo `muted` do React não acompanha mudanças; a propriedade sim.
  // Com som ligado, o iOS pode recusar o autoplay do próximo vídeo: nesse caso
  // volta para mudo e segue tocando, em vez de travar no poster.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = mudo
    tocar(video).catch(() => {
      if (video.muted) return
      video.muted = true
      setMudo(true)
      tocar(video).catch(() => {})
    })
  }, [mudo, indice, mostrarVideo])

  // "ler mais" só quando a descrição realmente passou das 2 linhas.
  useLayoutEffect(() => {
    const descricao = descricaoRef.current
    if (!descricao || descricaoAberta) return
    const cortada = descricao.scrollHeight > descricao.clientHeight + 1
    // eslint-disable-next-line react-hooks/set-state-in-effect -- medir o DOM exige o layout pronto
    setDescricaoCortada(cortada)
  }, [prato.id, descricaoAberta])

  const aoPressionar = (evento: PointerEvent) => {
    const alvo = evento.target as Element
    // Toques em botões e links são deles; o resto da tela vale para deslizar.
    if (alvo.closest(ELEMENTOS_INTERATIVOS)) {
      inicioToque.current = null
      return
    }
    inicioToque.current = evento.clientY
    setAnimado(false)
  }

  const aoMover = (evento: PointerEvent) => {
    if (inicioToque.current === null) return
    let deslocamento = evento.clientY - inicioToque.current
    const naPonta = (deslocamento > 0 && !anterior) || (deslocamento < 0 && !proximo)
    if (naPonta) deslocamento /= RESISTENCIA_PONTA
    setArrasto(deslocamento)
  }

  const aoSoltar = (evento: PointerEvent) => {
    if (inicioToque.current === null) return
    const deslocamento = evento.clientY - inicioToque.current
    inicioToque.current = null

    if (deslocamento <= -LIMIAR_DESLIZE && proximo) deslizarPara(indice + 1, deslocamento)
    else if (deslocamento >= LIMIAR_DESLIZE && anterior) deslizarPara(indice - 1, deslocamento)
    else {
      setAnimado(true)
      setArrasto(0)
      if (Math.abs(deslocamento) < LIMIAR_TOQUE) alternarPausa()
    }
  }

  const aoCancelar = () => {
    inicioToque.current = null
    setAnimado(true)
    setArrasto(0)
  }

  const alternarPausa = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) tocar(video).catch(() => {})
    else video.pause()
  }

  const marcarFalha = () => {
    setFalharam((anteriores) => new Set(anteriores).add(prato.id))
  }

  return (
    <div
      className="story"
      role="dialog"
      aria-modal="true"
      aria-label={prato.nome}
      onPointerDown={aoPressionar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoCancelar}
    >
      <div className="story-palco" data-testid="story-palco" ref={palcoRef}>
        <div
          className={`story-trilho${animado ? ' story-trilho--animado' : ''}`}
          data-testid="story-trilho"
          style={{ transform: `translateY(${arrasto}px)` }}
        >
          {anterior && (
            <div className="story-slide story-slide--anterior" aria-hidden="true">
              <MidiaVizinha prato={anterior} />
            </div>
          )}
          <div className="story-slide">
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
          {proximo && (
            <div className="story-slide story-slide--proximo" aria-hidden="true" data-testid="story-slide-proximo">
              <MidiaVizinha prato={proximo} />
            </div>
          )}
        </div>
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

      <div className="story-setas">
        <button type="button" aria-label="Prato anterior" disabled={!anterior} onClick={() => deslizarPara(indice - 1)}>
          <Chevron para="cima" />
        </button>
        <button type="button" aria-label="Próximo prato" disabled={!proximo} onClick={() => deslizarPara(indice + 1)}>
          <Chevron para="baixo" />
        </button>
      </div>

      <div className="story-rodape" key={prato.id}>
        <div className="story-selos">
          <span className="story-selo story-selo--video">VÍDEO DO PRATO</span>
          {prato.destaque && <span className="story-selo story-selo--destaque">DESTAQUE</span>}
        </div>
        <h2 className="story-nome">{prato.nome}</h2>
        <PrecoPrato prato={prato} grande />
        <p
          ref={descricaoRef}
          className={`story-descricao${descricaoAberta ? ' story-descricao--aberta' : ''}`}
        >
          {prato.descricao}
        </p>
        {descricaoCortada && !descricaoAberta && (
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

import '../estilo/central.css'

type Ponto = { hora: number; hoje: number; media: number }

const L = 320
const A = 120
const MARGEM = 16
const BASE = A - 20

/** Pedidos por hora: hoje (linha cheia) contra a média (tracejada). SVG simples. */
export default function LinhaPorHora({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length === 0) return <p className="vazio">Sem movimento ainda</p>
  const maior = Math.max(1, ...pontos.flatMap((p) => [p.hoje, p.media]))
  const x = (hora: number) => MARGEM + ((L - 2 * MARGEM) * hora) / 23
  const y = (v: number) => BASE - ((BASE - MARGEM) * v) / maior
  const linha = (campo: 'hoje' | 'media') => pontos.map((p) => `${x(p.hora)},${y(p[campo])}`).join(' ')
  return (
    <figure className="por-hora">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        role="img"
        aria-label="Pedidos por hora: hoje contra a média"
        className="por-hora-svg"
      >
        <line className="por-hora-eixo" x1={MARGEM} y1={BASE} x2={L - MARGEM} y2={BASE} />
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
          <text key={h} className="por-hora-rotulo" x={x(h)} y={A - 4} textAnchor="middle">{`${h}h`}</text>
        ))}
        <polyline className="por-hora-media" fill="none" strokeDasharray="4 3" points={linha('media')} />
        <polyline className="por-hora-hoje" fill="none" points={linha('hoje')} />
      </svg>
      <figcaption className="por-hora-legenda">
        <span className="legenda legenda--hoje">Hoje</span>
        <span className="legenda legenda--media">Média</span>
      </figcaption>
    </figure>
  )
}

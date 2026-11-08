import { formatarReais } from '@cardapio/opcoes'
import { useEffect, useState } from 'react'
import { cancelarRodada, entregarRodada } from '../api/equipe'
import type { RodadaEquipe, StatusItem } from '../api/tipos'

const STATUS_ITEM: Record<StatusItem, { texto: string; classe: string }> = {
  NA_FILA: { texto: 'Na fila', classe: 'selo' },
  EM_PREPARO: { texto: 'Preparando', classe: 'selo selo--destaque' },
  PRONTO: { texto: 'Pronto', classe: 'selo selo--sucesso' },
  ENTREGUE: { texto: 'Entregue', classe: 'selo' },
}

const FASE: Record<RodadaEquipe['fase'], string> = {
  AGUARDANDO_GARCOM: 'Aguardando',
  NA_COZINHA: 'Na produção',
  PRONTO: 'Pronto',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelado',
}

/** Milissegundos que faltam até `ate` (0 quando passou), atualizado a cada segundo. */
function useRestante(ate: string | null): number {
  const calcular = () => (ate ? Math.max(0, new Date(ate).getTime() - Date.now()) : 0)
  const [restante, setRestante] = useState(calcular)
  useEffect(() => {
    if (!ate) return
    const fim = new Date(ate).getTime()
    const tique = () => setRestante(Math.max(0, fim - Date.now()))
    tique()
    const relogio = setInterval(tique, 1000)
    return () => clearInterval(relogio)
  }, [ate])
  return ate ? restante : 0
}

const mmss = (ms: number) => {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Rodada já na produção: status de cada item, entregar o que ficou pronto e cancelar na janela. */
export default function RodadaConfirmada({
  rodada,
  ocupado,
  agir,
}: {
  rodada: RodadaEquipe
  ocupado: boolean
  agir: (acao: () => Promise<unknown>) => void
}) {
  const [perguntarCancelar, setPerguntarCancelar] = useState(false)
  const restante = useRestante(rodada.cancelavelAte)
  const prontos = rodada.itens.filter((i) => i.status === 'PRONTO').length

  return (
    <section className={`rodada rodada--confirmada rodada--fase-${rodada.fase.toLowerCase()}`} aria-label="Pedido confirmado">
      <div className="rodada-topo">
        <span className="rodada-status">{FASE[rodada.fase]}</span>
        <span>{formatarReais(rodada.totalCentavos)}</span>
      </div>

      <ul className="itens itens--compacto">
        {rodada.itens.map((i) => (
          <li key={i.id} className="item-andamento">
            <span className="item-andamento-nome">
              {`${i.quantidade}× `}
              <span>{i.nome}</span>
              {i.resumoOpcoes && <span className="item-opcoes">{` (${i.resumoOpcoes})`}</span>}
            </span>
            <span className={STATUS_ITEM[i.status].classe}>{STATUS_ITEM[i.status].texto}</span>
          </li>
        ))}
      </ul>

      {prontos > 0 && (
        <button
          type="button"
          className="botao botao--sucesso"
          disabled={ocupado}
          onClick={() => agir(() => entregarRodada(rodada.id))}
        >
          {`Entregar prontos (${prontos})`}
        </button>
      )}

      {restante > 0 &&
        (perguntarCancelar ? (
          <div className="recusa" role="group" aria-label="Cancelar pedido">
            <p>Cancelar este pedido?</p>
            <button type="button" className="botao botao--secundario" onClick={() => setPerguntarCancelar(false)}>
              Não
            </button>
            <button
              type="button"
              className="botao botao--perigo"
              disabled={ocupado}
              onClick={() => {
                setPerguntarCancelar(false)
                agir(() => cancelarRodada(rodada.id))
              }}
            >
              Sim, cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="botao botao--perigo"
            disabled={ocupado}
            onClick={() => setPerguntarCancelar(true)}
          >
            {`Cancelar pedido (${mmss(restante)})`}
          </button>
        ))}
    </section>
  )
}

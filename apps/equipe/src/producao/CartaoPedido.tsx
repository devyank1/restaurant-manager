import type { PedidoProducao, StatusItem, StatusProducao } from '../api/tipos'

const TEXTO: Record<StatusItem, string> = {
  NA_FILA: 'Na fila',
  EM_PREPARO: 'Preparando',
  PRONTO: 'Pronto',
  ENTREGUE: 'Entregue',
}

/** Tocar no item avança um passo; pronto e entregue não avançam. */
const PROXIMO: Partial<Record<StatusItem, StatusProducao>> = {
  NA_FILA: 'EM_PREPARO',
  EM_PREPARO: 'PRONTO',
}

const ALERTA_MIN = 10
const PERIGO_MIN = 20

export default function CartaoPedido({
  pedido,
  agora,
  ocupado,
  onItem,
  onEstacao,
  onOk,
}: {
  pedido: PedidoProducao
  /** Relógio da tela (ms), para o tempo de espera. */
  agora: number
  ocupado: boolean
  onItem: (itemId: string, status: StatusProducao) => void
  onEstacao: (status: StatusProducao) => void
  onOk: () => void
}) {
  const minutos = pedido.confirmadaEm
    ? Math.max(0, Math.floor((agora - new Date(pedido.confirmadaEm).getTime()) / 60_000))
    : 0
  const naFila = pedido.itens.some((i) => i.status === 'NA_FILA')
  const preparando = pedido.itens.some((i) => i.status === 'EM_PREPARO')

  let classe = 'cartao-producao'
  if (pedido.cancelada) classe += ' cartao-producao--cancelado'
  else if (naFila || preparando) {
    if (minutos >= PERIGO_MIN) classe += ' cartao-producao--perigo'
    else if (minutos >= ALERTA_MIN) classe += ' cartao-producao--alerta'
  }

  return (
    <article className={classe} aria-label={`Mesa ${pedido.mesa.numero}`}>
      <header className="cartao-producao-topo">
        <span className="cartao-producao-mesa">{`Mesa ${pedido.mesa.numero}`}</span>
        {pedido.cancelada ? (
          <span className="cartao-producao-cancelado">Cancelado</span>
        ) : (
          <span className="cartao-producao-tempo">{`${minutos} min`}</span>
        )}
      </header>
      {pedido.garcomNome && <span className="cartao-producao-garcom">{pedido.garcomNome}</span>}

      <ul className="producao-itens">
        {pedido.itens.map((item) => {
          const proximo = PROXIMO[item.status]
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`producao-item producao-item--${item.status.toLowerCase()}`}
                aria-label={`${item.nome}: ${TEXTO[item.status]}`}
                disabled={pedido.cancelada || ocupado || !proximo}
                onClick={() => proximo && onItem(item.id, proximo)}
              >
                <span className="producao-qtd">{`${item.quantidade}×`}</span>
                <span className="producao-item-info">
                  <span className="producao-nome">{item.nome}</span>
                  {item.resumoOpcoes && <span className="producao-opcoes">{item.resumoOpcoes}</span>}
                  {item.observacao && <span className="producao-obs">{item.observacao}</span>}
                </span>
                <span className="producao-status">{TEXTO[item.status]}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {pedido.cancelada ? (
        <button type="button" className="botao botao--secundario" onClick={onOk}>
          Ok
        </button>
      ) : naFila ? (
        <button type="button" className="botao botao--primario" disabled={ocupado} onClick={() => onEstacao('EM_PREPARO')}>
          Começar
        </button>
      ) : preparando ? (
        <button type="button" className="botao botao--sucesso" disabled={ocupado} onClick={() => onEstacao('PRONTO')}>
          Pronto
        </button>
      ) : (
        <button type="button" className="botao botao--secundario" disabled={ocupado} onClick={() => onEstacao('EM_PREPARO')}>
          Desfazer
        </button>
      )}
    </article>
  )
}

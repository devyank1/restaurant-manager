import type { RodadaPublica } from '../api/tipos'
import { formatarReais } from '../preco/preco'
import './pedido.css'

const STATUS: Record<RodadaPublica['status'], string> = {
  AGUARDANDO_GARCOM: 'Aguardando garçom',
  CONFIRMADA: 'Confirmado',
  CANCELADA: 'Cancelado',
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function PedidosSheet({
  rodadas,
  totalParcialCentavos,
  onFechar,
}: {
  rodadas: RodadaPublica[]
  totalParcialCentavos: number
  onFechar: () => void
}) {
  return (
    <div className="sheet-fundo" onClick={onFechar}>
      <div
        className="sheet carrinho"
        role="dialog"
        aria-modal="true"
        aria-label="Seus pedidos"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2>Seus pedidos</h2>

        <ol className="pedidos-rodadas">
          {rodadas.map((rodada) => (
            <li key={rodada.id} className={`pedidos-rodada pedidos-rodada--${rodada.status.toLowerCase()}`}>
              <div className="pedidos-rodada-topo">
                <span>{hora(rodada.criadoEm)}</span>
                <span className="pedidos-status">{STATUS[rodada.status]}</span>
              </div>
              <ul className="carrinho-itens">
                {rodada.itens.map((item, i) => (
                  <li key={i} className="carrinho-item">
                    <div className="carrinho-item-info">
                      <span className="pedidos-linha">
                        <span className="pedidos-qtd">{`${item.quantidade}×`}</span>
                        <strong>{item.nome}</strong>
                      </span>
                      {item.resumoOpcoes && <span className="carrinho-resumo">{item.resumoOpcoes}</span>}
                      {item.observacao && <span className="carrinho-resumo">{`Obs.: ${item.observacao}`}</span>}
                    </div>
                    <span className="carrinho-subtotal">
                      {formatarReais(item.precoUnitarioCentavos * item.quantidade)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <p className="carrinho-total">{`Total parcial ${formatarReais(totalParcialCentavos)}`}</p>

        <button type="button" className="botao botao--secundario" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  )
}

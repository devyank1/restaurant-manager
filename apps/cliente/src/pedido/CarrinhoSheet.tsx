import type { AcaoCarrinho, ItemCarrinho } from '../carrinho/carrinho'
import { formatarReais } from '../preco/preco'
import './pedido.css'

export default function CarrinhoSheet({
  itens,
  total,
  despachar,
  onFechar,
}: {
  itens: ItemCarrinho[]
  total: number
  despachar: (acao: AcaoCarrinho) => void
  onFechar: () => void
}) {
  return (
    <div className="sheet-fundo" onClick={onFechar}>
      <div
        className="sheet carrinho"
        role="dialog"
        aria-modal="true"
        aria-label="Seu pedido"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2>Seu pedido</h2>

        {itens.length === 0 ? (
          <p className="carrinho-vazio">Seu pedido está vazio</p>
        ) : (
          <ul className="carrinho-itens">
            {itens.map((item) => (
              <li key={item.id} className="carrinho-item" aria-label={item.nome}>
                <div className="carrinho-item-info">
                  <strong>{item.nome}</strong>
                  {item.resumoOpcoes && <span className="carrinho-resumo">{item.resumoOpcoes}</span>}
                  {item.observacao && <span className="carrinho-resumo">{`Obs.: ${item.observacao}`}</span>}
                  <span className="carrinho-subtotal">{formatarReais(item.precoUnitarioCentavos * item.quantidade)}</span>
                </div>
                <div className="quantidade">
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    onClick={() => despachar({ tipo: 'quantidade', id: item.id, quantidade: item.quantidade - 1 })}
                  >
                    −
                  </button>
                  <span>{item.quantidade}</span>
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    onClick={() => despachar({ tipo: 'quantidade', id: item.id, quantidade: item.quantidade + 1 })}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="carrinho-total">{`Total ${formatarReais(total)}`}</p>

        <button type="button" className="botao botao--primario" disabled>
          Enviar pedido
        </button>
        <p className="carrinho-nota">O envio para o garçom chega na próxima versão.</p>

        <button type="button" className="botao botao--secundario" onClick={onFechar}>
          Continuar escolhendo
        </button>
      </div>
    </div>
  )
}

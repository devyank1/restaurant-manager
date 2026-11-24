import { formatarReais, SeletorOpcoes, type PratoPublico } from '@cardapio/opcoes'
import { useState } from 'react'
import type { CardapioPublico } from '../api/cardapio'
import { adicionarItem, alterarItem, confirmarRodada, recusarRodada } from '../api/equipe'
import type { ItemRodadaEquipe, RodadaEquipe } from '../api/tipos'
import AdicionarItem from './AdicionarItem'

/**
 * Rodada aguardando garçom: conferir na mesa, ajustar e confirmar ou recusar.
 * `agir` roda a ação, trata erro (409 etc.) e recarrega a mesa.
 */
export default function RodadaPendente({
  rodada,
  cardapio,
  ocupado,
  agir,
}: {
  rodada: RodadaEquipe
  cardapio: CardapioPublico | null
  ocupado: boolean
  agir: (acao: () => Promise<unknown>) => void
}) {
  const [editando, setEditando] = useState<{ item: ItemRodadaEquipe; prato: PratoPublico } | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [perguntarRecusa, setPerguntarRecusa] = useState(false)
  const pratos = cardapio?.categorias.flatMap((c) => c.pratos) ?? []

  const mudarQuantidade = (item: ItemRodadaEquipe, quantidade: number) =>
    agir(() => alterarItem(rodada.id, item.id, { quantidade }))

  return (
    <section className="rodada rodada--pendente" aria-label="Pedido aguardando">
      <div className="rodada-topo">
        <h3>Pedido aguardando</h3>
        {rodada.dispositivoNovo && <span className="selo selo--alerta">Celular novo</span>}
      </div>

      {rodada.itens.length === 0 && <p className="vazio">Nenhum item. Recuse ou adicione um prato.</p>}
      <ul className="itens">
        {rodada.itens.map((item) => {
          const prato = pratos.find((p) => p.id === item.pratoId)
          return (
            <li key={item.id} className="item">
              <div className="item-info">
                <span className="item-nome">{item.nome}</span>
                {item.resumoOpcoes && <span className="item-opcoes">{item.resumoOpcoes}</span>}
                {item.observacao && <span className="item-obs">{item.observacao}</span>}
                <span className="item-preco">{formatarReais(item.precoUnitarioCentavos * item.quantidade)}</span>
              </div>
              <div className="item-acoes">
                <div className="item-qtd">
                  <button
                    type="button"
                    aria-label={`Diminuir ${item.nome}`}
                    disabled={ocupado}
                    onClick={() => mudarQuantidade(item, item.quantidade - 1)}
                  >
                    −
                  </button>
                  <span>{item.quantidade}</span>
                  <button
                    type="button"
                    aria-label={`Aumentar ${item.nome}`}
                    disabled={ocupado || item.quantidade >= 20}
                    onClick={() => mudarQuantidade(item, item.quantidade + 1)}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="item-link"
                  aria-label={`Editar ${item.nome}`}
                  disabled={ocupado || !prato}
                  onClick={() => prato && setEditando({ item, prato })}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="item-link item-link--perigo"
                  aria-label={`Remover ${item.nome}`}
                  disabled={ocupado}
                  onClick={() => mudarQuantidade(item, 0)}
                >
                  Remover
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        className="botao botao--secundario"
        disabled={ocupado || !cardapio}
        onClick={() => setAdicionando(true)}
      >
        + Adicionar prato
      </button>

      <p className="rodada-total">
        Total do pedido <strong>{formatarReais(rodada.totalCentavos)}</strong>
      </p>

      {perguntarRecusa ? (
        <div className="recusa" role="group" aria-label="Recusar pedido">
          <p>Recusar este pedido?</p>
          <button type="button" className="botao botao--secundario" onClick={() => setPerguntarRecusa(false)}>
            Não
          </button>
          <button
            type="button"
            className="botao botao--perigo"
            disabled={ocupado}
            onClick={() => {
              setPerguntarRecusa(false)
              agir(() => recusarRodada(rodada.id))
            }}
          >
            Sim, recusar
          </button>
        </div>
      ) : (
        <div className="rodada-acoes">
          <button type="button" className="botao botao--perigo" disabled={ocupado} onClick={() => setPerguntarRecusa(true)}>
            Recusar
          </button>
          <button
            type="button"
            className="botao botao--sucesso"
            disabled={ocupado || rodada.itens.length === 0}
            onClick={() => agir(() => confirmarRodada(rodada.id))}
          >
            Confirmar pedido
          </button>
        </div>
      )}

      {editando && (
        <SeletorOpcoes
          prato={editando.prato}
          inicial={editando.item}
          rotuloConfirmar="Salvar"
          onCancelar={() => setEditando(null)}
          onConfirmar={({ selecao, observacao, quantidade }) => {
            const { item } = editando
            setEditando(null)
            agir(() => alterarItem(rodada.id, item.id, { selecao, observacao, quantidade }))
          }}
        />
      )}

      {adicionando && cardapio && (
        <AdicionarItem
          cardapio={cardapio}
          onFechar={() => setAdicionando(false)}
          onEscolher={(novo) => {
            setAdicionando(false)
            agir(() => adicionarItem(rodada.id, novo))
          }}
        />
      )}
    </section>
  )
}

import { useEffect, useState } from 'react'
import type { CardapioPublico, PratoPublico } from '../api/tipos'
import type { ItemCarrinho } from '../carrinho/carrinho'
import { useCarrinho } from '../carrinho/useCarrinho'
import CarrinhoSheet from '../pedido/CarrinhoSheet'
import SeletorOpcoes from '../pedido/SeletorOpcoes'
import { precoUnitario } from '../preco/preco'
import StoryViewer from '../story/StoryViewer'
import CartaoPrato from './CartaoPrato'
import { DESTAQUES, pratosDoFiltro } from './filtro'
import WifiSheet from './WifiSheet'
import './lista.css'

const AVISO_ATENDENTE = 'Em breve: o garçom receberá seu chamado por aqui.'
const DURACAO_AVISO_MS = 3000

export default function ListaCardapio({ cardapio, token }: { cardapio: CardapioPublico; token: string }) {
  const { restaurante, mesa, categorias } = cardapio
  const temDestaques = categorias.some((c) => c.pratos.some((p) => p.destaque))
  const chips = [
    ...(temDestaques ? [{ id: DESTAQUES, nome: 'Destaques' }] : []),
    ...categorias.map(({ id, nome }) => ({ id, nome })),
  ]

  const [filtro, setFiltro] = useState(chips[0]?.id ?? '')
  const [wifiAberto, setWifiAberto] = useState(false)
  // `id` muda a cada aviso, para reiniciar o tempo mesmo com o mesmo texto.
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null)
  const [storyAberto, setStoryAberto] = useState<number | null>(null)
  const [pratoComOpcoes, setPratoComOpcoes] = useState<PratoPublico | null>(null)
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const { itens, despachar, total, quantidade } = useCarrinho(token)

  const pratos = pratosDoFiltro(cardapio, filtro)

  useEffect(() => {
    if (!aviso) return
    const temporizador = setTimeout(() => setAviso(null), DURACAO_AVISO_MS)
    return () => clearTimeout(temporizador)
  }, [aviso])

  const mostrarAviso = (texto: string) => setAviso({ texto, id: Date.now() })

  const adicionarAoPedido = (item: Omit<ItemCarrinho, 'id'>) => {
    despachar({ tipo: 'adicionar', item })
    mostrarAviso('Adicionado ao pedido')
  }

  const aoAdicionar = (prato: PratoPublico) => {
    if (prato.grupos.length > 0) {
      setPratoComOpcoes(prato)
      return
    }
    adicionarAoPedido({
      pratoId: prato.id,
      nome: prato.nome,
      resumoOpcoes: '',
      selecao: {},
      observacao: '',
      quantidade: 1,
      precoUnitarioCentavos: precoUnitario(prato, {}),
    })
  }

  return (
    <div className="lista-tela">
      <header className="topo">
        {restaurante.logoUrl ? (
          <img className="logo" src={restaurante.logoUrl} alt="" />
        ) : (
          <span className="logo" aria-hidden="true">
            {restaurante.nome.charAt(0)}
          </span>
        )}
        <div>
          <h1 className="topo-nome">{restaurante.nome}</h1>
          <p className="topo-mesa">{`Mesa ${mesa.numero}`}</p>
        </div>
        {restaurante.wifi && (
          <button type="button" className="topo-wifi" onClick={() => setWifiAberto(true)}>
            📶 Wi-Fi
          </button>
        )}
      </header>

      <nav className="chips" aria-label="Categorias">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`chip${chip.id === filtro ? ' chip--ativo' : ''}`}
            aria-pressed={chip.id === filtro}
            onClick={() => setFiltro(chip.id)}
          >
            {chip.nome}
          </button>
        ))}
      </nav>

      <main className="lista">
        {pratos.map((prato, i) => (
          <CartaoPrato key={prato.id} prato={prato} onAbrir={() => setStoryAberto(i)} />
        ))}

        {restaurante.googleAvaliacaoUrl && (
          <a className="avaliar" href={restaurante.googleAvaliacaoUrl} target="_blank" rel="noopener noreferrer">
            ⭐ Avalie no Google
          </a>
        )}
      </main>

      {aviso && (
        <p className="aviso" role="status">
          {aviso.texto}
        </p>
      )}

      <footer className="barra-fundo">
        <button type="button" className="botao botao--secundario" onClick={() => mostrarAviso(AVISO_ATENDENTE)}>
          🙋 Chamar atendente
        </button>
        <button type="button" className="botao botao--primario" onClick={() => setCarrinhoAberto(true)}>
          {`🧾 Realizar pedido (${quantidade})`}
        </button>
      </footer>

      {storyAberto !== null && (
        <StoryViewer
          pratos={pratos}
          indiceInicial={storyAberto}
          onFechar={() => setStoryAberto(null)}
          onAdicionar={aoAdicionar}
        />
      )}

      {pratoComOpcoes && (
        <SeletorOpcoes
          prato={pratoComOpcoes}
          onCancelar={() => setPratoComOpcoes(null)}
          onConfirmar={(item) => {
            adicionarAoPedido(item)
            setPratoComOpcoes(null)
          }}
        />
      )}

      {carrinhoAberto && (
        <CarrinhoSheet itens={itens} total={total} despachar={despachar} onFechar={() => setCarrinhoAberto(false)} />
      )}

      {wifiAberto && restaurante.wifi && (
        <WifiSheet ssid={restaurante.wifi.ssid} senha={restaurante.wifi.senha} onFechar={() => setWifiAberto(false)} />
      )}
    </div>
  )
}

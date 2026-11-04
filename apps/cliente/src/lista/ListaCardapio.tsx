import { useState } from 'react'
import type { CardapioPublico } from '../api/tipos'
import { useCarrinho } from '../carrinho/useCarrinho'
import StoryViewer from '../story/StoryViewer'
import CartaoPrato from './CartaoPrato'
import { DESTAQUES, pratosDoFiltro } from './filtro'
import WifiSheet from './WifiSheet'
import './lista.css'

const AVISO_ATENDENTE = 'Em breve: o garçom receberá seu chamado por aqui.'

export default function ListaCardapio({ cardapio, token }: { cardapio: CardapioPublico; token: string }) {
  const { restaurante, mesa, categorias } = cardapio
  const temDestaques = categorias.some((c) => c.pratos.some((p) => p.destaque))
  const chips = [
    ...(temDestaques ? [{ id: DESTAQUES, nome: 'Destaques' }] : []),
    ...categorias.map(({ id, nome }) => ({ id, nome })),
  ]

  const [filtro, setFiltro] = useState(chips[0]?.id ?? '')
  const [wifiAberto, setWifiAberto] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [storyAberto, setStoryAberto] = useState<number | null>(null)
  const { quantidade } = useCarrinho(token)

  const pratos = pratosDoFiltro(cardapio, filtro)

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
          {aviso}
        </p>
      )}

      <footer className="barra-fundo">
        <button type="button" className="botao botao--secundario" onClick={() => setAviso(AVISO_ATENDENTE)}>
          🙋 Chamar atendente
        </button>
        <button type="button" className="botao botao--primario">
          {`🧾 Realizar pedido (${quantidade})`}
        </button>
      </footer>

      {storyAberto !== null && (
        <StoryViewer
          pratos={pratos}
          indiceInicial={storyAberto}
          onFechar={() => setStoryAberto(null)}
          onAdicionar={() => {}}
        />
      )}

      {wifiAberto && restaurante.wifi && (
        <WifiSheet ssid={restaurante.wifi.ssid} senha={restaurante.wifi.senha} onFechar={() => setWifiAberto(false)} />
      )}
    </div>
  )
}

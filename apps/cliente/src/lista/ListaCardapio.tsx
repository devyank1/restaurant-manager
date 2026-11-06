import { useEffect, useState } from 'react'
import type { CardapioPublico, PratoPublico } from '../api/tipos'
import { chamarAtendente } from '../api/mesa'
import type { ItemCarrinho } from '../carrinho/carrinho'
import { useCarrinhoMesa } from '../carrinho/useCarrinhoMesa'
import CarrinhoSheet from '../pedido/CarrinhoSheet'
import PedidosSheet from '../pedido/PedidosSheet'
import SeletorOpcoes from '../pedido/SeletorOpcoes'
import { useRodadas } from '../pedido/useRodadas'
import { precoUnitario } from '../preco/preco'
import StoryViewer from '../story/StoryViewer'
import { useMesaAoVivo } from '../tempo-real/useMesaAoVivo'
import CartaoPrato from './CartaoPrato'
import { DESTAQUES, pratosDoFiltro } from './filtro'
import WifiSheet from './WifiSheet'
import './lista.css'

const AVISO_ENVIADO = 'Pedido enviado! O garçom vai confirmar na mesa.'
const AVISO_CONFIRMADO = 'Pedido enviado e confirmado!'
const AVISO_CHAMADO = 'Garçom chamado! Ele já está a caminho.'
const SEM_CONEXAO = 'Sem conexão. Tente de novo.'
const DURACAO_AVISO_MS = 3000
const DURACAO_AVISO_CHAMADO_MS = 5000

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
  const [aviso, setAviso] = useState<{ texto: string; id: number; duracao: number } | null>(null)
  const [storyAberto, setStoryAberto] = useState<number | null>(null)
  const [pratoComOpcoes, setPratoComOpcoes] = useState<PratoPublico | null>(null)
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const [pedidosAberto, setPedidosAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const mostrarAviso = (texto: string, duracao = DURACAO_AVISO_MS) => setAviso({ texto, id: Date.now(), duracao })
  const carrinho = useCarrinhoMesa(token, mostrarAviso)
  const { itens, despachar, total, quantidade } = carrinho
  const rodadas = useRodadas(token)

  useMesaAoVivo(token, {
    carrinho: (atual) => (atual ? carrinho.aplicar(atual) : carrinho.recarregar()),
    rodadas: rodadas.recarregar,
    // Garçom atendeu antes dos 5 s: o aviso do chamado sai na hora.
    atendido: () => setAviso((atual) => (atual?.texto === AVISO_CHAMADO ? null : atual)),
  })

  const pratos = pratosDoFiltro(cardapio, filtro)

  useEffect(() => {
    if (!aviso) return
    const temporizador = setTimeout(() => setAviso(null), aviso.duracao)
    return () => clearTimeout(temporizador)
  }, [aviso])

  const adicionarAoPedido = async (item: Omit<ItemCarrinho, 'id'>) => {
    if (await despachar({ tipo: 'adicionar', item })) mostrarAviso('Adicionado ao pedido')
  }

  const enviarPedido = async () => {
    setEnviando(true)
    const rodada = await carrinho.enviar()
    setEnviando(false)
    rodadas.recarregar()
    if (rodada) {
      setCarrinhoAberto(false)
      mostrarAviso(rodada.status === 'CONFIRMADA' ? AVISO_CONFIRMADO : AVISO_ENVIADO)
    }
  }

  const chamarGarcom = () => {
    chamarAtendente(token)
      .then(() => mostrarAviso(AVISO_CHAMADO, DURACAO_AVISO_CHAMADO_MS))
      .catch(() => mostrarAviso(SEM_CONEXAO))
  }

  const aoAdicionar = (prato: PratoPublico) => {
    if (prato.grupos.length > 0) {
      setPratoComOpcoes(prato)
      return
    }
    void adicionarAoPedido({
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
        {rodadas.rodadas.length > 0 && (
          <button type="button" className="topo-wifi" onClick={() => setPedidosAberto(true)}>
            Pedidos
          </button>
        )}
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
        <button type="button" className="botao botao--secundario" onClick={chamarGarcom}>
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
            void adicionarAoPedido(item)
            setPratoComOpcoes(null)
          }}
        />
      )}

      {carrinhoAberto && (
        <CarrinhoSheet
          itens={itens}
          total={total}
          despachar={despachar}
          onEnviar={() => void enviarPedido()}
          enviando={enviando}
          onFechar={() => setCarrinhoAberto(false)}
        />
      )}

      {pedidosAberto && (
        <PedidosSheet
          rodadas={rodadas.rodadas}
          totalParcialCentavos={rodadas.totalParcialCentavos}
          onFechar={() => setPedidosAberto(false)}
        />
      )}

      {wifiAberto && restaurante.wifi && (
        <WifiSheet ssid={restaurante.wifi.ssid} senha={restaurante.wifi.senha} onFechar={() => setWifiAberto(false)} />
      )}
    </div>
  )
}

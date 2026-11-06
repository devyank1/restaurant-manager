import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardapioPublico } from '../api/tipos'
import { reais } from '../test/reais'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { cardapioDemo } from '../test/fixtures'
import { ultimoSocket } from '../test/socket-falso'
import ListaCardapio from './ListaCardapio'
import { pratosDoFiltro } from './filtro'

const cartao = (nome: string) => screen.getByRole('button', { name: new RegExp(nome) })

const semDestaques = (): CardapioPublico => ({
  ...cardapioDemo,
  categorias: cardapioDemo.categorias.map((c) => ({
    ...c,
    pratos: c.pratos.map((p) => ({ ...p, destaque: false })),
  })),
})

const mixNoCarrinho = (quantidade: number) => ({
  id: 'x',
  pratoId: 'mix',
  nome: 'Mix da Casa',
  resumoOpcoes: '',
  selecao: {},
  observacao: '',
  quantidade,
  precoUnitarioCentavos: 5990,
})

describe('ListaCardapio', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    vi.stubGlobal('fetch', api.fetch)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('começa no chip Destaques com os pratos em destaque', () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    const chips = screen.getAllByRole('button', { pressed: true })
    expect(chips.map((c) => c.textContent)).toEqual(['Destaques'])
    expect(cartao('Mix da Casa')).toBeInTheDocument()
    expect(cartao('Pizza Margherita')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Chopp 500ml/ })).not.toBeInTheDocument()
  })

  it('filtra por categoria ao tocar no chip', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(screen.getByRole('button', { name: 'Bebidas' }))
    expect(cartao('Chopp 500ml')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mix da Casa/ })).not.toBeInTheDocument()
  })

  it('sem destaques não mostra o chip Destaques e começa na primeira categoria', () => {
    render(<ListaCardapio cardapio={semDestaques()} token="t" />)
    expect(screen.queryByRole('button', { name: 'Destaques' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entradas', pressed: true })).toBeInTheDocument()
  })

  it('mostra preço com desconto, original riscado e percentual', () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    const mix = cartao('Mix da Casa')
    expect(within(mix).getByText(reais(5990))).toBeInTheDocument()
    expect(within(mix).getByText(reais(6990)).tagName).toBe('S')
    expect(within(mix).getByText('-14%')).toBeInTheDocument()
  })

  it('prato com tamanho mostra "a partir de" sem preço riscado', () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    const pizza = cartao('Pizza Margherita')
    expect(within(pizza).getByText(`a partir de ${reais(4990)}`)).toBeInTheDocument()
    expect(pizza.querySelector('s')).toBeNull()
  })

  it('prato esgotado aparece desabilitado', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(screen.getByRole('button', { name: 'Entradas' }))
    const pastel = cartao('Pastel de Carne Seca')
    expect(pastel).toHaveAttribute('aria-disabled', 'true')
    expect(within(pastel).getByText('Esgotado')).toBeInTheDocument()
  })

  it('mostra o número da mesa', () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    expect(screen.getByText('Mesa 7')).toBeInTheDocument()
  })

  it('botão Wi-Fi abre rede e senha para copiar', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(screen.getByRole('button', { name: /Wi-Fi/ }))
    const painel = screen.getByRole('dialog', { name: /Wi-Fi/ })
    expect(within(painel).getByText('Cantina-Clientes')).toBeInTheDocument()
    expect(within(painel).getByText('bemvindo123')).toBeInTheDocument()
    expect(within(painel).getByRole('button', { name: 'Copiar senha' })).toBeInTheDocument()
  })

  it('sem Wi-Fi configurado não mostra o botão', () => {
    const cardapio = { ...cardapioDemo, restaurante: { ...cardapioDemo.restaurante, wifi: null } }
    render(<ListaCardapio cardapio={cardapio} token="t" />)
    expect(screen.queryByRole('button', { name: /Wi-Fi/ })).not.toBeInTheDocument()
  })

  it('link de avaliação no Google abre em nova aba', () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    const link = screen.getByRole('link', { name: /Avalie no Google/ })
    expect(link).toHaveAttribute('href', 'https://g.page/r/demo/review')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('sem link do Google não mostra a avaliação', () => {
    const cardapio = {
      ...cardapioDemo,
      restaurante: { ...cardapioDemo.restaurante, googleAvaliacaoUrl: null },
    }
    render(<ListaCardapio cardapio={cardapio} token="t" />)
    expect(screen.queryByRole('link', { name: /Avalie no Google/ })).not.toBeInTheDocument()
  })

  it("Chamar atendente mostra 'Garçom chamado! Ele já está a caminho.'", async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(screen.getByRole('button', { name: /Chamar atendente/ }))
    expect(await screen.findByText('Garçom chamado! Ele já está a caminho.')).toBeInTheDocument()
    expect(api.chamadas('POST', /\/api\/publico\/mesas\/t\/chamados$/)).toHaveLength(1)
  })

  it('aviso do chamado some sozinho depois de 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
      await userEvent.click(screen.getByRole('button', { name: /Chamar atendente/ }))
      await screen.findByText('Garçom chamado! Ele já está a caminho.')
      act(() => vi.advanceTimersByTime(4900))
      expect(screen.getByText('Garçom chamado! Ele já está a caminho.')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(100))
      expect(screen.queryByText('Garçom chamado! Ele já está a caminho.')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('pedido que entra confirmado avisa sem prometer confirmação', async () => {
    api.estado.itens = [mixNoCarrinho(1)]
    api.uma('POST', /\/rodadas$/, () => {
      api.estado.itens = []
      return {
        status: 201,
        corpo: { id: 'r', status: 'CONFIRMADA', criadoEm: '2026-11-06T20:00:00.000Z', totalCentavos: 5990, itens: [] },
      }
    })
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(await screen.findByRole('button', { name: /Realizar pedido \(1\)/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    expect(await screen.findByText('Pedido enviado e confirmado!')).toBeInTheDocument()
  })

  it('evento chamado-atendido some com o aviso de espera', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(screen.getByRole('button', { name: /Chamar atendente/ }))
    await screen.findByText('Garçom chamado! Ele já está a caminho.')
    api.estado.chamadoAberto = false
    act(() => ultimoSocket().servidor('chamado-atendido', { chamadoId: 'c1' }))
    await waitFor(() =>
      expect(screen.queryByText('Garçom chamado! Ele já está a caminho.')).not.toBeInTheDocument(),
    )
  })

  it('tocar no cartão abre o story no prato tocado', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(cartao('Pizza Margherita'))
    expect(screen.getByRole('dialog', { name: 'Pizza Margherita' })).toBeInTheDocument()
    expect(screen.getByText('2 de 2')).toBeInTheDocument()
  })

  it('adicionar chama a API e mostra o carrinho devolvido', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(cartao('Mix da Casa'))
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar ao pedido' }))
    expect(await screen.findByText('Adicionado ao pedido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Realizar pedido \(1\)/ })).toBeInTheDocument()
    expect(api.chamadas('POST', /\/carrinho\/itens$/)).toHaveLength(1)
  })

  it('evento carrinho de outro celular atualiza a contagem de Realizar pedido', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await screen.findByRole('button', { name: /Realizar pedido \(0\)/ })
    act(() => ultimoSocket().servidor('carrinho', { itens: [mixNoCarrinho(2)], totalCentavos: 11980, versao: 1e12 }))
    expect(screen.getByRole('button', { name: /Realizar pedido \(2\)/ })).toBeInTheDocument()
  })

  it('conecta o tempo real e pede para entrar na mesa', () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    act(() => ultimoSocket().servidor('connect'))
    expect(ultimoSocket().emitidos).toContainEqual({ evento: 'entrar-mesa', dados: { token: 't' } })
  })

  it('toda conexão, inclusive a primeira, busca carrinho e pedidos', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await screen.findByRole('button', { name: /Realizar pedido \(0\)/ })
    api.estado.itens = [mixNoCarrinho(2)]
    act(() => ultimoSocket().servidor('connect'))
    expect(await screen.findByRole('button', { name: /Realizar pedido \(2\)/ })).toBeInTheDocument()
  })

  it('desbloquear o celular refaz a conexão ao vivo na hora', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    const socket = ultimoSocket()
    act(() => socket.servidor('connect'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // Conexão "zumbi" do bloqueio é trocada por uma nova (que reentra na mesa).
    expect(socket.reconexoes).toBe(1)
    expect(socket.desconectado).toBe(false)
  })

  it('voltar a ter rede também refaz a conexão', () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    const socket = ultimoSocket()
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(socket.reconexoes).toBe(1)
  })

  it('voltar a aba recarrega carrinho e pedidos', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await screen.findByRole('button', { name: /Realizar pedido \(0\)/ })
    api.estado.itens = [mixNoCarrinho(4)]
    const antes = api.chamadas('GET', /\/rodadas$/).length
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(await screen.findByRole('button', { name: /Realizar pedido \(4\)/ })).toBeInTheDocument()
    await waitFor(() => expect(api.chamadas('GET', /\/rodadas$/).length).toBeGreaterThan(antes))
  })

  it('Enviar pedido esvazia o carrinho e mostra o aviso', async () => {
    api.estado.itens = [mixNoCarrinho(1)]
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(await screen.findByRole('button', { name: /Realizar pedido \(1\)/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    expect(await screen.findByText('Pedido enviado! O garçom vai confirmar na mesa.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Seu pedido' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Realizar pedido \(0\)/ })).toBeInTheDocument()
  })

  it('409 de esgotado mostra a mensagem e recarrega o carrinho', async () => {
    api.estado.itens = [mixNoCarrinho(1)]
    api.uma('POST', /\/rodadas$/, () => {
      api.estado.itens = []
      return { status: 409, corpo: { mensagem: 'Mix da Casa esgotou', pratoIds: ['mix'] } }
    })
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(await screen.findByRole('button', { name: /Realizar pedido \(1\)/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    expect(await screen.findByText('Mix da Casa esgotou')).toBeInTheDocument()
    expect(await screen.findByText('Seu pedido está vazio')).toBeInTheDocument()
  })

  it('faixa Seus pedidos aparece com rodadas, mostra status e total, e abre a lista', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await screen.findByRole('button', { name: /Realizar pedido/ })
    expect(screen.queryByRole('button', { name: /Seus pedidos/ })).not.toBeInTheDocument()
    api.estado.rodadas = [
      {
        id: 'r1',
        status: 'CONFIRMADA',
        criadoEm: '2026-11-06T20:00:00.000Z',
        totalCentavos: 5990,
        itens: [{ nome: 'Mix da Casa', resumoOpcoes: '', observacao: '', quantidade: 1, precoUnitarioCentavos: 5990 }],
      },
    ]
    api.estado.totalParcialCentavos = 5990
    act(() => ultimoSocket().servidor('rodadas-mudaram'))
    const faixa = await screen.findByRole('button', { name: /Seus pedidos/ })
    expect(within(faixa).getByText('Confirmado')).toBeInTheDocument()
    expect(within(faixa).getByText(reais(5990))).toBeInTheDocument()

    api.estado.rodadas = [...api.estado.rodadas, { ...api.estado.rodadas[0], id: 'r2', status: 'AGUARDANDO_GARCOM' }]
    act(() => ultimoSocket().servidor('rodadas-mudaram'))
    expect(await within(faixa).findByText('Aguardando garçom')).toBeInTheDocument()

    await userEvent.click(faixa)
    expect(screen.getByRole('dialog', { name: 'Seus pedidos' })).toBeInTheDocument()
  })

  it('o aviso some depois de alguns segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
      await userEvent.click(cartao('Mix da Casa'))
      await userEvent.click(screen.getByRole('button', { name: '+ Adicionar ao pedido' }))
      expect(await screen.findByText('Adicionado ao pedido')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(3000))
      expect(screen.queryByText('Adicionado ao pedido')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('adicionar prato com opções abre o seletor', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(cartao('Pizza Margherita'))
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar ao pedido' }))
    expect(screen.getByRole('dialog', { name: 'Opções de Pizza Margherita' })).toBeInTheDocument()
  })

  it('Realizar pedido abre o carrinho', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(screen.getByRole('button', { name: /Realizar pedido/ }))
    expect(screen.getByRole('dialog', { name: 'Seu pedido' })).toBeInTheDocument()
    expect(screen.getByText('Seu pedido está vazio')).toBeInTheDocument()
  })

  it('mostra Realizar pedido com a quantidade do carrinho da mesa', async () => {
    api.estado.itens = [mixNoCarrinho(3)]
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    expect(await screen.findByRole('button', { name: /Realizar pedido \(3\)/ })).toBeInTheDocument()
  })
})

describe('pratosDoFiltro', () => {
  it('destaques reúne pratos de todas as categorias', () => {
    expect(pratosDoFiltro(cardapioDemo, 'destaques').map((p) => p.nome)).toEqual([
      'Mix da Casa',
      'Pizza Margherita',
    ])
  })

  it('id de categoria devolve os pratos dela', () => {
    expect(pratosDoFiltro(cardapioDemo, 'bebidas').map((p) => p.nome)).toEqual(['Chopp 500ml'])
  })
})

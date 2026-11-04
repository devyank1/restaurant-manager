import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardapioPublico } from '../api/tipos'
import { reais } from '../test/reais'
import { cardapioDemo } from '../test/fixtures'
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

describe('ListaCardapio', () => {
  beforeEach(() => {
    localStorage.clear()
  })

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

  it('Chamar atendente avisa que chega em breve', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(screen.getByRole('button', { name: /Chamar atendente/ }))
    expect(
      screen.getByText('Em breve: o garçom receberá seu chamado por aqui.'),
    ).toBeInTheDocument()
  })

  it('tocar no cartão abre o story no prato tocado', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(cartao('Pizza Margherita'))
    expect(screen.getByRole('dialog', { name: 'Pizza Margherita' })).toBeInTheDocument()
    expect(screen.getByText('2 de 2')).toBeInTheDocument()
  })

  it('adicionar prato sem opções pelo story soma no pedido', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await userEvent.click(cartao('Mix da Casa'))
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar ao pedido' }))
    expect(screen.getByText('Adicionado ao pedido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Realizar pedido \(1\)/ })).toBeInTheDocument()
  })

  it('o aviso some depois de alguns segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
      await userEvent.click(screen.getByRole('button', { name: /Chamar atendente/ }))
      expect(screen.getByRole('status')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(3000))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
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

  it('mostra Realizar pedido com a quantidade do carrinho', () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    expect(screen.getByRole('button', { name: /Realizar pedido \(0\)/ })).toBeInTheDocument()
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

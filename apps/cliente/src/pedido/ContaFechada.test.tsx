import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ListaCardapio from '../lista/ListaCardapio'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { cardapioDemo } from '../test/fixtures'
import { ultimoSocket } from '../test/socket-falso'

describe('Conta fechada', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    vi.stubGlobal('fetch', api.fetch)
  })

  afterEach(() => vi.unstubAllGlobals())

  const entradas = () => api.chamadas('POST', /\/entrar$/).length

  it('conta-fechada pelo socket mostra Obrigado e Avalie no Google em destaque', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await screen.findByRole('button', { name: /Realizar pedido/ })
    api.estado.contaFechada = true
    act(() => ultimoSocket().servidor('conta-fechada'))
    const tela = await screen.findByRole('dialog', { name: 'Conta fechada' })
    expect(tela).toHaveTextContent('Obrigado pela visita!')
    const avaliar = screen.getAllByRole('link', { name: /Avalie no Google/ })
    expect(avaliar.some((a) => a.classList.contains('avaliar--destaque'))).toBe(true)
  })

  it('voltando com a conta já fechada (403 CONTA_FECHADA) mostra a tela sem entrar sozinho', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await screen.findByRole('button', { name: /Realizar pedido/ })
    const antes = entradas()
    api.estado.contaFechada = true
    act(() => ultimoSocket().servidor('connect'))
    expect(await screen.findByRole('dialog', { name: 'Conta fechada' })).toBeInTheDocument()
    expect(entradas()).toBe(antes)
  })

  it('Voltar ao cardápio entra de novo, fecha a tela e o Avalie fica em destaque', async () => {
    render(<ListaCardapio cardapio={cardapioDemo} token="t" />)
    await screen.findByRole('button', { name: /Realizar pedido/ })
    api.estado.contaFechada = true
    act(() => ultimoSocket().servidor('conta-fechada'))
    await screen.findByRole('dialog', { name: 'Conta fechada' })
    const antes = entradas()
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao cardápio' }))
    expect(entradas()).toBe(antes + 1)
    expect(screen.queryByRole('dialog', { name: 'Conta fechada' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Avalie no Google/ })).toHaveClass('avaliar--destaque')
  })
})

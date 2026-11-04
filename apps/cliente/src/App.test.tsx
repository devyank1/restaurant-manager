import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { cardapioDemo } from './test/fixtures'

const resposta = (status: number, corpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(corpo), { status }))

describe('App', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/m/token-da-mesa')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('busca o cardápio pelo token e mostra o restaurante', async () => {
    fetchMock.mockReturnValueOnce(resposta(200, cardapioDemo))
    render(<App />)
    expect(await screen.findByText('Cantina Demo')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/publico/mesas/token-da-mesa/cardapio')
  })

  it('mesa inexistente mostra "Mesa não encontrada"', async () => {
    fetchMock.mockReturnValueOnce(resposta(404, { mensagem: 'Mesa não encontrada' }))
    render(<App />)
    expect(await screen.findByText('Mesa não encontrada')).toBeInTheDocument()
    expect(screen.getByText('Peça ajuda ao atendente.')).toBeInTheDocument()
  })

  it('falha de rede permite tentar novamente', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    fetchMock.mockReturnValueOnce(resposta(200, cardapioDemo))
    render(<App />)
    expect(await screen.findByText('Não foi possível carregar o cardápio')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Cantina Demo')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('URL sem token mostra "Mesa não encontrada" sem buscar', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByText('Mesa não encontrada')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

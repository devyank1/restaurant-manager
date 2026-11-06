import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { irPara } from './navegacao'
import { criarApiFalsa, type ApiFalsa } from './test/api-falsa'

vi.mock('./navegacao', () => ({ irPara: vi.fn() }))

describe('App', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    vi.stubGlobal('fetch', api.fetch)
    window.history.pushState({}, '', '/m/token-da-mesa')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(irPara).mockReset()
  })

  it('entra na mesa antes de buscar o cardápio', async () => {
    render(<App />)
    expect(await screen.findByText('Cantina Demo')).toBeInTheDocument()
    expect(screen.getByText('Mesa 7')).toBeInTheDocument()
    const urls = api.fetch.mock.calls.map(([url]) => String(url))
    const entrar = urls.indexOf('/api/publico/mesas/token-da-mesa/entrar')
    const cardapio = urls.indexOf('/api/publico/mesas/token-da-mesa/cardapio')
    expect(entrar).toBeGreaterThanOrEqual(0)
    expect(entrar).toBeLessThan(cardapio)
  })

  it('com sessão de equipe redireciona para o app do garçom', async () => {
    api.estado.equipe = true
    window.history.pushState({}, '', '/m/token-da-mesa')
    render(<App />)
    await vi.waitFor(() => expect(irPara).toHaveBeenCalledWith('http://localhost:5174/mesa/token-da-mesa'))
    expect(api.chamadas('POST', /entrar$/)).toHaveLength(0)
  })

  it('mesa inexistente mostra "Mesa não encontrada"', async () => {
    api.uma('POST', /entrar$/, () => ({ status: 404, corpo: { mensagem: 'Mesa não encontrada' } }))
    render(<App />)
    expect(await screen.findByText('Mesa não encontrada')).toBeInTheDocument()
    expect(screen.getByText('Peça ajuda ao atendente.')).toBeInTheDocument()
  })

  it('API recusando o token (400) também mostra "Mesa não encontrada"', async () => {
    api.uma('POST', /entrar$/, () => ({ status: 400, corpo: { message: 'Failed to decode param' } }))
    render(<App />)
    expect(await screen.findByText('Mesa não encontrada')).toBeInTheDocument()
  })

  it('falha de rede permite tentar novamente', async () => {
    api.uma('GET', /cardapio$/, () => ({ status: 503 }))
    render(<App />)
    expect(await screen.findByText('Não foi possível carregar o cardápio')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Cantina Demo')).toBeInTheDocument()
  })

  it('URL sem token mostra "Mesa não encontrada" sem buscar', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByText('Mesa não encontrada')).toBeInTheDocument()
    expect(api.fetch).not.toHaveBeenCalled()
  })
})

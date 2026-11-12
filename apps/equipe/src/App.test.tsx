import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ana, criarApiFalsa, dani, type ApiFalsa } from './test/api-falsa'
import { carla } from './test/estoque-fixtures'

async function entrar(senha = 'demo1234') {
  await userEvent.type(await screen.findByLabelText('E-mail'), 'ana@demo.com')
  await userEvent.type(screen.getByLabelText('Senha'), senha)
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('App da equipe', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    vi.stubGlobal('fetch', api.fetch)
  })

  it('sem sessão abre o login', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('login certo vai para o início', async () => {
    render(<App />)
    await entrar()
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('login certo com volta vai para a tela de antes', async () => {
    window.history.replaceState({}, '', '/login?volta=%2Fmesas')
    render(<App />)
    await entrar()
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/mesas')
  })

  it("login errado mostra 'E-mail ou senha inválidos'", async () => {
    render(<App />)
    await entrar('errada')
    expect(await screen.findByText('E-mail ou senha inválidos')).toBeInTheDocument()
  })

  it('cozinha logada cai na produção, sem interruptor de turno', async () => {
    api.estado.usuario = { ...dani }
    api.estado.producao = { Cozinha: [] }
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Cozinha' })).toBeInTheDocument()
    expect(screen.getByText('Dani')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Em turno' })).not.toBeInTheDocument()
    expect(screen.queryByText('Chamados')).not.toBeInTheDocument()
  })

  it('sessão aberta vai direto para o início', async () => {
    api.estado.usuario = { ...ana }
    render(<App />)
    expect(await screen.findByText('Ana')).toBeInTheDocument()
  })

  it('401 no meio do uso leva ao login com volta', async () => {
    api.estado.usuario = { ...ana }
    window.history.replaceState({}, '', '/mesas')
    render(<App />)
    const interruptor = await screen.findByRole('switch', { name: 'Em turno' })
    api.estado.usuario = null
    await userEvent.click(interruptor)
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(new URLSearchParams(window.location.search).get('volta')).toBe('/mesas')
  })

  it('dono não abre mesas nem produção: cai no início', async () => {
    api.estado.usuario = { ...carla }
    window.history.replaceState({}, '', '/mesas')
    const { unmount } = render(<App />)
    expect(await screen.findByRole('button', { name: 'Estoque' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Todas as mesas' })).not.toBeInTheDocument()
    unmount()
    window.history.replaceState({}, '', '/producao')
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Estoque' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cozinha' })).not.toBeInTheDocument()
  })

  it('dono não tem interruptor de turno', async () => {
    api.estado.usuario = { ...carla }
    window.history.replaceState({}, '', '/')
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Estoque' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Em turno' })).not.toBeInTheDocument()
  })

  it('Voltar no topo leva para a tela de cima; no início não aparece', async () => {
    api.estado.usuario = { ...carla }
    window.history.replaceState({}, '', '/estoque/itens')
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Voltar' }))
    expect(window.location.pathname).toBe('/estoque')
    await userEvent.click(await screen.findByRole('button', { name: 'Voltar' }))
    expect(window.location.pathname).toBe('/')
    expect(await screen.findByRole('button', { name: 'Estoque' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
  })

  it('garçom tem Voltar na lista de mesas', async () => {
    api.estado.usuario = { ...ana }
    window.history.replaceState({}, '', '/mesas')
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Voltar' }))
    expect(window.location.pathname).toBe('/')
  })

  it('Sair encerra a sessão e volta ao login', async () => {
    api.estado.usuario = { ...ana }
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }))
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(api.chamadas('POST', /\/api\/equipe\/logout$/)).toHaveLength(1)
  })
})

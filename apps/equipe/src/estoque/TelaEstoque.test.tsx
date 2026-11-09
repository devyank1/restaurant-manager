import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { ana, criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla, estoqueDemo } from '../test/estoque-fixtures'
import { ultimoSocket } from '../test/socket-falso'
import TelaEstoque from './TelaEstoque'

describe('Início do estoque', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    api.estado.estoque = estoqueDemo()
    vi.stubGlobal('fetch', api.fetch)
    window.history.pushState({}, '', '/estoque')
  })

  it('mostra Acabando, Acabou com Marcar como esgotado e Perdas de hoje', async () => {
    render(<TelaEstoque />)
    const acabando = await screen.findByRole('region', { name: 'Acabando' })
    expect(within(acabando).getByText('Ovos')).toBeInTheDocument()
    expect(within(acabando).getByText('20 un')).toBeInTheDocument()

    const acabou = screen.getByRole('region', { name: 'Acabou' })
    expect(within(acabou).getByText('Queijo')).toBeInTheDocument()
    await userEvent.click(within(acabou).getByRole('button', { name: 'Marcar Pizza Margherita como esgotado' }))
    const [, init] = api.chamadas('PATCH', /\/api\/equipe\/pratos\/p1$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({ esgotado: true })
    const feito = await within(acabou).findByRole('button', { name: 'Pizza Margherita esgotado' })
    expect(feito).toBeDisabled()
    expect(feito).toHaveTextContent('Esgotado ✓')

    const perdas = screen.getByRole('region', { name: 'Perdas de hoje' })
    expect(within(perdas).getByText('30 un de Ovos · Acidente')).toBeInTheDocument()
  })

  it('sem nada mostra Tudo em dia', async () => {
    api.estado.estoque.resumo = { acabando: [], acabou: [], perdasHoje: [], listaAberta: null }
    render(<TelaEstoque />)
    expect(await screen.findByText('Tudo em dia ✓')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chegou compra' })).not.toBeInTheDocument()
  })

  it('lista aberta mostra Chegou compra', async () => {
    api.estado.estoque.resumo.listaAberta = { id: 'l9', criadaEm: new Date().toISOString() }
    render(<TelaEstoque />)
    await userEvent.click(await screen.findByRole('button', { name: 'Chegou compra' }))
    expect(window.location.pathname).toBe('/estoque/compras/l9/chegou')
  })

  it('Gerar lista de compras leva para as compras', async () => {
    render(<TelaEstoque />)
    await userEvent.click(await screen.findByRole('button', { name: 'Gerar lista de compras' }))
    expect(window.location.pathname).toBe('/estoque/compras')
  })

  it('socket estoque-mudou recarrega', async () => {
    render(<TelaEstoque />)
    await screen.findByRole('region', { name: 'Acabando' })
    api.estado.estoque.resumo = { acabando: [], acabou: [], perdasHoje: [], listaAberta: null }
    act(() => ultimoSocket().servidor('estoque-mudou'))
    expect(await screen.findByText('Tudo em dia ✓')).toBeInTheDocument()
  })

  it('garçom em /estoque vê o início normal', async () => {
    api.estado.usuario = { ...ana }
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Todas as mesas' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Estoque' })).not.toBeInTheDocument()
  })

  it('dono vê o botão Estoque com quantos precisam de atenção', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    const botao = await screen.findByRole('button', { name: 'Estoque · 2 acabando' })
    await userEvent.click(botao)
    expect(await screen.findByRole('heading', { name: 'Estoque' })).toBeInTheDocument()
  })
})

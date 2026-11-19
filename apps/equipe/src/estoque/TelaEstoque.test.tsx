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
    api.estado.estoque.resumo = { acabando: [], acabou: [], perdasHoje: [], listasAbertas: [] }
    render(<TelaEstoque />)
    expect(await screen.findByText('Tudo em dia ✓')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chegou compra' })).not.toBeInTheDocument()
  })

  it('lista aberta mostra Chegou compra com o fornecedor', async () => {
    api.estado.estoque.resumo.listasAbertas = [{ id: 'l9', criadaEm: new Date().toISOString(), fornecedores: ['Granja Boa'] }]
    render(<TelaEstoque />)
    await userEvent.click(await screen.findByRole('button', { name: 'Chegou compra · Granja Boa' }))
    expect(window.location.pathname).toBe('/estoque/compras/l9/chegou')
  })

  it('duas listas abertas mostram um Chegou compra para cada, com a data', async () => {
    api.estado.estoque.resumo.listasAbertas = [
      { id: 'l2', criadaEm: '2026-11-09T15:00:00.000Z', fornecedores: ['Granja Boa'] },
      { id: 'l1', criadaEm: '2026-11-07T15:00:00.000Z', fornecedores: [] },
    ]
    render(<TelaEstoque />)
    await userEvent.click(await screen.findByRole('button', { name: 'Chegou compra · 07/11' }))
    expect(window.location.pathname).toBe('/estoque/compras/l1/chegou')
    expect(screen.getByRole('button', { name: 'Chegou compra · Granja Boa · 09/11' })).toBeInTheDocument()
  })

  it('gerente desfaz o último lançamento dele pela barra Desfazer', async () => {
    api.estado.estoque.desfazivel = {
      lote: 'lote-9',
      descricao: 'Contagem de Ovos',
      ate: new Date(Date.now() + 600_000).toISOString(),
    }
    render(<TelaEstoque />)
    const barra = await screen.findByRole('region', { name: 'Desfazer' })
    expect(within(barra).getByText('Contagem de Ovos')).toBeInTheDocument()
    await userEvent.click(within(barra).getByRole('button', { name: 'Desfazer' }))
    expect(api.chamadas('POST', /\/estoque\/desfazer$/)).toHaveLength(1)
    expect(await screen.findByRole('status')).toHaveTextContent('Desfeito')
    expect(screen.queryByRole('region', { name: 'Desfazer' })).not.toBeInTheDocument()
  })

  it('Gerar lista de compras leva para as compras', async () => {
    render(<TelaEstoque />)
    await userEvent.click(await screen.findByRole('button', { name: 'Gerar lista de compras' }))
    expect(window.location.pathname).toBe('/estoque/compras')
  })

  it('socket estoque-mudou recarrega', async () => {
    render(<TelaEstoque />)
    await screen.findByRole('region', { name: 'Acabando' })
    api.estado.estoque.resumo = { acabando: [], acabou: [], perdasHoje: [], listasAbertas: [] }
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
    window.history.pushState({}, '', '/dia')
    render(<App />)
    const botao = await screen.findByRole('button', { name: 'Estoque · 2 acabando' })
    await userEvent.click(botao)
    expect(await screen.findByRole('heading', { name: 'Estoque' })).toBeInTheDocument()
  })
})

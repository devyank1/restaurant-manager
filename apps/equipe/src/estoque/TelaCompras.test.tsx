import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla, estoqueDemo } from '../test/estoque-fixtures'
import TelaChegou from './TelaChegou'
import TelaCompras from './TelaCompras'

describe('Lista de compras', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    api.estado.estoque = estoqueDemo()
    vi.stubGlobal('fetch', api.fetch)
    window.history.pushState({}, '', '/estoque/compras')
  })

  const corpoPost = () => {
    const [, init] = api.chamadas('POST', /\/estoque\/compras$/)[0]
    return JSON.parse(String(init?.body)) as unknown
  }

  it('mostra sugestão por fornecedor e Salvar lista manda as quantidades ajustadas', async () => {
    render(<TelaCompras />)
    const granja = await screen.findByRole('region', { name: 'Granja Boa' })
    const ovos = within(granja).getByLabelText('Cartelas de Ovos')
    expect(ovos).toHaveValue('6')
    await userEvent.clear(ovos)
    await userEvent.type(ovos, '5')
    expect(screen.getByRole('region', { name: 'Sem fornecedor' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar lista' }))
    expect(corpoPost()).toEqual({
      itens: [
        { itemId: 'ovos', quantidade: 150 },
        { itemId: 'queijo', quantidade: 10000 },
      ],
    })
  })

  it('depois de salvar mostra Baixar planilha e Mandar no WhatsApp com o link certo', async () => {
    render(<TelaCompras />)
    await screen.findByRole('region', { name: 'Granja Boa' })
    await userEvent.click(screen.getByRole('button', { name: 'Salvar lista' }))
    const planilha = await screen.findByRole('link', { name: 'Baixar planilha' })
    expect(planilha).toHaveAttribute('href', '/api/equipe/estoque/compras/lista-1/planilha')
    expect(planilha).toHaveAttribute('download')
    const zap = screen.getByRole('link', { name: 'Mandar no WhatsApp para Granja Boa' })
    const href = zap.getAttribute('href')!
    expect(href.startsWith('https://wa.me/5511988887777?text=')).toBe(true)
    expect(decodeURIComponent(href.split('text=')[1])).toBe(
      'Olá, Granja Boa! Pedido do Cantina Demo:\n• Ovos: 6 Cartela (180 un)\nObrigado!',
    )
    expect(zap).toHaveAttribute('target', '_blank')
  })

  it('Tirar da lista remove a linha do envio', async () => {
    render(<TelaCompras />)
    const granja = await screen.findByRole('region', { name: 'Granja Boa' })
    await userEvent.click(within(granja).getByRole('button', { name: 'Tirar Ovos da lista' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar lista' }))
    expect(corpoPost()).toEqual({ itens: [{ itemId: 'queijo', quantidade: 10000 }] })
  })

  it('sem nada para comprar avisa', async () => {
    api.estado.estoque.sugestao = []
    render(<TelaCompras />)
    expect(await screen.findByText('Nada abaixo do mínimo agora.')).toBeInTheDocument()
  })

  it('chegou compra: confirma com a quantidade corrigida e volta ao estoque', async () => {
    api.estado.estoque.listas['lista-1'] = {
      id: 'lista-1',
      restaurante: 'Cantina Demo',
      criadaEm: new Date().toISOString(),
      chegouEm: null,
      grupos: api.estado.estoque.sugestao,
    }
    render(<TelaChegou listaId="lista-1" />)
    const ovos = await screen.findByLabelText('Cartelas de Ovos')
    await userEvent.clear(ovos)
    await userEvent.type(ovos, '4')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar chegada' }))
    const [, init] = api.chamadas('POST', /\/compras\/lista-1\/chegou$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      itens: [
        { itemId: 'ovos', quantidade: 120 },
        { itemId: 'queijo', quantidade: 10000 },
      ],
    })
    await vi.waitFor(() => expect(window.location.pathname).toBe('/estoque'))
  })

  it('chegou em unidades: 1 cartela com 5 ovos quebrados vira 25 un', async () => {
    api.estado.estoque.listas['lista-1'] = {
      id: 'lista-1',
      restaurante: 'Cantina Demo',
      criadaEm: new Date().toISOString(),
      chegouEm: null,
      grupos: api.estado.estoque.sugestao,
    }
    render(<TelaChegou listaId="lista-1" />)
    await userEvent.selectOptions(await screen.findByLabelText('Medida de Ovos'), 'un')
    const ovos = screen.getByLabelText('Quantidade de Ovos')
    await userEvent.clear(ovos)
    await userEvent.type(ovos, '25')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar chegada' }))
    const [, init] = api.chamadas('POST', /\/compras\/lista-1\/chegou$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      itens: [
        { itemId: 'ovos', quantidade: 25 },
        { itemId: 'queijo', quantidade: 10000 },
      ],
    })
  })

  it('chegou duas vezes mostra a mensagem', async () => {
    api.estado.estoque.listas['lista-1'] = {
      id: 'lista-1',
      restaurante: 'Cantina Demo',
      criadaEm: new Date().toISOString(),
      chegouEm: new Date().toISOString(),
      grupos: api.estado.estoque.sugestao,
    }
    render(<TelaChegou listaId="lista-1" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar chegada' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta compra já foi lançada')
  })
})

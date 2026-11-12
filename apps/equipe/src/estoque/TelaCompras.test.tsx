import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla, estoqueDemo } from '../test/estoque-fixtures'
import TelaChegou from './TelaChegou'
import TelaCompras from './TelaCompras'
import TelaPedido from './TelaPedido'

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

  it('mostra os fornecedores com quantos itens tem para comprar e abre o pedido', async () => {
    render(<TelaCompras />)
    const granja = await screen.findByRole('button', { name: 'Granja Boa · 1 item para comprar' })
    expect(screen.getByRole('button', { name: 'Sem fornecedor · 1 item para comprar' })).toBeInTheDocument()
    await userEvent.click(granja)
    expect(window.location.pathname).toBe('/estoque/compras/f/granja')
  })

  it('fornecedor sem nada acabando também aparece', async () => {
    api.estado.estoque.fornecedores.push({ id: 'feira', nome: 'Feira', telefone: null, observacao: null })
    render(<TelaCompras />)
    expect(await screen.findByRole('button', { name: 'Feira · nada acabando' })).toBeInTheDocument()
  })

  it('pedido do fornecedor mostra só os itens dele e Salvar pedido manda as quantidades', async () => {
    render(<TelaPedido fornecedorId="granja" />)
    expect(await screen.findByRole('heading', { name: 'Pedido · Granja Boa' })).toBeInTheDocument()
    const ovos = await screen.findByLabelText('Cartelas de Ovos')
    expect(ovos).toHaveValue('6')
    expect(screen.queryByLabelText('Quantidade de Queijo')).not.toBeInTheDocument()
    await userEvent.clear(ovos)
    await userEvent.type(ovos, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar pedido' }))
    expect(corpoPost()).toEqual({ itens: [{ itemId: 'ovos', quantidade: 150 }] })
  })

  it('depois de salvar mostra Mandar no WhatsApp e Baixar planilha', async () => {
    render(<TelaPedido fornecedorId="granja" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar pedido' }))
    const zap = await screen.findByRole('link', { name: 'Mandar no WhatsApp para Granja Boa' })
    const href = zap.getAttribute('href')!
    expect(href.startsWith('https://wa.me/5511988887777?text=')).toBe(true)
    expect(decodeURIComponent(href.split('text=')[1])).toBe(
      'Olá, Granja Boa! Pedido do Cantina Demo:\n• Ovos: 6 Cartela (180 un)\nObrigado!',
    )
    expect(zap).toHaveAttribute('target', '_blank')
    const planilha = screen.getByRole('link', { name: 'Baixar planilha' })
    expect(planilha).toHaveAttribute('href', '/api/equipe/estoque/compras/lista-1/planilha')
    expect(planilha).toHaveAttribute('download')
  })

  it('sem fornecedor: itens sem fornecedor, só planilha e dá para adicionar outro item', async () => {
    render(<TelaPedido fornecedorId="sem" />)
    expect(await screen.findByLabelText('Quantidade de Queijo')).toBeInTheDocument()
    const adicionar = screen.getByLabelText('Adicionar item')
    expect(within(adicionar).getByRole('option', { name: 'Chopp' })).toBeInTheDocument()
    expect(within(adicionar).queryByRole('option', { name: 'Ovos' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar pedido' }))
    expect(await screen.findByRole('link', { name: 'Baixar planilha' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
  })

  it('Tirar do pedido remove a linha', async () => {
    render(<TelaPedido fornecedorId="sem" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Tirar Queijo da lista' }))
    expect(screen.queryByLabelText('Quantidade de Queijo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar pedido' })).toBeDisabled()
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

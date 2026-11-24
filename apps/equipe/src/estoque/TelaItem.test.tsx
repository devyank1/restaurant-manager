import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla, estoqueDemo } from '../test/estoque-fixtures'
import TelaItem from './TelaItem'
import TelaItens from './TelaItens'

describe('Item do estoque', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    api.estado.estoque = estoqueDemo()
    vi.stubGlobal('fetch', api.fetch)
  })

  const contagem = async () => screen.findByRole('region', { name: 'Contar estoque' })

  it('contar 1,5 kg manda 1500', async () => {
    render(<TelaItem id="queijo" />)
    const sec = await contagem()
    await userEvent.type(within(sec).getByLabelText('Quantidade contada'), '1,5')
    await userEvent.selectOptions(within(sec).getByLabelText('Unidade da quantidade contada'), 'kg')
    await userEvent.click(within(sec).getByRole('button', { name: 'Salvar contagem' }))
    const [, init] = api.chamadas('POST', /\/itens\/queijo\/contagem$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({ quantidade: 1500 })
    expect(await screen.findByRole('status')).toHaveTextContent('Contagem salva')
  })

  it('diferença grande pede confirmação e cancelar não envia', async () => {
    render(<TelaItem id="ovos" />)
    const sec = await contagem()
    await userEvent.type(within(sec).getByLabelText('Quantidade contada'), '100')
    await userEvent.click(within(sec).getByRole('button', { name: 'Salvar contagem' }))
    const dialogo = screen.getByRole('alertdialog')
    expect(dialogo).toHaveTextContent('A diferença é grande (+80 un). Confirmar?')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(api.chamadas('POST', /contagem$/)).toHaveLength(0)

    await userEvent.click(within(sec).getByRole('button', { name: 'Salvar contagem' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }))
    expect(api.chamadas('POST', /contagem$/)).toHaveLength(1)
  })

  it('quantidade inválida não envia e avisa', async () => {
    render(<TelaItem id="ovos" />)
    const sec = await contagem()
    await userEvent.type(within(sec).getByLabelText('Quantidade contada'), 'abc')
    await userEvent.click(within(sec).getByRole('button', { name: 'Salvar contagem' }))
    expect(within(sec).getByRole('alert')).toHaveTextContent('Digite uma quantidade válida')
    expect(api.chamadas('POST', /contagem$/)).toHaveLength(0)
  })

  it('mostra o histórico com quem lançou', async () => {
    render(<TelaItem id="ovos" />)
    const hist = await screen.findByRole('region', { name: 'Histórico' })
    expect(await within(hist).findByText('Perda · −30 un · Dani')).toBeInTheDocument()
  })

  it('salvar item manda mínimo e cheio na unidade base', async () => {
    render(<TelaItem id="queijo" />)
    const form = await screen.findByRole('form', { name: 'Dados do item' })
    const minimo = within(form).getByLabelText('Mínimo')
    await userEvent.clear(minimo)
    await userEvent.type(minimo, '3')
    await userEvent.selectOptions(within(form).getByLabelText('Unidade do mínimo'), 'kg')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar item' }))
    const [, init] = api.chamadas('PATCH', /\/itens\/queijo$/)[0]
    expect(JSON.parse(String(init?.body))).toMatchObject({ minimo: 3000, cheio: 10000 })
  })

  it('novo item cria com nome, unidade, mínimo e cheio', async () => {
    render(<TelaItens />)
    await userEvent.click(await screen.findByRole('button', { name: 'Novo item' }))
    const form = screen.getByRole('form', { name: 'Novo item' })
    await userEvent.type(within(form).getByLabelText('Nome'), 'Farinha')
    await userEvent.selectOptions(within(form).getByLabelText('Tipo de medida'), 'G')
    await userEvent.type(within(form).getByLabelText('Mínimo'), '2')
    await userEvent.selectOptions(within(form).getByLabelText('Unidade do mínimo'), 'kg')
    await userEvent.type(within(form).getByLabelText('Nível cheio'), '10')
    await userEvent.selectOptions(within(form).getByLabelText('Unidade do nível cheio'), 'kg')
    await userEvent.click(within(form).getByRole('button', { name: 'Criar item' }))
    const [, init] = api.chamadas('POST', /\/estoque\/itens$/)[0]
    expect(JSON.parse(String(init?.body))).toMatchObject({ nome: 'Farinha', unidade: 'G', minimo: 2000, cheio: 10000 })
    expect(await screen.findByText('Farinha')).toBeInTheDocument()
  })
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla, estoqueDemo } from '../test/estoque-fixtures'
import TelaReceita from './TelaReceita'
import TelaReceitas from './TelaReceitas'

describe('Receitas', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    api.estado.estoque = estoqueDemo()
    vi.stubGlobal('fetch', api.fetch)
  })

  const corpoDe = (padrao: RegExp) => {
    const [, init] = api.chamadas('PUT', padrao)[0]
    return JSON.parse(String(init?.body)) as unknown
  }

  it('adicionar Ovos 3 un na receita do prato e salvar manda PUT com quantidade 3', async () => {
    render(<TelaReceita pratoId="p1" />)
    const sec = await screen.findByRole('region', { name: 'Receita do prato' })
    await userEvent.selectOptions(within(sec).getByLabelText('Adicionar ingrediente'), 'ovos')
    await userEvent.type(within(sec).getByLabelText('Quantidade de Ovos'), '3')
    await userEvent.click(within(sec).getByRole('button', { name: 'Salvar' }))
    expect(corpoDe(/\/receitas\/pratos\/p1$/)).toEqual({ itens: [{ itemId: 'ovos', quantidade: 3 }] })
    expect(await within(sec).findByRole('status')).toHaveTextContent('Receita salva')
  })

  it('remover ingrediente tira da receita', async () => {
    render(<TelaReceita pratoId="p2" />)
    const sec = await screen.findByRole('region', { name: 'Receita do prato' })
    expect(within(sec).getByLabelText('Quantidade de Chopp')).toHaveValue('500')
    await userEvent.click(within(sec).getByRole('button', { name: 'Remover Chopp' }))
    await userEvent.click(within(sec).getByRole('button', { name: 'Salvar' }))
    expect(corpoDe(/\/receitas\/pratos\/p2$/)).toEqual({ itens: [] })
  })

  it('multiplicador só aparece em grupo de escolha única', async () => {
    render(<TelaReceita pratoId="p1" />)
    const g = await screen.findByRole('region', { name: 'Opção G (Tamanho)' })
    expect(within(g).getByLabelText('Multiplica a receita (%)')).toHaveValue('100')
    const bacon = screen.getByRole('region', { name: 'Opção Bacon (Adicionais)' })
    expect(within(bacon).queryByLabelText('Multiplica a receita (%)')).not.toBeInTheDocument()
    expect(screen.getByText('Cada sabor entra pela metade numa pizza meio a meio')).toBeInTheDocument()
  })

  it('salvar G com 150 manda multiplicadorPct 150', async () => {
    render(<TelaReceita pratoId="p1" />)
    const g = await screen.findByRole('region', { name: 'Opção G (Tamanho)' })
    const campo = within(g).getByLabelText('Multiplica a receita (%)')
    await userEvent.clear(campo)
    await userEvent.type(campo, '150')
    await userEvent.click(within(g).getByRole('button', { name: 'Salvar' }))
    expect(corpoDe(/\/receitas\/opcoes\/o-g$/)).toEqual({ itens: [], multiplicadorPct: 150 })
  })

  it('422 mostra a mensagem do servidor', async () => {
    api.uma('PUT', /\/receitas\/opcoes\/o-g$/, () => ({ status: 422, corpo: { mensagem: 'Item de estoque inválido' } }))
    render(<TelaReceita pratoId="p1" />)
    const g = await screen.findByRole('region', { name: 'Opção G (Tamanho)' })
    await userEvent.click(within(g).getByRole('button', { name: 'Salvar' }))
    expect(await within(g).findByRole('alert')).toHaveTextContent('Item de estoque inválido')
  })

  it('quantidade inválida não salva', async () => {
    render(<TelaReceita pratoId="p2" />)
    const sec = await screen.findByRole('region', { name: 'Receita do prato' })
    const campo = within(sec).getByLabelText('Quantidade de Chopp')
    await userEvent.clear(campo)
    await userEvent.type(campo, '0')
    await userEvent.click(within(sec).getByRole('button', { name: 'Salvar' }))
    expect(within(sec).getByRole('alert')).toHaveTextContent('Digite uma quantidade maior que zero')
    expect(api.chamadas('PUT', /receitas/)).toHaveLength(0)
  })

  it('esgotado alterna na lista de receitas', async () => {
    render(<TelaReceitas />)
    const botao = await screen.findByRole('button', { name: 'Pizza Margherita esgotado' })
    expect(botao).toHaveAttribute('aria-pressed', 'false')
    expect(botao).toHaveTextContent('Disponível')
    await userEvent.click(botao)
    const [, init] = api.chamadas('PATCH', /\/api\/equipe\/pratos\/p1$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({ esgotado: true })
    expect(await screen.findByRole('button', { name: 'Pizza Margherita esgotado' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Sem receita')).toBeInTheDocument()
    expect(screen.getByText('Receita: 1 item')).toBeInTheDocument()
  })
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ana, criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { cardapioDemo, mesa7 } from '../test/fixtures'
import { reais } from '../test/reais'
import TelaMesa from './TelaMesa'

describe('Conta da mesa', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...ana, emTurno: true }
    const mesa = mesa7()
    // Só a rodada confirmada (2 chopps, R$ 23,80): nada pendente.
    mesa.rodadas = mesa.rodadas.filter((r) => r.status === 'CONFIRMADA')
    api.estado.mesa = { tok7: mesa }
    api.estado.cardapio = cardapioDemo
    vi.stubGlobal('fetch', api.fetch)
    window.history.pushState({}, '', '/mesa/tok7')
  })

  const abrirConta = async () => {
    render(<TelaMesa token="tok7" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Fechar conta' }))
    return screen.getByRole('region', { name: 'Conta da mesa' })
  }
  const linha = (conta: HTMLElement, rotulo: string) => within(conta).getByText(rotulo).closest('.conta-linha')

  it('Fechar conta mostra itens, 10% marcado e total', async () => {
    const conta = await abrirConta()
    expect(linha(conta, 'Itens')).toHaveTextContent(reais(2380))
    const servico = within(conta).getByRole('checkbox', { name: /Serviço \(10%\)/ })
    expect(servico).toBeChecked()
    expect(linha(conta, 'Serviço (10%)')).toHaveTextContent(reais(238))
    expect(within(conta).getByRole('checkbox', { name: /Couvert/ })).not.toBeChecked()
    expect(linha(conta, 'Total')).toHaveTextContent(reais(2618))
  })

  it('desmarcar serviço e marcar couvert com 3 pessoas recalcula', async () => {
    const conta = await abrirConta()
    await userEvent.click(within(conta).getByRole('checkbox', { name: /Serviço \(10%\)/ }))
    await userEvent.click(within(conta).getByRole('checkbox', { name: /Couvert/ }))
    await userEvent.click(within(conta).getByRole('button', { name: 'Mais uma pessoa' }))
    await userEvent.click(within(conta).getByRole('button', { name: 'Mais uma pessoa' }))
    expect(within(conta).getByLabelText('Pessoas')).toHaveTextContent('3')
    expect(linha(conta, 'Total')).toHaveTextContent(reais(2380 + 4500))
  })

  it('pessoas não descem de 1', async () => {
    const conta = await abrirConta()
    await userEvent.click(within(conta).getByRole('checkbox', { name: /Couvert/ }))
    expect(within(conta).getByRole('button', { name: 'Menos uma pessoa' })).toBeDisabled()
  })

  it('sem forma o botão fica desligado; com Pix fecha e volta ao início', async () => {
    const conta = await abrirConta()
    const fechar = within(conta).getByRole('button', { name: /Fechar conta ·/ })
    expect(fechar).toBeDisabled()
    await userEvent.click(within(conta).getByRole('button', { name: 'Pix' }))
    expect(within(conta).getByRole('button', { name: 'Pix' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(fechar)
    const [, init] = api.chamadas('POST', /\/api\/equipe\/mesas\/tok7\/fechar$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      servico: true,
      couvert: false,
      formaPagamento: 'PIX',
      totalCentavos: 2618,
    })
    await vi.waitFor(() => expect(window.location.pathname).toBe('/'))
  })

  it('couvert manda as pessoas', async () => {
    const conta = await abrirConta()
    await userEvent.click(within(conta).getByRole('checkbox', { name: /Couvert/ }))
    await userEvent.click(within(conta).getByRole('button', { name: 'Mais uma pessoa' }))
    await userEvent.click(within(conta).getByRole('button', { name: 'Dinheiro' }))
    await userEvent.click(within(conta).getByRole('button', { name: /Fechar conta ·/ }))
    const [, init] = api.chamadas('POST', /\/fechar$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      servico: true,
      couvert: true,
      pessoas: 2,
      formaPagamento: 'DINHEIRO',
      totalCentavos: 2380 + 238 + 3000,
    })
  })

  it('restaurante sem couvert não mostra a opção', async () => {
    api.estado.mesa.tok7.conta.couvert.habilitado = false
    const conta = await abrirConta()
    expect(within(conta).queryByRole('checkbox', { name: /Couvert/ })).not.toBeInTheDocument()
  })

  it('rodada aguardando bloqueia o fechamento', async () => {
    api.estado.mesa = { tok7: mesa7() }
    const conta = await abrirConta()
    expect(within(conta).getByText('Confirme ou recuse os pedidos pendentes antes de fechar')).toBeInTheDocument()
    await userEvent.click(within(conta).getByRole('button', { name: 'Cartão' }))
    expect(within(conta).getByRole('button', { name: /Fechar conta ·/ })).toBeDisabled()
  })

  it('conta mudou (409) avisa', async () => {
    const conta = await abrirConta()
    await userEvent.click(within(conta).getByRole('button', { name: 'Cartão' }))
    api.uma('POST', /\/fechar$/, () => ({ status: 409, corpo: { mensagem: 'A conta mudou. Confira o novo total.' } }))
    await userEvent.click(within(conta).getByRole('button', { name: /Fechar conta ·/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('A conta mudou. Confira o novo total.')
    expect(window.location.pathname).toBe('/mesa/tok7')
  })

  it('Voltar sai da conta', async () => {
    await abrirConta()
    await userEvent.click(screen.getByRole('button', { name: 'Voltar à mesa' }))
    expect(screen.queryByRole('region', { name: 'Conta da mesa' })).not.toBeInTheDocument()
  })

  it('mesa sem sessão não mostra Fechar conta', async () => {
    api.estado.mesa.tok7 = { ...api.estado.mesa.tok7, aberta: false, rodadas: [] }
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    expect(screen.queryByRole('button', { name: 'Fechar conta' })).not.toBeInTheDocument()
  })
})

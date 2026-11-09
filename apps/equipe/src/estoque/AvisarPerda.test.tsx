import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Topo from '../inicio/Topo'
import { criarApiFalsa, dani, type ApiFalsa } from '../test/api-falsa'
import { estoqueDemo } from '../test/estoque-fixtures'
import AvisarPerda from './AvisarPerda'

describe('Avisar perda', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...dani }
    api.estado.estoque = estoqueDemo()
    vi.stubGlobal('fetch', api.fetch)
  })

  const abrir = async () => {
    render(<AvisarPerda onFechar={vi.fn()} />)
    return screen.findByRole('dialog', { name: 'Avisar perda' })
  }

  it('cozinha avisa uma cartela de ovos: escolhe Ovos, 30 un, Acidente e manda a perda', async () => {
    const d = await abrir()
    await userEvent.click(await within(d).findByRole('button', { name: 'Ovos' }))
    await userEvent.type(within(d).getByLabelText('Quanto perdeu'), '30')
    await userEvent.click(within(d).getByRole('button', { name: 'Continuar' }))
    await userEvent.click(within(d).getByRole('button', { name: 'Acidente' }))
    await userEvent.click(within(d).getByRole('button', { name: 'Avisar' }))
    const [, init] = api.chamadas('POST', /\/estoque\/perdas$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({ itemId: 'ovos', quantidade: 30, motivo: 'ACIDENTE' })
    expect(await within(d).findByRole('status')).toHaveTextContent('Perda avisada')
  })

  it('pede a lista com os mais usados no topo', async () => {
    await abrir()
    expect(api.chamadas('GET', /\/estoque\/itens\?ordem=perdas$/)).toHaveLength(1)
  })

  it('Outro exige texto antes de Avisar', async () => {
    const d = await abrir()
    await userEvent.click(await within(d).findByRole('button', { name: 'Queijo' }))
    await userEvent.type(within(d).getByLabelText('Quanto perdeu'), '200')
    await userEvent.click(within(d).getByRole('button', { name: 'Continuar' }))
    await userEvent.click(within(d).getByRole('button', { name: 'Outro' }))
    expect(within(d).getByRole('button', { name: 'Avisar' })).toBeDisabled()
    await userEvent.type(within(d).getByLabelText('O que aconteceu?'), 'Rato no estoque')
    await userEvent.click(within(d).getByRole('button', { name: 'Avisar' }))
    const [, init] = api.chamadas('POST', /\/estoque\/perdas$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      itemId: 'queijo',
      quantidade: 200,
      motivo: 'OUTRO',
      observacao: 'Rato no estoque',
    })
  })

  it('quantidade inválida não avança', async () => {
    const d = await abrir()
    await userEvent.click(await within(d).findByRole('button', { name: 'Ovos' }))
    await userEvent.type(within(d).getByLabelText('Quanto perdeu'), '0')
    await userEvent.click(within(d).getByRole('button', { name: 'Continuar' }))
    expect(within(d).getByRole('alert')).toHaveTextContent('Digite uma quantidade maior que zero')
    expect(within(d).queryByRole('button', { name: 'Acidente' })).not.toBeInTheDocument()
  })

  it('Voltar volta para a escolha do item', async () => {
    const d = await abrir()
    await userEvent.click(await within(d).findByRole('button', { name: 'Ovos' }))
    await userEvent.click(within(d).getByRole('button', { name: 'Voltar' }))
    expect(within(d).getByLabelText('Buscar item')).toBeInTheDocument()
  })

  it('Desfazer depois de avisar chama POST desfazer', async () => {
    const d = await abrir()
    await userEvent.click(await within(d).findByRole('button', { name: 'Ovos' }))
    await userEvent.type(within(d).getByLabelText('Quanto perdeu'), '1')
    await userEvent.click(within(d).getByRole('button', { name: 'Continuar' }))
    await userEvent.click(within(d).getByRole('button', { name: 'Validade' }))
    await userEvent.click(within(d).getByRole('button', { name: 'Avisar' }))
    let responder: () => void = () => undefined
    api.uma('POST', /\/estoque\/desfazer$/, () => new Promise((ok) => (responder = () => ok({ status: 200, corpo: {} }))))
    const botao = await within(d).findByRole('button', { name: 'Desfazer' })
    await userEvent.click(botao)
    await userEvent.click(botao)
    expect(api.chamadas('POST', /\/estoque\/desfazer$/)).toHaveLength(1)
    responder()
    expect(await within(d).findByRole('status')).toHaveTextContent('Perda desfeita')
  })

  it('busca filtra itens', async () => {
    const d = await abrir()
    await within(d).findByRole('button', { name: 'Ovos' })
    await userEvent.type(within(d).getByLabelText('Buscar item'), 'que')
    expect(within(d).getByRole('button', { name: 'Queijo' })).toBeInTheDocument()
    expect(within(d).queryByRole('button', { name: 'Ovos' })).not.toBeInTheDocument()
  })

  it('botão Avisar perda aparece para a cozinha no topo e abre a janela', async () => {
    render(<Topo usuario={dani} onMudou={vi.fn()} onSair={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Avisar perda' }))
    expect(await screen.findByRole('dialog', { name: 'Avisar perda' })).toBeInTheDocument()
  })
})

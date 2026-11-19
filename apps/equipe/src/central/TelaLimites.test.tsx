import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla } from '../test/estoque-fixtures'
import TelaLimites from './TelaLimites'

describe('Limites dos alertas', () => {
  let api: ApiFalsa
  const corpo = (i = 0) => JSON.parse(String(api.chamadas('PUT', /\/limites\//)[i][1]?.body)) as unknown

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    vi.stubGlobal('fetch', api.fetch)
    window.history.pushState({}, '', '/limites')
  })

  it('mostra os 11 tipos', async () => {
    render(<TelaLimites />)
    expect(await screen.findAllByRole('switch')).toHaveLength(11)
    expect(screen.getByRole('switch', { name: 'Sem garçom em turno ativado' })).toBeChecked()
    expect(screen.getByLabelText('Movimento fora do normal (% da média)')).toHaveValue('140')
  })

  it('desligar Pedido esquecido salva', async () => {
    render(<TelaLimites />)
    await userEvent.click(await screen.findByRole('switch', { name: 'Pedido esquecido ativado' }))
    expect(corpo()).toEqual({ ativo: false, valor: null })
    expect(api.chamadas('PUT', /limites\/PEDIDO_ESQUECIDO$/)).toHaveLength(1)
    expect(await screen.findByRole('status')).toHaveTextContent('Salvo')
  })

  it('salva o valor de mesa sem atendimento', async () => {
    render(<TelaLimites />)
    const campo = await screen.findByLabelText('Mesa sem atendimento (minutos)')
    await userEvent.clear(campo)
    await userEvent.type(campo, '15')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Mesa sem atendimento' }))
    expect(corpo()).toEqual({ ativo: true, valor: 15 })
  })

  it.each(['0', '61'])('valor %s fora da faixa não chama a API', async (v) => {
    render(<TelaLimites />)
    const campo = await screen.findByLabelText('Mesa sem atendimento (minutos)')
    await userEvent.clear(campo)
    await userEvent.type(campo, v)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Mesa sem atendimento' }))
    expect(api.chamadas('PUT', /\/limites\//)).toHaveLength(0)
    expect(await screen.findByRole('alert')).toHaveTextContent('use de 1 a 60 minutos')
  })

  it('erro do servidor aparece e o interruptor volta', async () => {
    api.uma('PUT', /limites\/PEDIDO_ESQUECIDO$/, () => ({ status: 422, corpo: { mensagem: 'Limite inválido' } }))
    render(<TelaLimites />)
    const chave = await screen.findByRole('switch', { name: 'Pedido esquecido ativado' })
    await userEvent.click(chave)
    expect(await screen.findByRole('alert')).toHaveTextContent('Limite inválido')
    expect(chave).toBeChecked()
  })
})

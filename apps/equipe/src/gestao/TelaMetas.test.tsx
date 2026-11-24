import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla } from '../test/estoque-fixtures'
import TelaMetas from './TelaMetas'

describe('Metas', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    api.estado.paineis.metas = {
      equipe: { VALOR: null, MESAS: { periodo: 'DIA', alvo: 30 } },
      garcomPadrao: { VALOR: { periodo: 'DIA', alvo: 80000 }, MESAS: null },
      estacoes: [
        { estacao: 'Bar', noTempoPct: null, zeroEsquecidos: false },
        { estacao: 'Cozinha', noTempoPct: 85, zeroEsquecidos: true },
      ],
      garcons: [
        { id: 'u-ana', nome: 'Ana' },
        { id: 'u-bruno', nome: 'Bruno' },
      ],
      horasSemPausa: 4,
    }
    vi.stubGlobal('fetch', api.fetch)
    window.history.pushState({}, '', '/metas')
  })

  const corpo = (metodo: string, re: RegExp) => {
    const [, init] = api.chamadas(metodo, re)[0]
    return JSON.parse(String(init?.body)) as unknown
  }

  it('mostra o que já está definido', async () => {
    render(<TelaMetas />)
    const equipe = await screen.findByRole('region', { name: 'Meta da equipe' })
    expect(within(equipe).getByLabelText('Mesas atendidas pela equipe')).toHaveValue('30')
    expect(within(equipe).getByLabelText('Valor vendido pela equipe (R$)')).toHaveValue('')
    const padrao = screen.getByRole('region', { name: 'Meta de cada garçom (padrão)' })
    expect(within(padrao).getByLabelText('Valor vendido por garçom (R$)')).toHaveValue('800')
    expect(screen.getByLabelText('% no tempo (Cozinha)')).toHaveValue('85')
    expect(screen.getByLabelText('Zero esquecidos (Cozinha)')).toBeChecked()
  })

  it('salva a meta da equipe em reais por semana', async () => {
    render(<TelaMetas />)
    const equipe = await screen.findByRole('region', { name: 'Meta da equipe' })
    await userEvent.type(within(equipe).getByLabelText('Valor vendido pela equipe (R$)'), '2.000')
    const valor = within(equipe).getByRole('group', { name: 'Valor vendido pela equipe' })
    await userEvent.click(within(valor).getByRole('button', { name: 'Semana' }))
    await userEvent.click(within(valor).getByRole('button', { name: 'Salvar' }))
    expect(corpo('PUT', /\/metas\/equipe\/VALOR$/)).toEqual({ periodo: 'SEMANA', alvo: 200000 })
    expect(await screen.findByRole('status')).toHaveTextContent('Salvo')
  })

  it('valor inválido avisa e não salva', async () => {
    render(<TelaMetas />)
    const equipe = await screen.findByRole('region', { name: 'Meta da equipe' })
    await userEvent.type(within(equipe).getByLabelText('Valor vendido pela equipe (R$)'), '0')
    const valor = within(equipe).getByRole('group', { name: 'Valor vendido pela equipe' })
    await userEvent.click(within(valor).getByRole('button', { name: 'Salvar' }))
    expect(api.chamadas('PUT', /\/metas\//)).toHaveLength(0)
    expect(await screen.findByRole('alert')).toHaveTextContent('Digite um valor maior que zero')
  })

  it('Sem meta apaga a meta', async () => {
    render(<TelaMetas />)
    const equipe = await screen.findByRole('region', { name: 'Meta da equipe' })
    const mesas = within(equipe).getByRole('group', { name: 'Mesas atendidas pela equipe' })
    await userEvent.click(within(mesas).getByRole('button', { name: 'Sem meta' }))
    expect(api.chamadas('DELETE', /\/metas\/equipe\/MESAS$/)).toHaveLength(1)
  })

  it('lista os garçons em ordem alfabética só com o nome', async () => {
    render(<TelaMetas />)
    const ajustar = await screen.findByRole('region', { name: 'Ajustar para alguém' })
    expect(within(ajustar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ana', 'Bruno'])
  })

  it('tocar no garçom abre a meta dele', async () => {
    render(<TelaMetas />)
    await userEvent.click(await screen.findByRole('button', { name: 'Ana' }))
    expect(window.location.pathname).toBe('/metas/garcom/u-ana')
  })

  it('salva a meta da estação', async () => {
    render(<TelaMetas />)
    await userEvent.type(await screen.findByLabelText('% no tempo (Bar)'), '80')
    await userEvent.click(screen.getByLabelText('Zero esquecidos (Bar)'))
    const bar = screen.getByRole('group', { name: 'Bar' })
    await userEvent.click(within(bar).getByRole('button', { name: 'Salvar' }))
    expect(corpo('PUT', /\/metas\/estacao\/Bar$/)).toEqual({ noTempoPct: 80, zeroEsquecidos: true })
  })

  it('salva horas sem pausa', async () => {
    render(<TelaMetas />)
    const horas = await screen.findByLabelText('Avisar depois de quantas horas sem pausa')
    await userEvent.clear(horas)
    await userEvent.type(horas, '6')
    const cuidado = screen.getByRole('region', { name: 'Cuidado com a equipe' })
    await userEvent.click(within(cuidado).getByRole('button', { name: 'Salvar' }))
    expect(corpo('PATCH', /\/configuracoes\/painel$/)).toEqual({ horasSemPausa: 6 })
  })
})

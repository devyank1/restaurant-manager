import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla } from '../test/estoque-fixtures'
import TelaTempos from './TelaTempos'

describe('Tempo de preparo', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    api.estado.paineis.tempos = {
      categorias: [
        {
          id: 'c-pizza',
          nome: 'Pizzas',
          estacao: 'Cozinha',
          tempoPreparoMin: 12,
          pratos: [
            { id: 'p-marg', nome: 'Margherita', tempoPreparoMin: null },
            { id: 'p-cala', nome: 'Calabresa', tempoPreparoMin: 20 },
          ],
        },
      ],
    }
    vi.stubGlobal('fetch', api.fetch)
  })

  const corpo = (re: RegExp) => {
    const [, init] = api.chamadas('PATCH', re)[0]
    return JSON.parse(String(init?.body)) as unknown
  }

  it('mostra a categoria com o padrão e os pratos herdando', async () => {
    render(<TelaTempos />)
    const pizzas = await screen.findByRole('region', { name: 'Pizzas · Cozinha' })
    expect(within(pizzas).getByLabelText('Padrão da categoria (min)')).toHaveValue('12')
    const marg = within(pizzas).getByLabelText('Tempo de Margherita (min)')
    expect(marg).toHaveValue('')
    expect(marg).toHaveAttribute('placeholder', 'Padrão: 12 min')
    expect(within(pizzas).getByLabelText('Tempo de Calabresa (min)')).toHaveValue('20')
  })

  it('mudar o tempo do prato manda PATCH com o número', async () => {
    render(<TelaTempos />)
    const marg = await screen.findByLabelText('Tempo de Margherita (min)')
    await userEvent.type(marg, '18')
    await userEvent.tab()
    expect(corpo(/\/tempos\/pratos\/p-marg$/)).toEqual({ tempoPreparoMin: 18 })
    expect(await screen.findByRole('status')).toHaveTextContent('Salvo')
  })

  it('apagar o campo volta ao padrão (null)', async () => {
    render(<TelaTempos />)
    const cala = await screen.findByLabelText('Tempo de Calabresa (min)')
    await userEvent.clear(cala)
    await userEvent.tab()
    expect(corpo(/\/tempos\/pratos\/p-cala$/)).toEqual({ tempoPreparoMin: null })
  })

  it('mudar o padrão da categoria manda PATCH da categoria', async () => {
    render(<TelaTempos />)
    const padrao = await screen.findByLabelText('Padrão da categoria (min)')
    await userEvent.clear(padrao)
    await userEvent.type(padrao, '15')
    await userEvent.tab()
    expect(corpo(/\/tempos\/categorias\/c-pizza$/)).toEqual({ tempoPreparoMin: 15 })
  })

  it('número inválido não salva e avisa', async () => {
    render(<TelaTempos />)
    const marg = await screen.findByLabelText('Tempo de Margherita (min)')
    await userEvent.type(marg, '0')
    await userEvent.tab()
    expect(api.chamadas('PATCH', /\/tempos\//)).toHaveLength(0)
    expect(await screen.findByRole('alert')).toHaveTextContent('Use de 1 a 240 minutos')
  })

  it('sem mudança não salva', async () => {
    render(<TelaTempos />)
    await userEvent.click(await screen.findByLabelText('Tempo de Calabresa (min)'))
    await userEvent.tab()
    expect(api.chamadas('PATCH', /\/tempos\//)).toHaveLength(0)
  })
})

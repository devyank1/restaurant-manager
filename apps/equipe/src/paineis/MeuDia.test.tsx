import { act, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProgressoMeta } from '../api/tipos'
import { ana, criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { meuPainel } from '../test/paineis-falso'
import { socketsFalsos } from '../test/socket-falso'
import MeuDia from './MeuDia'

const meta = (m: Partial<ProgressoMeta> = {}): ProgressoMeta => ({
  tipo: 'MESAS',
  periodo: 'DIA',
  alvo: 10,
  atual: 6,
  batida: false,
  pct: 60,
  ...m,
})

describe('Meu dia', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...ana, emTurno: true }
    api.estado.paineis.eu = meuPainel({
      metaEquipe: [meta({ alvo: 40, atual: 12, pct: 30 })],
      eu: {
        emTurno: true,
        emTurnoDesde: '2026-11-11T21:30:00.000Z',
        mesasHoje: 6,
        metas: [meta()],
        avisos: ['4 h em turno sem pausa'],
      },
    })
    vi.stubGlobal('fetch', api.fetch)
  })

  it('garçom vê a meta da equipe e as dele', async () => {
    render(<MeuDia />)
    const equipe = await screen.findByRole('region', { name: 'Meta da equipe' })
    expect(within(equipe).getByRole('meter', { name: 'Mesas atendidas pela equipe' })).toHaveAttribute('aria-valuenow', '12')
    const minhas = screen.getByRole('region', { name: 'Minhas metas' })
    expect(within(minhas).getByRole('meter', { name: 'Mesas atendidas' })).toHaveAttribute('aria-valuenow', '6')
    expect(within(equipe).queryByRole('button', { name: 'Definir em Metas' })).not.toBeInTheDocument()
  })

  it('não mostra nome de colega', async () => {
    render(<MeuDia />)
    await screen.findByRole('region', { name: 'Minhas metas' })
    expect(screen.queryByText(/Bruno/)).not.toBeInTheDocument()
    expect(api.chamadas('GET', /\/painel\?/)).toHaveLength(0)
  })

  it('mesas atendidas hoje e turno', async () => {
    render(<MeuDia />)
    expect(await screen.findByText('Mesas atendidas hoje: 6')).toBeInTheDocument()
    expect(screen.getByText('Em turno desde 18:30')).toBeInTheDocument()
    expect(screen.getByText('4 h em turno sem pausa')).toHaveClass('aviso-cuidado')
  })

  it('sem metas mostra Sem meta definida', async () => {
    api.estado.paineis.eu = meuPainel({ eu: { emTurno: false, emTurnoDesde: null } })
    render(<MeuDia />)
    const minhas = await screen.findByRole('region', { name: 'Minhas metas' })
    expect(within(minhas).getByText('Sem meta definida')).toBeInTheDocument()
    expect(screen.getByText('Fora do turno')).toBeInTheDocument()
  })

  it('painel-mudou recarrega', async () => {
    render(<MeuDia />)
    await screen.findByRole('region', { name: 'Minhas metas' })
    const antes = api.chamadas('GET', /\/painel\/eu$/).length
    act(() => {
      for (const s of socketsFalsos) s.servidor('painel-mudou', {})
    })
    await waitFor(() => expect(api.chamadas('GET', /\/painel\/eu$/).length).toBeGreaterThan(antes))
  })
})

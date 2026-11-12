import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PainelEstacao as Painel } from '../api/tipos'
import { criarApiFalsa, dani, type ApiFalsa } from '../test/api-falsa'
import { medidaVazia } from '../test/paineis-falso'
import PainelEstacao from './PainelEstacao'

describe('Hoje da estação', () => {
  let api: ApiFalsa
  let painel: Painel

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...dani }
    painel = {
      estacao: 'Cozinha',
      metaEquipe: [],
      metas: [
        { tipo: 'NO_TEMPO', periodo: 'DIA', alvo: 85, atual: 82, batida: false, pct: 96 },
        { tipo: 'ESQUECIDOS', periodo: 'DIA', alvo: 0, atual: 1, batida: false, pct: 0 },
      ],
      medida: {
        ...medidaVazia('Cozinha'),
        pedidos: 23,
        avaliados: 22,
        noTempo: 18,
        noTempoPct: 82,
        mediaMin: 14,
        esquecidos: [{ rodadaId: 'r1', mesa: 7, minutos: 41 }],
      },
    }
    api.estado.paineis.estacoes.Cozinha = painel
    vi.stubGlobal('fetch', api.fetch)
  })

  it('mostra % no tempo e os esquecidos por mesa', async () => {
    render(<PainelEstacao estacao="Cozinha" />)
    expect(await screen.findByText('Pedidos hoje: 23')).toBeInTheDocument()
    expect(screen.getByText('No tempo: 82%')).toBeInTheDocument()
    const esq = screen.getByRole('region', { name: 'Esquecidos' })
    expect(within(esq).getByText('Mesa 7 · 41 min')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: '% no tempo' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Ana|Bruno|Dani/)
  })

  it('meta de % batida fica verde', async () => {
    painel.metas = [{ tipo: 'NO_TEMPO', periodo: 'DIA', alvo: 80, atual: 90, batida: true, pct: 100 }]
    painel.medida = { ...painel.medida, noTempoPct: 90, esquecidos: [] }
    const { container } = render(<PainelEstacao estacao="Cozinha" />)
    await screen.findByRole('meter', { name: '% no tempo' })
    expect(container.querySelector('.barra-meta--batida')).not.toBeNull()
    expect(screen.getByText('Nenhum pedido esquecido hoje.')).toBeInTheDocument()
  })

  it('sem pedido ainda mostra —', async () => {
    painel.metas = []
    painel.medida = medidaVazia('Cozinha')
    render(<PainelEstacao estacao="Cozinha" />)
    expect(await screen.findByText('No tempo: —')).toBeInTheDocument()
    expect(screen.getByText('Sem meta da estação.')).toBeInTheDocument()
  })
})

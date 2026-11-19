import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla } from '../test/estoque-fixtures'
import TelaGarcomCentral from './TelaGarcomCentral'

const minAtras = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

describe('Detalhe do garçom na Central', () => {
  let api: ApiFalsa
  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    vi.stubGlobal('fetch', api.fetch)
  })

  it('lista mesas, chamados e horas em turno', async () => {
    api.uma('GET', /central\/garcom\/u-ana$/, () => ({
      status: 200,
      corpo: {
        id: 'u-ana',
        nome: 'Ana',
        emTurno: true,
        emTurnoDesde: minAtras(150),
        horasEmTurno: 2.5,
        mesasAbertas: [{ numero: 4, abertaEm: minAtras(20) }],
        chamadosPendentes: [{ id: 'c1', mesa: 7, criadoEm: minAtras(3) }],
      },
    }))
    render(<TelaGarcomCentral id="u-ana" />)
    expect(await screen.findByRole('heading', { name: 'Ana' })).toBeInTheDocument()
    expect(screen.getByText('Em turno há 2,5 h')).toBeInTheDocument()
    expect(screen.getByText('Mesa 4, aberta há 20 min')).toBeInTheDocument()
    expect(screen.getByText('Mesa 7, há 3 min')).toBeInTheDocument()
  })

  it('mostra mensagens de lista vazia', async () => {
    api.uma('GET', /central\/garcom\/u-ana$/, () => ({
      status: 200,
      corpo: {
        id: 'u-ana',
        nome: 'Ana',
        emTurno: false,
        emTurnoDesde: null,
        horasEmTurno: null,
        mesasAbertas: [],
        chamadosPendentes: [],
      },
    }))
    render(<TelaGarcomCentral id="u-ana" />)
    expect(await screen.findByText('Nenhuma mesa aberta')).toBeInTheDocument()
    expect(screen.getByText('Nenhum chamado pendente')).toBeInTheDocument()
    expect(screen.getByText('Fora de turno')).toBeInTheDocument()
  })

  it('garçom inexistente mostra aviso amigável', async () => {
    render(<TelaGarcomCentral id="nao-existe" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Garçom não encontrado')
    expect(screen.getByRole('alert')).toHaveClass('central-erro')
    expect(screen.getByRole('alert')).not.toHaveClass('erro')
  })
})

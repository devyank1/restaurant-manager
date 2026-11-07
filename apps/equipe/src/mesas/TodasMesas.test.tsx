import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ana, criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { mesasDemo } from '../test/fixtures'
import { ultimoSocket } from '../test/socket-falso'
import TodasMesas from './TodasMesas'

describe('Todas as mesas', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...ana }
    api.estado.mesas = mesasDemo
    vi.stubGlobal('fetch', api.fetch)
  })

  it('lista livres e ocupadas e abre a mesa tocada', async () => {
    render(<TodasMesas />)
    expect(await screen.findByRole('button', { name: /Mesa 9.*Livre/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mesa 8.*Bruno/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Mesa 7/ }))
    expect(window.location.pathname).toBe('/mesa/tok7')
  })

  it('evento mesa-mudou recarrega', async () => {
    render(<TodasMesas />)
    await screen.findByRole('button', { name: /Mesa 9.*Livre/ })
    api.estado.mesas = [{ ...mesasDemo[2], aberta: true, garcomNome: 'Ana' }]
    act(() => ultimoSocket().servidor('mesa-mudou'))
    expect(await screen.findByRole('button', { name: /Mesa 9.*Ana/ })).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ana, criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import Topo from './Topo'

describe('Topo', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...ana }
    vi.stubGlobal('fetch', api.fetch)
  })

  it('interruptor Em turno chama a API e reflete o estado', async () => {
    const onMudou = vi.fn()
    const { rerender } = render(<Topo usuario={ana} onMudou={onMudou} onSair={vi.fn()} />)
    const interruptor = screen.getByRole('switch', { name: 'Em turno' })
    expect(interruptor).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(interruptor)
    expect(api.chamadas('PATCH', /\/api\/equipe\/turno$/)).toHaveLength(1)
    expect(onMudou).toHaveBeenCalledWith(expect.objectContaining({ emTurno: true }))
    rerender(<Topo usuario={{ ...ana, emTurno: true }} onMudou={onMudou} onSair={vi.fn()} />)
    expect(screen.getByRole('switch', { name: 'Em turno' })).toHaveAttribute('aria-checked', 'true')
  })
})

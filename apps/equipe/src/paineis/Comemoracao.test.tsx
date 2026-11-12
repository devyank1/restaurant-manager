import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { ana, criarApiFalsa } from '../test/api-falsa'
import { reais } from '../test/reais'
import { socketsFalsos, ultimoSocket } from '../test/socket-falso'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import Comemoracao from './Comemoracao'

const bateu = { tipo: 'VALOR', periodo: 'DIA', alvo: 200000 }

describe('Comemoração', () => {
  beforeEach(() => {
    const api = criarApiFalsa()
    api.estado.usuario = { ...ana }
    vi.stubGlobal('fetch', api.fetch)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('socket meta-batida mostra a faixa para quem está logado', async () => {
    render(<App />)
    expect(await screen.findByText('Ana', undefined, { timeout: 3000 })).toBeInTheDocument()
    act(() => {
      for (const s of socketsFalsos) s.servidor('meta-batida', bateu)
    })
    expect(await screen.findByRole('status', undefined, { timeout: 3000 })).toHaveTextContent(`A equipe bateu a meta de ${reais(200000)} hoje! 🎉`)
  })

  it('Fechar some a faixa', async () => {
    render(<Comemoracao />)
    act(() => ultimoSocket().servidor('meta-batida', { tipo: 'MESAS', periodo: 'SEMANA', alvo: 30 }))
    expect(screen.getByRole('status')).toHaveTextContent('A equipe bateu a meta de 30 mesas na semana! 🎉')
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('some sozinha em 15 s', () => {
    vi.useFakeTimers()
    render(<Comemoracao />)
    act(() => ultimoSocket().servidor('meta-batida', bateu))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(14_000))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('painel-mudou chama o painel', () => {
    const painel = vi.fn()
    function Ouvinte() {
      useEquipeAoVivo({ painel })
      return null
    }
    render(<Ouvinte />)
    act(() => ultimoSocket().servidor('painel-mudou', {}))
    act(() => ultimoSocket().servidor('connect'))
    expect(painel).toHaveBeenCalledTimes(2)
  })
})

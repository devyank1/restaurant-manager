import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ultimoSocket } from '../test/socket-falso'
import { useEquipeAoVivo } from './useEquipeAoVivo'

describe('useEquipeAoVivo', () => {
  it('central-mudou e connect pedem a central de novo', () => {
    const central = vi.fn()
    renderHook(() => useEquipeAoVivo({ central }))
    const socket = ultimoSocket()
    socket.servidor('central-mudou')
    expect(central).toHaveBeenCalledTimes(1)
    socket.servidor('connect')
    expect(central).toHaveBeenCalledTimes(2)
  })
})

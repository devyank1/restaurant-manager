import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { socketsFalsos } from './socket-falso'

// Tempo real sem rede: os testes disparam eventos com ultimoSocket().servidor(...).
vi.mock('socket.io-client', () => import('./socket-falso'))

afterEach(() => {
  cleanup()
  socketsFalsos.length = 0
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

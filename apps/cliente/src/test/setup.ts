import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { socketsFalsos } from './socket-falso'

// Tempo real sem rede: os testes disparam eventos com ultimoSocket().servidor(...).
vi.mock('socket.io-client', () => import('./socket-falso'))

// jsdom não implementa reprodução de mídia.
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(),
})

afterEach(() => {
  cleanup()
  socketsFalsos.length = 0
})

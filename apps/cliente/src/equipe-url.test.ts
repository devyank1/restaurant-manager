import { describe, expect, it } from 'vitest'
import { urlEquipe } from './equipe-url'

describe('urlEquipe', () => {
  it('dev na porta 5173 vai para o app da equipe na 5174', () => {
    expect(urlEquipe({ protocol: 'http:', hostname: '192.168.1.9', port: '5173' })).toBe('http://192.168.1.9:5174')
  })

  it('HTTPS padrão (porta vazia ou 443) vai para a 8443', () => {
    const loc = { protocol: 'https:', hostname: 'pc.tail.ts.net' }
    expect(urlEquipe({ ...loc, port: '' })).toBe('https://pc.tail.ts.net:8443')
    expect(urlEquipe({ ...loc, port: '443' })).toBe('https://pc.tail.ts.net:8443')
  })

  it('VITE_EQUIPE_URL sobrepõe, sem barra no fim', () => {
    expect(urlEquipe({ protocol: 'http:', hostname: 'x', port: '5173' }, 'https://garcom.exemplo/')).toBe(
      'https://garcom.exemplo',
    )
  })
})

import { describe, expect, it } from 'vitest'
import { extrairToken } from './rota'

describe('extrairToken', () => {
  it('lê o token de /m/<token>', () => {
    expect(extrairToken('/m/abc_-123')).toBe('abc_-123')
  })

  it('aceita barra final', () => {
    expect(extrairToken('/m/abc/')).toBe('abc')
  })

  it('token com % malformado devolve null em vez de quebrar', () => {
    expect(extrairToken('/m/abc%')).toBeNull()
    expect(extrairToken('/m/%E0%A4%A')).toBeNull()
  })

  it('devolve null fora da rota da mesa', () => {
    expect(extrairToken('/')).toBeNull()
    expect(extrairToken('/m/')).toBeNull()
  })
})

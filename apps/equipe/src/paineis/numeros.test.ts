import { describe, expect, it } from 'vitest'
import { lerInteiro, lerReais } from './numeros'

describe('números digitados', () => {
  it('reais em pt-BR viram centavos', () => {
    expect(lerReais('2.000')).toBe(200000)
    expect(lerReais('2000')).toBe(200000)
    expect(lerReais('1.500,50')).toBe(150050)
    expect(lerReais('1500,5')).toBe(150050)
    expect(lerReais(' 800 ')).toBe(80000)
    expect(lerReais('R$ 800,00')).toBe(80000)
  })

  it('reais inválidos ou zero → null', () => {
    for (const t of ['', '0', '-5', 'abc', '1,234,5', '1.50', '10,123']) expect(lerReais(t)).toBeNull()
  })

  it('inteiro dentro da faixa', () => {
    expect(lerInteiro('12', 1, 100)).toBe(12)
    expect(lerInteiro('0', 1, 100)).toBeNull()
    expect(lerInteiro('101', 1, 100)).toBeNull()
    expect(lerInteiro('2,5', 1, 100)).toBeNull()
    expect(lerInteiro('', 1, 100)).toBeNull()
  })
})

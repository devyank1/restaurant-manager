import { describe, expect, it } from 'vitest'
import type { ProgressoMeta } from '../api/tipos'
import { reais } from '../test/reais'
import { lerInteiro, lerReais, textoAlvo, textoMeta } from './numeros'

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

describe('texto da meta', () => {
  const m = (x: Partial<ProgressoMeta>): ProgressoMeta => ({
    tipo: 'VALOR',
    periodo: 'DIA',
    alvo: 10,
    atual: 1,
    batida: false,
    pct: 10,
    ...x,
  })
  const nbsp = (t: string) => t.replaceAll(String.fromCharCode(0xa0), ' ')

  it('cada tipo', () => {
    expect(nbsp(textoMeta(m({ alvo: 200000, atual: 120000 })))).toBe(`${reais(120000)} de ${reais(200000)}`)
    expect(textoMeta(m({ tipo: 'MESAS', alvo: 10, atual: 6 }))).toBe('6 de 10 mesas')
    expect(textoMeta(m({ tipo: 'MESAS', alvo: 1, atual: 0 }))).toBe('0 de 1 mesa')
    expect(textoMeta(m({ tipo: 'NO_TEMPO', alvo: 85, atual: 82 }))).toBe('82% no tempo · meta 85%')
    expect(textoMeta(m({ tipo: 'ESQUECIDOS', alvo: 0, atual: 0 }))).toBe('Nenhum esquecido')
    expect(textoMeta(m({ tipo: 'ESQUECIDOS', alvo: 0, atual: 1 }))).toBe('1 esquecido')
    expect(textoMeta(m({ tipo: 'ESQUECIDOS', alvo: 0, atual: 2 }))).toBe('2 esquecidos')
  })

  it('alvo com período', () => {
    expect(nbsp(textoAlvo({ tipo: 'VALOR', periodo: 'DIA', alvo: 200000 }))).toBe(`${reais(200000)} hoje`)
    expect(textoAlvo({ tipo: 'MESAS', periodo: 'SEMANA', alvo: 30 })).toBe('30 mesas na semana')
  })
})

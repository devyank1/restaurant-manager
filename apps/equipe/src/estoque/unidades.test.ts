import { describe, expect, it } from 'vitest'
import { falarQuantidade, formatarQuantidade, paraBase, unidadesDe } from './unidades'

describe('unidades do estoque', () => {
  it.each([
    [1500, 'G', '1,5 kg'],
    [800, 'G', '800 g'],
    [2000, 'ML', '2 L'],
    [1250, 'ML', '1,25 L'],
    [30, 'UN', '30 un'],
    [-5, 'UN', '0 (conferir)'],
  ] as const)('formata %d %s como %s', (base, unidade, texto) => {
    expect(formatarQuantidade(base, unidade)).toBe(texto)
  })

  it('converte o que foi digitado para a unidade base', () => {
    expect(paraBase('1,5', 'kg')).toBe(1500)
    expect(paraBase('1.5', 'kg')).toBe(1500)
    expect(paraBase('2', 'L')).toBe(2000)
    expect(paraBase('30', 'un')).toBe(30)
    expect(paraBase('abc', 'g')).toBeNull()
    expect(paraBase('', 'g')).toBeNull()
    expect(paraBase('0', 'un')).toBeNull()
    expect(paraBase('-3', 'un')).toBeNull()
  })

  it('aceita zero quando pedido (contagem)', () => {
    expect(paraBase('0', 'kg', true)).toBe(0)
    expect(paraBase('-1', 'kg', true)).toBeNull()
  })

  it('unidades que dá para digitar', () => {
    expect(unidadesDe('G')).toEqual(['g', 'kg'])
    expect(unidadesDe('ML')).toEqual(['ml', 'L'])
    expect(unidadesDe('UN')).toEqual(['un'])
  })

  it('fala a quantidade por extenso', () => {
    expect(falarQuantidade(1500, 'G')).toBe('1,5 quilo')
    expect(falarQuantidade(2000, 'G')).toBe('2 quilos')
    expect(falarQuantidade(800, 'G')).toBe('800 gramas')
    expect(falarQuantidade(2000, 'ML')).toBe('2 litros')
    expect(falarQuantidade(300, 'ML')).toBe('300 mililitros')
    expect(falarQuantidade(30, 'UN')).toBe('30 unidades')
    expect(falarQuantidade(1, 'UN')).toBe('1 unidade')
  })
})

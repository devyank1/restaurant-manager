import { describe, expect, it } from 'vitest'
import { mix, pizza } from '../test/fixtures'
import {
  descontoPercentual,
  formatarReais,
  precoExibicao,
  precoUnitario,
  validarSelecao,
} from './preco'

describe('formatarReais', () => {
  it('formata centavos em reais pt-BR', () => {
    expect(formatarReais(5990)).toBe(`R$${String.fromCharCode(0xa0)}59,90`)
  })
})

describe('descontoPercentual', () => {
  it('calcula o desconto arredondado', () => {
    expect(descontoPercentual(6990, 5990)).toBe(14)
  })

  it('não há desconto sem promo, com promo igual, maior ou preço zero', () => {
    expect(descontoPercentual(6990, null)).toBeNull()
    expect(descontoPercentual(5990, 5990)).toBeNull()
    expect(descontoPercentual(5990, 6990)).toBeNull()
    expect(descontoPercentual(0, 0)).toBeNull()
  })
})

describe('precoExibicao', () => {
  it('prato com promo mostra preço novo, original e desconto', () => {
    expect(precoExibicao(mix)).toEqual({
      centavos: 5990,
      originalCentavos: 6990,
      desconto: 14,
      aPartirDe: false,
    })
  })

  it('prato com tamanho mostra "a partir de" o menor tamanho', () => {
    expect(precoExibicao(pizza)).toEqual({
      centavos: 4990,
      originalCentavos: null,
      desconto: null,
      aPartirDe: true,
    })
  })
})

describe('precoUnitario', () => {
  it('soma tamanho, maior sabor do meio a meio e adicionais', () => {
    expect(
      precoUnitario(pizza, {
        tam: ['m'],
        sab: ['margherita', 'quatroQueijos'],
        adic: ['bacon'],
      }),
    ).toBe(8790)
  })

  it('prato sem opções usa o preço efetivo', () => {
    expect(precoUnitario(mix, {})).toBe(5990)
  })
})

describe('validarSelecao', () => {
  it('exige os grupos obrigatórios', () => {
    expect(validarSelecao(pizza, {})).toEqual(['Escolha Tamanho', 'Escolha Sabores'])
  })

  it('limita ao máximo do grupo', () => {
    expect(
      validarSelecao(pizza, { tam: ['m'], sab: ['margherita', 'calabresa', 'quatroQueijos'] }),
    ).toEqual(['Escolha até 2 em Sabores'])
  })

  it('aceita seleção válida', () => {
    expect(validarSelecao(pizza, { tam: ['p'], sab: ['margherita'] })).toEqual([])
  })
})

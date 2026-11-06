import { describe, expect, it } from 'vitest'
import { mix, pizza } from '../test/fixtures'
import {
  descontoPercentual,
  precoEfetivo,
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

describe('escolha única sem preço (ex.: ponto da carne)', () => {
  const picanha = {
    ...mix,
    id: 'picanha',
    nome: 'Picanha na Chapa',
    precoCentavos: 9890,
    precoPromocionalCentavos: 8990,
    grupos: [
      {
        id: 'ponto',
        nome: 'Ponto da carne',
        tipo: 'UNICA' as const,
        obrigatorio: true,
        min: 1,
        max: 1,
        opcoes: [
          { id: 'mal', nome: 'Mal passada', precoCentavos: 0, precoPromocionalCentavos: null },
          { id: 'bem', nome: 'Bem passada', precoCentavos: 0, precoPromocionalCentavos: null },
        ],
      },
    ],
  }

  it('não zera o preço do prato', () => {
    expect(precoUnitario(picanha, { ponto: ['mal'] })).toBe(8990)
  })

  it('a lista mostra o preço do prato, não "a partir de R$ 0,00"', () => {
    expect(precoExibicao(picanha)).toEqual({
      centavos: 8990,
      originalCentavos: 9890,
      desconto: 9,
      aPartirDe: false,
    })
  })
})

describe('precoEfetivo', () => {
  it('só usa a promoção quando ela é menor que o preço e maior que zero', () => {
    expect(precoEfetivo(6990, 5990)).toBe(5990)
    expect(precoEfetivo(5990, 6990)).toBe(5990)
    expect(precoEfetivo(5990, 0)).toBe(5990)
    expect(precoEfetivo(5990, null)).toBe(5990)
  })
})

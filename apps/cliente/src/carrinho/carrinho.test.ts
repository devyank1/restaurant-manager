import { describe, expect, it } from 'vitest'
import { contarItens, type ItemCarrinho } from './carrinho'

const item = (quantidade: number): ItemCarrinho => ({
  id: String(quantidade),
  pratoId: 'mix',
  nome: 'Mix da Casa',
  resumoOpcoes: '',
  selecao: {},
  observacao: '',
  quantidade,
  precoUnitarioCentavos: 5990,
})

describe('contarItens', () => {
  it('soma as quantidades', () => {
    expect(contarItens([item(2), item(3)])).toBe(5)
    expect(contarItens([])).toBe(0)
  })
})

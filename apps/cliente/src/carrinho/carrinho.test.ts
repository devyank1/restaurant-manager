import { describe, expect, it } from 'vitest'
import {
  carregarCarrinho,
  contarItens,
  reduzirCarrinho,
  salvarCarrinho,
  totalCarrinho,
  type ItemCarrinho,
} from './carrinho'

const novoItem = (precoUnitarioCentavos: number, quantidade: number) => ({
  pratoId: 'p',
  nome: 'Prato',
  resumoOpcoes: '',
  selecao: {},
  observacao: '',
  quantidade,
  precoUnitarioCentavos,
})

function storageEmMemoria(): Storage {
  const dados = new Map<string, string>()
  return {
    get length() {
      return dados.size
    },
    clear: () => dados.clear(),
    getItem: (k) => dados.get(k) ?? null,
    key: (i) => [...dados.keys()][i] ?? null,
    removeItem: (k) => void dados.delete(k),
    setItem: (k, v) => void dados.set(k, v),
  }
}

const storageQuebrado = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('SecurityError')
  },
} as unknown as Storage

describe('reduzirCarrinho', () => {
  it('adiciona com id e soma o total', () => {
    let itens: ItemCarrinho[] = []
    itens = reduzirCarrinho(itens, { tipo: 'adicionar', item: novoItem(5990, 2) })
    itens = reduzirCarrinho(itens, { tipo: 'adicionar', item: novoItem(8790, 1) })
    expect(itens.every((i) => i.id.length > 0)).toBe(true)
    expect(itens[0].id).not.toBe(itens[1].id)
    expect(totalCarrinho(itens)).toBe(20770)
    expect(contarItens(itens)).toBe(3)
  })

  it('quantidade zero remove o item', () => {
    const itens = reduzirCarrinho([], { tipo: 'adicionar', item: novoItem(5990, 1) })
    expect(reduzirCarrinho(itens, { tipo: 'quantidade', id: itens[0].id, quantidade: 0 })).toEqual([])
  })

  it('altera a quantidade', () => {
    const itens = reduzirCarrinho([], { tipo: 'adicionar', item: novoItem(5990, 1) })
    const alterados = reduzirCarrinho(itens, { tipo: 'quantidade', id: itens[0].id, quantidade: 3 })
    expect(alterados[0].quantidade).toBe(3)
  })

  it('remove o item', () => {
    const itens = reduzirCarrinho([], { tipo: 'adicionar', item: novoItem(5990, 1) })
    expect(reduzirCarrinho(itens, { tipo: 'remover', id: itens[0].id })).toEqual([])
  })
})

describe('persistência', () => {
  it('salva e carrega pela chave carrinho:<token>', () => {
    const storage = storageEmMemoria()
    const itens = reduzirCarrinho([], { tipo: 'adicionar', item: novoItem(5990, 1) })
    salvarCarrinho('abc', itens, storage)
    expect(storage.getItem('carrinho:abc')).not.toBeNull()
    expect(carregarCarrinho('abc', storage)).toEqual(itens)
    expect(carregarCarrinho('outra-mesa', storage)).toEqual([])
  })

  it('storage bloqueado não quebra: carrega vazio e salvar não lança', () => {
    expect(carregarCarrinho('abc', storageQuebrado)).toEqual([])
    expect(() => salvarCarrinho('abc', [], storageQuebrado)).not.toThrow()
  })

  it('JSON corrompido carrega vazio', () => {
    const storage = storageEmMemoria()
    storage.setItem('carrinho:abc', '{quebrado')
    expect(carregarCarrinho('abc', storage)).toEqual([])
  })
})

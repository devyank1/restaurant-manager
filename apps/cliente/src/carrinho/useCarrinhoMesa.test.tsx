import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { useCarrinhoMesa } from './useCarrinhoMesa'

const mix = {
  pratoId: 'mix',
  nome: 'Mix da Casa',
  resumoOpcoes: '',
  selecao: {},
  observacao: '',
  quantidade: 1,
  precoUnitarioCentavos: 1, // o cliente manda, o servidor ignora
}

describe('useCarrinhoMesa', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    vi.stubGlobal('fetch', api.fetch)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('carrega o carrinho da mesa', async () => {
    api.estado.itens = [{ ...mix, id: 'x', precoUnitarioCentavos: 5990, quantidade: 2 }]
    const { result } = renderHook(() => useCarrinhoMesa('tok'))
    await waitFor(() => expect(result.current.quantidade).toBe(2))
    expect(result.current.total).toBe(11980)
  })

  it('adicionar manda só prato, seleção, observação e quantidade', async () => {
    const { result } = renderHook(() => useCarrinhoMesa('tok'))
    await act(() => result.current.despachar({ tipo: 'adicionar', item: mix }))
    const [, init] = api.chamadas('POST', /carrinho\/itens$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({ pratoId: 'mix', selecao: {}, observacao: '', quantidade: 1 })
    expect(result.current.itens[0].precoUnitarioCentavos).toBe(5990)
  })

  it('quantidade 0 remove pelo PATCH', async () => {
    api.estado.itens = [{ ...mix, id: 'x' }]
    const { result } = renderHook(() => useCarrinhoMesa('tok'))
    await waitFor(() => expect(result.current.quantidade).toBe(1))
    await act(() => result.current.despachar({ tipo: 'quantidade', id: 'x', quantidade: 0 }))
    expect(result.current.itens).toEqual([])
  })

  it('aplicar usa o carrinho que veio do tempo real', async () => {
    const { result } = renderHook(() => useCarrinhoMesa('tok'))
    act(() => result.current.aplicar({ itens: [{ ...mix, id: 'y', quantidade: 3 }], totalCentavos: 3 }))
    expect(result.current.quantidade).toBe(3)
    expect(result.current.total).toBe(3)
  })

  it('erro do servidor vira mensagem e recarrega', async () => {
    api.uma('POST', /carrinho\/itens$/, () => ({ status: 422, corpo: { mensagem: 'Mix da Casa está esgotado' } }))
    const { result } = renderHook(() => useCarrinhoMesa('tok'))
    await act(() => result.current.despachar({ tipo: 'adicionar', item: mix }))
    expect(result.current.erro).toBe('Mix da Casa está esgotado')
    expect(api.chamadas('GET', /carrinho$/).length).toBeGreaterThanOrEqual(2)
  })
})

import { describe, expect, it } from 'vitest'
import { lerRota, voltaDe } from './rotas'

describe('rotas', () => {
  it('reconhece /mesa/abc e /login?volta=/mesa/abc', () => {
    expect(lerRota('/mesa/abc', '')).toEqual({ nome: 'mesa', token: 'abc' })
    expect(lerRota('/login', '?volta=%2Fmesa%2Fabc')).toEqual({ nome: 'login', volta: '/mesa/abc' })
  })

  it('início, mesas e caminho desconhecido', () => {
    expect(lerRota('/', '')).toEqual({ nome: 'inicio' })
    expect(lerRota('/mesas', '')).toEqual({ nome: 'mesas' })
    expect(lerRota('/qualquer', '')).toEqual({ nome: 'inicio' })
  })

  it('rotas do estoque', () => {
    expect(lerRota('/estoque', '')).toEqual({ nome: 'estoque' })
    expect(lerRota('/estoque/itens', '')).toEqual({ nome: 'estoque-itens' })
    expect(lerRota('/estoque/itens/abc', '')).toEqual({ nome: 'estoque-item', id: 'abc' })
    expect(lerRota('/estoque/fornecedores', '')).toEqual({ nome: 'estoque-fornecedores' })
    expect(lerRota('/estoque/receitas', '')).toEqual({ nome: 'estoque-receitas' })
    expect(lerRota('/estoque/receitas/p1', '')).toEqual({ nome: 'estoque-receita', pratoId: 'p1' })
    expect(lerRota('/estoque/compras', '')).toEqual({ nome: 'estoque-compras' })
    expect(lerRota('/estoque/compras/l1/chegou', '')).toEqual({ nome: 'estoque-chegou', listaId: 'l1' })
    expect(lerRota('/estoque/compras/f/granja', '')).toEqual({ nome: 'estoque-pedido', fornecedorId: 'granja' })
  })

  it('telas de gestão', () => {
    expect(lerRota('/tempos', '')).toEqual({ nome: 'tempos' })
    expect(voltaDe({ nome: 'tempos' })).toBe('/')
    expect(lerRota('/metas', '')).toEqual({ nome: 'metas' })
    expect(lerRota('/metas/garcom/u%2D1', '')).toEqual({ nome: 'meta-pessoa', id: 'u-1' })
    expect(voltaDe({ nome: 'metas' })).toBe('/')
    expect(voltaDe({ nome: 'meta-pessoa', id: 'x' })).toBe('/metas')
    expect(lerRota('/hoje/Cozinha', '')).toEqual({ nome: 'hoje', estacao: 'Cozinha' })
    expect(lerRota('/hoje/Caf%C3%A9', '')).toEqual({ nome: 'hoje', estacao: 'Café' })
    expect(voltaDe({ nome: 'hoje', estacao: 'Bar' })).toBe('/')
  })

  it('Voltar leva para a tela de cima', () => {
    expect(voltaDe({ nome: 'inicio' })).toBeNull()
    expect(voltaDe({ nome: 'mesas' })).toBe('/')
    expect(voltaDe({ nome: 'mesa', token: 't' })).toBe('/')
    expect(voltaDe({ nome: 'producao' })).toBe('/')
    expect(voltaDe({ nome: 'estoque' })).toBe('/')
    expect(voltaDe({ nome: 'estoque-itens' })).toBe('/estoque')
    expect(voltaDe({ nome: 'estoque-item', id: 'x' })).toBe('/estoque/itens')
    expect(voltaDe({ nome: 'estoque-receitas' })).toBe('/estoque')
    expect(voltaDe({ nome: 'estoque-receita', pratoId: 'p' })).toBe('/estoque/receitas')
    expect(voltaDe({ nome: 'estoque-fornecedores' })).toBe('/estoque')
    expect(voltaDe({ nome: 'estoque-compras' })).toBe('/estoque')
    expect(voltaDe({ nome: 'estoque-pedido', fornecedorId: 'f' })).toBe('/estoque/compras')
    expect(voltaDe({ nome: 'estoque-chegou', listaId: 'l' })).toBe('/estoque')
  })

  it('rotas da central', () => {
    expect(lerRota('/', '')).toEqual({ nome: 'inicio' })
    expect(lerRota('/central', '')).toEqual({ nome: 'central' })
    expect(lerRota('/dia', '')).toEqual({ nome: 'dia' })
    expect(lerRota('/limites', '')).toEqual({ nome: 'limites' })
    expect(lerRota('/central/garcom/abc', '')).toEqual({ nome: 'central-garcom', id: 'abc' })
    expect(lerRota('/central/garcom/u%2D1', '')).toEqual({ nome: 'central-garcom', id: 'u-1' })
    expect(voltaDe({ nome: 'central' })).toBeNull()
    expect(voltaDe({ nome: 'dia' })).toBe('/')
    expect(voltaDe({ nome: 'limites' })).toBe('/')
    expect(voltaDe({ nome: 'central-garcom', id: 'x' })).toBe('/')
  })

  it('volta só aceita caminho interno', () => {
    expect(lerRota('/login', '?volta=https://mal.com')).toEqual({ nome: 'login' })
    expect(lerRota('/login', '?volta=//mal.com')).toEqual({ nome: 'login' })
  })
})

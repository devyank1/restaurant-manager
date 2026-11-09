import { describe, expect, it } from 'vitest'
import { lerRota } from './rotas'

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
  })

  it('volta só aceita caminho interno', () => {
    expect(lerRota('/login', '?volta=https://mal.com')).toEqual({ nome: 'login' })
    expect(lerRota('/login', '?volta=//mal.com')).toEqual({ nome: 'login' })
  })
})

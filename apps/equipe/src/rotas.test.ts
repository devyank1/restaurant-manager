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

  it('volta só aceita caminho interno', () => {
    expect(lerRota('/login', '?volta=https://mal.com')).toEqual({ nome: 'login' })
    expect(lerRota('/login', '?volta=//mal.com')).toEqual({ nome: 'login' })
  })
})

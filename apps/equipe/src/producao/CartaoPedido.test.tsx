import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PedidoProducao } from '../api/tipos'
import CartaoPedido from './CartaoPedido'

const T0 = new Date('2026-11-10T23:00:00Z').getTime()

function pedido(esperadoMin: number): PedidoProducao {
  return {
    rodadaId: 'r1',
    mesa: { numero: 7 },
    garcomNome: null,
    confirmadaEm: new Date(T0).toISOString(),
    esperadoMin,
    cancelada: false,
    itens: [{ id: 'i1', nome: 'Pizza', resumoOpcoes: '', observacao: '', quantidade: 1, status: 'NA_FILA' }],
  }
}

const classeAos = (esperadoMin: number, minutos: number) => {
  const { unmount } = render(
    <CartaoPedido
      pedido={pedido(esperadoMin)}
      agora={T0 + minutos * 60_000}
      ocupado={false}
      onItem={vi.fn()}
      onEstacao={vi.fn()}
      onOk={vi.fn()}
    />,
  )
  const classe = screen.getByRole('article', { name: 'Mesa 7' }).className
  unmount()
  return classe
}

describe('Cartão da produção', () => {
  it('esperado 20: amarelo depois de 22 min, vermelho depois de 40', () => {
    expect(classeAos(20, 22)).not.toMatch(/alerta|perigo/)
    expect(classeAos(20, 23)).toMatch(/cartao-producao--alerta/)
    expect(classeAos(20, 40)).toMatch(/cartao-producao--alerta/)
    expect(classeAos(20, 41)).toMatch(/cartao-producao--perigo/)
  })

  it('esperado 30: 25 min ainda neutro', () => {
    expect(classeAos(30, 25)).not.toMatch(/alerta|perigo/)
  })
})

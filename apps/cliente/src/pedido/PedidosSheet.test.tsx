import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { RodadaPublica } from '../api/tipos'
import { reais } from '../test/reais'
import PedidosSheet from './PedidosSheet'

const rodada = (id: string, status: RodadaPublica['status'], totalCentavos: number): RodadaPublica => ({
  id,
  status,
  criadoEm: '2026-11-06T20:00:00.000Z',
  totalCentavos,
  itens: [{ nome: `Prato ${id}`, resumoOpcoes: 'G', observacao: '', quantidade: 1, precoUnitarioCentavos: totalCentavos }],
})

describe('PedidosSheet', () => {
  it('PedidosSheet mostra status e total parcial', () => {
    render(
      <PedidosSheet
        rodadas={[rodada('a', 'CONFIRMADA', 5990), rodada('b', 'AGUARDANDO_GARCOM', 6990), rodada('c', 'CANCELADA', 100)]}
        totalParcialCentavos={5990}
        onFechar={vi.fn()}
      />,
    )
    const painel = screen.getByRole('dialog', { name: 'Seus pedidos' })
    expect(within(painel).getByText('Confirmado')).toBeInTheDocument()
    expect(within(painel).getByText('Aguardando garçom')).toBeInTheDocument()
    expect(within(painel).getByText('Cancelado')).toBeInTheDocument()
    expect(within(painel).getByText('Prato b')).toBeInTheDocument()
    expect(within(painel).getByText(`Total parcial ${reais(5990)}`)).toBeInTheDocument()
  })

  it('fechar chama onFechar', async () => {
    const onFechar = vi.fn()
    render(<PedidosSheet rodadas={[]} totalParcialCentavos={0} onFechar={onFechar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onFechar).toHaveBeenCalled()
  })
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { RodadaPublica } from '../api/tipos'
import { reais } from '../test/reais'
import PedidosSheet from './PedidosSheet'

const rodada = (id: string, fase: RodadaPublica['fase'], totalCentavos: number): RodadaPublica => ({
  id,
  status: fase === 'AGUARDANDO_GARCOM' || fase === 'CANCELADA' ? fase : 'CONFIRMADA',
  fase,
  criadoEm: '2026-11-06T20:00:00.000Z',
  totalCentavos,
  itens: [{ nome: `Prato ${id}`, resumoOpcoes: 'G', observacao: '', quantidade: 1, precoUnitarioCentavos: totalCentavos }],
})

describe('PedidosSheet', () => {
  it('PedidosSheet mostra status e total parcial', () => {
    render(
      <PedidosSheet
        rodadas={[rodada('a', 'NA_COZINHA', 5990), rodada('b', 'AGUARDANDO_GARCOM', 6990), rodada('c', 'CANCELADA', 100)]}
        totalParcialCentavos={5990}
        onFechar={vi.fn()}
      />,
    )
    const painel = screen.getByRole('dialog', { name: 'Seus pedidos' })
    expect(within(painel).getByText('Na cozinha')).toBeInTheDocument()
    expect(within(painel).getByText('Aguardando garçom')).toBeInTheDocument()
    expect(within(painel).getByText('Cancelado')).toBeInTheDocument()
    expect(within(painel).getByText('Prato b')).toBeInTheDocument()
    expect(within(painel).getByText(`Total parcial ${reais(5990)}`)).toBeInTheDocument()
  })

  it("fase NA_COZINHA mostra 'Na cozinha', PRONTO mostra 'Pronto' e ENTREGUE mostra 'Entregue'", () => {
    render(
      <PedidosSheet
        rodadas={[rodada('a', 'NA_COZINHA', 100), rodada('b', 'PRONTO', 100), rodada('c', 'ENTREGUE', 100)]}
        totalParcialCentavos={300}
        onFechar={vi.fn()}
      />,
    )
    const painel = screen.getByRole('dialog', { name: 'Seus pedidos' })
    expect(within(painel).getByText('Na cozinha')).toBeInTheDocument()
    expect(within(painel).getByText('Pronto')).toBeInTheDocument()
    expect(within(painel).getByText('Entregue')).toBeInTheDocument()
  })

  it('fechar chama onFechar', async () => {
    const onFechar = vi.fn()
    render(<PedidosSheet rodadas={[]} totalParcialCentavos={0} onFechar={onFechar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onFechar).toHaveBeenCalled()
  })
})

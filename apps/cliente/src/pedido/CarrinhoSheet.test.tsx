import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ItemCarrinho } from '../carrinho/carrinho'
import { reais } from '../test/reais'
import CarrinhoSheet from './CarrinhoSheet'

const itens: ItemCarrinho[] = [
  {
    id: 'i1',
    pratoId: 'pizza',
    nome: 'Pizza Margherita',
    resumoOpcoes: 'M · Margherita / Quatro Queijos',
    selecao: {},
    observacao: 'sem cebola',
    quantidade: 2,
    precoUnitarioCentavos: 7990,
  },
  {
    id: 'i2',
    pratoId: 'mix',
    nome: 'Mix da Casa',
    resumoOpcoes: '',
    selecao: {},
    observacao: '',
    quantidade: 1,
    precoUnitarioCentavos: 5990,
  },
]

describe('CarrinhoSheet', () => {
  it('lista itens com resumo, observação, subtotal e total', () => {
    render(<CarrinhoSheet itens={itens} total={21970} despachar={vi.fn()} onFechar={vi.fn()} />)
    const pizza = screen.getByRole('listitem', { name: 'Pizza Margherita' })
    expect(within(pizza).getByText('M · Margherita / Quatro Queijos')).toBeInTheDocument()
    expect(within(pizza).getByText('Obs.: sem cebola')).toBeInTheDocument()
    expect(within(pizza).getByText(reais(15980))).toBeInTheDocument()
    expect(screen.getByText(`Total ${reais(21970)}`)).toBeInTheDocument()
  })

  it('diminuir com quantidade 1 remove o item', async () => {
    const despachar = vi.fn()
    render(<CarrinhoSheet itens={itens} total={21970} despachar={despachar} onFechar={vi.fn()} />)
    const mix = screen.getByRole('listitem', { name: 'Mix da Casa' })
    await userEvent.click(within(mix).getByRole('button', { name: 'Diminuir quantidade' }))
    expect(despachar).toHaveBeenCalledWith({ tipo: 'quantidade', id: 'i2', quantidade: 0 })
  })

  it('aumentar soma um', async () => {
    const despachar = vi.fn()
    render(<CarrinhoSheet itens={itens} total={21970} despachar={despachar} onFechar={vi.fn()} />)
    const pizza = screen.getByRole('listitem', { name: 'Pizza Margherita' })
    await userEvent.click(within(pizza).getByRole('button', { name: 'Aumentar quantidade' }))
    expect(despachar).toHaveBeenCalledWith({ tipo: 'quantidade', id: 'i1', quantidade: 3 })
  })

  it('carrinho vazio avisa', () => {
    render(<CarrinhoSheet itens={[]} total={0} despachar={vi.fn()} onFechar={vi.fn()} />)
    expect(screen.getByText('Seu pedido está vazio')).toBeInTheDocument()
  })

  it('envio ainda desabilitado nesta versão', () => {
    render(<CarrinhoSheet itens={itens} total={21970} despachar={vi.fn()} onFechar={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled()
    expect(screen.getByText('O envio para o garçom chega na próxima versão.')).toBeInTheDocument()
  })
})

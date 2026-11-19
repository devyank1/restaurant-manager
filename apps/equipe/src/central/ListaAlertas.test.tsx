import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CentralResposta } from '../api/tipos'
import ListaAlertas from './ListaAlertas'

type Alerta = CentralResposta['alertas'][number]
const alerta = (a: Partial<Alerta>): Alerta => ({
  chave: 'k',
  tipo: 'PEDIDO_ATRASADO',
  gravidade: 'MEDIA',
  titulo: 'Titulo',
  detalhe: 'Detalhe',
  desde: '2026-11-11T11:50:00.000Z',
  link: null,
  ...a,
})
const AGORA = '2026-11-11T12:00:00.000Z'

describe('ListaAlertas', () => {
  beforeEach(() => window.history.pushState({}, '', '/'))

  it('sem alertas diz que está tudo certo', () => {
    render(<ListaAlertas alertas={[]} agora={AGORA} />)
    expect(screen.getByText('Tudo certo agora')).toBeInTheDocument()
  })

  it('mostra na ordem recebida, com rótulo de texto e tempo', () => {
    render(
      <ListaAlertas
        agora={AGORA}
        alertas={[
          alerta({ chave: 'a', gravidade: 'MEDIA', titulo: 'Segundo?', detalhe: 'd1' }),
          alerta({ chave: 'b', gravidade: 'ALTA', titulo: 'Mesa 3 esperando', detalhe: 'd2', link: '/mesas' }),
          alerta({ chave: 'c', gravidade: 'BAIXA', titulo: 'Terceiro', detalhe: 'd3' }),
        ]}
      />,
    )
    const itens = screen.getAllByRole('listitem')
    expect(itens.map((li) => li.querySelector('.alerta-titulo')?.textContent)).toEqual([
      'Segundo?',
      'Mesa 3 esperando',
      'Terceiro',
    ])
    expect(within(itens[0]).getByText('Atenção')).toBeInTheDocument()
    expect(within(itens[1]).getByText('Urgente')).toBeInTheDocument()
    expect(within(itens[2]).getByText('Aviso')).toBeInTheDocument()
    expect(within(itens[1]).getByText('há 10 min')).toBeInTheDocument()
    expect(within(itens[1]).getByText('d2')).toBeInTheDocument()
    expect(document.body.innerHTML).not.toMatch(/perigo/)
  })

  it('link vira botão Ver que navega', async () => {
    render(<ListaAlertas agora={AGORA} alertas={[alerta({ link: '/mesas' }), alerta({ chave: 'x' })]} />)
    const botoes = screen.getAllByRole('button', { name: 'Ver' })
    expect(botoes).toHaveLength(1)
    await userEvent.click(botoes[0])
    expect(window.location.pathname).toBe('/mesas')
  })

  it('alerta de estoque crítico tem Ver que leva ao estoque', async () => {
    render(<ListaAlertas agora={AGORA} alertas={[alerta({ tipo: 'ESTOQUE_CRITICO', link: '/estoque' })]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver' }))
    expect(window.location.pathname).toBe('/estoque')
  })
})

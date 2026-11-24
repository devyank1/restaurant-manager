import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CentralResposta } from '../api/tipos'
import CartoesCarga from './CartoesCarga'

type G = CentralResposta['cargaGarcons'][number]
const g = (p: Partial<G>): G => ({
  id: 'u-ana',
  nome: 'Ana',
  mesasAbertas: 2,
  chamadosPendentes: 1,
  carga: 4,
  faixa: 'TRANQUILO',
  emTurnoDesde: null,
  ...p,
})

describe('CartoesCarga', () => {
  beforeEach(() => window.history.pushState({}, '', '/'))

  const grupo = { garconsEmTurno: 2, cargaTotal: 14, cargaMedia: 7 }

  it('garçons na ordem recebida, faixa em texto, sem vermelho', async () => {
    const { container } = render(
      <CartoesCarga
        garcons={[g({}), g({ id: 'u-bia', nome: 'Bia', carga: 10, faixa: 'SOBRECARREGADO', mesasAbertas: 5, chamadosPendentes: 0 })]}
        estacoes={[{ estacao: 'Cozinha', naFila: 3, emPreparo: 2, carga: 5, maisAntigoMin: 12 }]}
        grupo={grupo}
      />,
    )
    expect(screen.getByText('2 garçons em turno · carga média 7')).toBeInTheDocument()
    const botoes = screen.getAllByRole('button')
    expect(botoes.map((b) => b.querySelector('.carga-nome')?.textContent)).toEqual(['Ana', 'Bia'])
    expect(within(botoes[0]).getByText('2 mesas · 1 chamado')).toBeInTheDocument()
    expect(within(botoes[0]).getByText('tranquilo')).toBeInTheDocument()
    expect(within(botoes[1]).getByText('sobrecarregado')).toBeInTheDocument()
    expect(screen.getByText('3 na fila · 2 em preparo')).toBeInTheDocument()
    expect(screen.getByText('mais antigo: 12 min')).toBeInTheDocument()
    expect(container.innerHTML).not.toMatch(/perigo/)
    await userEvent.click(botoes[0])
    expect(window.location.pathname).toBe('/central/garcom/u-ana')
  })

  it('singular e zero nos cartões de garçom', () => {
    render(<CartoesCarga garcons={[g({ mesasAbertas: 1, chamadosPendentes: 0 })]} estacoes={[]} grupo={grupo} />)
    expect(screen.getByText('1 mesa · 0 chamados')).toBeInTheDocument()
  })

  it('listas vazias mostram mensagem neutra', () => {
    render(<CartoesCarga garcons={[]} estacoes={[]} grupo={{ garconsEmTurno: 0, cargaTotal: 0, cargaMedia: null }} />)
    expect(screen.getByText('Nenhum garçom em turno')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma estação com pedidos')).toBeInTheDocument()
  })
})

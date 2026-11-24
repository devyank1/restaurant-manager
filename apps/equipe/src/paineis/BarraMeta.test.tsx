import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProgressoMeta } from '../api/tipos'
import { reais } from '../test/reais'
import BarraMeta from './BarraMeta'

const meta = (m: Partial<ProgressoMeta> = {}): ProgressoMeta => ({
  tipo: 'VALOR',
  periodo: 'DIA',
  alvo: 200000,
  atual: 120000,
  batida: false,
  pct: 60,
  ...m,
})

describe('BarraMeta', () => {
  it('abaixo do alvo: neutra, com o texto em reais', () => {
    const { container } = render(<BarraMeta meta={meta()} rotulo="Meta da equipe" />)
    expect(screen.getByText(`${reais(120000)} de ${reais(200000)}`)).toBeInTheDocument()
    expect(screen.getByText('hoje')).toBeInTheDocument()
    expect(container.firstElementChild).not.toHaveClass('barra-meta--batida')
    expect(screen.queryByText(/Meta batida/)).not.toBeInTheDocument()
  })

  it('batida: classe batida e Meta batida!', () => {
    const { container } = render(
      <BarraMeta meta={meta({ tipo: 'MESAS', periodo: 'SEMANA', alvo: 10, atual: 12, batida: true, pct: 100 })} rotulo="Mesas" />,
    )
    expect(container.firstElementChild).toHaveClass('barra-meta--batida')
    expect(screen.getByText(/12 de 10 mesas/)).toBeInTheDocument()
    expect(screen.getByText(/Meta batida! 🎉/)).toBeInTheDocument()
    expect(screen.getByText('na semana')).toBeInTheDocument()
  })

  it('nunca usa classe de perigo', () => {
    const { container } = render(<BarraMeta meta={meta({ atual: 0, pct: 0 })} rotulo="Meta" />)
    expect(container.innerHTML).not.toMatch(/perigo|alerta|erro/)
  })

  it('meter com valores para leitor de tela', () => {
    render(<BarraMeta meta={meta()} rotulo="Meta da equipe" />)
    const barra = screen.getByRole('meter', { name: 'Meta da equipe' })
    expect(barra).toHaveAttribute('aria-valuemin', '0')
    expect(barra).toHaveAttribute('aria-valuemax', '200000')
    expect(barra).toHaveAttribute('aria-valuenow', '120000')
  })

  it('estação: % no tempo e esquecidos', () => {
    render(
      <>
        <BarraMeta meta={meta({ tipo: 'NO_TEMPO', alvo: 85, atual: 82, pct: 96 })} rotulo="No tempo" />
        <BarraMeta meta={meta({ tipo: 'ESQUECIDOS', alvo: 0, atual: 0, batida: true, pct: 100 })} rotulo="Esquecidos" />
        <BarraMeta meta={meta({ tipo: 'ESQUECIDOS', alvo: 0, atual: 2, pct: 0 })} rotulo="Esquecidos 2" />
      </>,
    )
    expect(screen.getByText('82% no tempo · meta 85%')).toBeInTheDocument()
    expect(screen.getByText(/Nenhum esquecido/)).toBeInTheDocument()
    expect(screen.getByText('2 esquecidos')).toBeInTheDocument()
  })
})

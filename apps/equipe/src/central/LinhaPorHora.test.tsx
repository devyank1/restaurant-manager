import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LinhaPorHora from './LinhaPorHora'

describe('LinhaPorHora', () => {
  it('desenha duas linhas, hoje cheia e média tracejada', () => {
    const { container } = render(
      <LinhaPorHora pontos={[{ hora: 18, hoje: 3, media: 2 }, { hora: 19, hoje: 6, media: 5 }]} />,
    )
    const linhas = container.querySelectorAll('polyline')
    expect(linhas).toHaveLength(2)
    expect(container.querySelector('.por-hora-hoje')?.getAttribute('stroke-dasharray')).toBeNull()
    expect(container.querySelector('.por-hora-media')?.getAttribute('stroke-dasharray')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Pedidos por hora: hoje contra a média/ })).toBeInTheDocument()
    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.getByText('Média')).toBeInTheDocument()
  })

  it('sem pontos mostra mensagem', () => {
    const { container } = render(<LinhaPorHora pontos={[]} />)
    expect(screen.getByText('Sem movimento ainda')).toBeInTheDocument()
    expect(container.querySelectorAll('polyline')).toHaveLength(0)
  })
})

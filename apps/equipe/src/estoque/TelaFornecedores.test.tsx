import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla, estoqueDemo } from '../test/estoque-fixtures'
import TelaFornecedores from './TelaFornecedores'

describe('Fornecedores', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    api.estado.estoque = estoqueDemo()
    api.estado.estoque.fornecedores.push({ id: 'sem-tel', nome: 'Feira', telefone: null, observacao: null })
    vi.stubGlobal('fetch', api.fetch)
  })

  it('Chamar no WhatsApp abre a conversa com o fornecedor', async () => {
    render(<TelaFornecedores />)
    const link = await screen.findByRole('link', { name: 'Chamar Granja Boa no WhatsApp' })
    expect(link).toHaveAttribute('href', 'https://wa.me/5511988887777')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('fornecedor sem telefone não tem o botão', async () => {
    render(<TelaFornecedores />)
    expect(await screen.findByText('Feira')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Chamar Feira no WhatsApp' })).not.toBeInTheDocument()
  })
})

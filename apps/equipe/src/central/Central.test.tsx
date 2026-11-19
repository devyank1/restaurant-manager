import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { carla } from '../test/estoque-fixtures'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { centralVazia } from '../test/paineis-falso'
import { reais } from '../test/reais'
import { socketsFalsos } from '../test/socket-falso'
import Central from './Central'

describe('Central', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    api.estado.paineis.central = {
      ...centralVazia(),
      alertas: [
        { chave: 'a', tipo: 'SEM_GARCOM', gravidade: 'ALTA', titulo: 'Sem garçom', detalhe: 'Ninguém em turno', desde: '2026-11-11T11:55:00.000Z', link: null },
      ],
      contexto: { faturamentoCentavos: 150000, ticketMedioCentavos: null, porHora: [] },
    }
    vi.stubGlobal('fetch', api.fetch)
    window.history.pushState({}, '', '/')
  })

  const pedidos = () => api.chamadas('GET', /\/painel\/central$/).length

  it('busca ao montar e mostra alertas, horário e contexto', async () => {
    render(<Central />)
    expect(await screen.findByText('Sem garçom')).toBeInTheDocument()
    expect(screen.getByText('Agora')).toBeInTheDocument()
    expect(screen.getByText('Atualizado às 09:00')).toBeInTheDocument()
    expect(screen.getByText(reais(150000))).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(pedidos()).toBe(1)
  })

  it('erro de rede com role alert mantém os dados anteriores', async () => {
    render(<Central />)
    await screen.findByText('Sem garçom')
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('falhou')))
    act(() => {
      for (const s of socketsFalsos) s.servidor('central-mudou', {})
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão')
    expect(screen.getByText('Sem garçom')).toBeInTheDocument()
  })

  it('central-mudou busca de novo', async () => {
    render(<Central />)
    await screen.findByText('Sem garçom')
    const antes = pedidos()
    act(() => {
      for (const s of socketsFalsos) s.servidor('central-mudou', {})
    })
    await waitFor(() => expect(pedidos()).toBeGreaterThan(antes))
  })

  it('atalhos navegam', async () => {
    render(<Central />)
    await screen.findByText('Sem garçom')
    const vai = async (nome: string, caminho: string) => {
      await userEvent.click(screen.getByRole('button', { name: nome }))
      expect(window.location.pathname).toBe(caminho)
    }
    await vai('Estoque', '/estoque')
    await vai('Metas', '/metas')
    await vai('Tempo de preparo', '/tempos')
    await vai('Limites', '/limites')
    await vai('Detalhes do dia', '/dia')
  })
})

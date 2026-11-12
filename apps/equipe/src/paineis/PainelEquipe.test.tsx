import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CartaoPessoa, PainelEquipe as Painel, ProgressoMeta } from '../api/tipos'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla } from '../test/estoque-fixtures'
import { painelVazio } from '../test/paineis-falso'
import { reais } from '../test/reais'
import { socketsFalsos } from '../test/socket-falso'
import PainelEquipe from './PainelEquipe'

const meta = (m: Partial<ProgressoMeta> = {}): ProgressoMeta => ({
  tipo: 'VALOR',
  periodo: 'DIA',
  alvo: 200000,
  atual: 120000,
  batida: false,
  pct: 60,
  ...m,
})

const pessoa = (p: Partial<CartaoPessoa> = {}): CartaoPessoa => ({
  id: 'u-ana',
  nome: 'Ana',
  emTurno: true,
  emTurnoDesde: '2026-11-11T21:00:00.000Z',
  avisos: [],
  metas: [],
  mesasHoje: 0,
  ...p,
})

describe('Painel da equipe', () => {
  let api: ApiFalsa
  let painel: Painel

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    painel = painelVazio()
    api.estado.paineis.equipe = painel
    vi.stubGlobal('fetch', api.fetch)
    window.history.pushState({}, '', '/')
  })

  const pedidosDoPainel = (periodo = 'DIA') => api.chamadas('GET', new RegExp(`/painel\\?periodo=${periodo}$`)).length

  it('dono vê a meta da equipe no topo', async () => {
    painel.metaEquipe = [meta()]
    render(<PainelEquipe atencao={0} />)
    const bloco = await screen.findByRole('region', { name: 'Meta da equipe' })
    expect(within(bloco).getByRole('meter', { name: 'Valor vendido pela equipe' })).toBeInTheDocument()
    expect(within(bloco).getByText(`${reais(120000)} de ${reais(200000)}`)).toBeInTheDocument()
  })

  it('sem meta mostra Definir em Metas', async () => {
    render(<PainelEquipe atencao={0} />)
    const bloco = await screen.findByRole('region', { name: 'Meta da equipe' })
    expect(within(bloco).getByText(/Sem meta da equipe/)).toBeInTheDocument()
    await userEvent.click(within(bloco).getByRole('button', { name: 'Definir em Metas' }))
    expect(window.location.pathname).toBe('/metas')
  })

  it('cartões na ordem da API e aviso de cuidado no cartão', async () => {
    painel.pessoas = [
      pessoa({ id: 'u-bruno', nome: 'Bruno', avisos: ['5 h em turno sem pausa'] }),
      pessoa({ emTurno: false, emTurnoDesde: null }),
    ]
    render(<PainelEquipe atencao={0} />)
    const equipe = await screen.findByRole('region', { name: 'Equipe' })
    const cartoes = within(equipe).getAllByRole('article')
    expect(cartoes.map((c) => c.getAttribute('aria-label'))).toEqual(['Bruno', 'Ana'])
    expect(within(cartoes[0]).getByText('5 h em turno sem pausa')).toHaveClass('aviso-cuidado')
    expect(within(cartoes[0]).getByText(/^Em turno desde 18:00 · 0 mesas hoje$/)).toBeInTheDocument()
    expect(within(cartoes[1]).getByText(/^Fora do turno/)).toBeInTheDocument()
    expect(equipe.innerHTML).not.toMatch(/perigo/)
  })

  it('cartão sem meta mostra Sem meta definida', async () => {
    painel.pessoas = [pessoa(), pessoa({ id: 'u-bruno', nome: 'Bruno', metas: [meta({ tipo: 'MESAS', alvo: 10, atual: 6 })] })]
    render(<PainelEquipe atencao={0} />)
    const ana = await screen.findByRole('article', { name: 'Ana' })
    expect(within(ana).getByText('Sem meta definida')).toBeInTheDocument()
    const bruno = screen.getByRole('article', { name: 'Bruno' })
    expect(within(bruno).getByRole('meter', { name: 'Mesas atendidas' })).toBeInTheDocument()
  })

  it('Semana pede periodo=SEMANA', async () => {
    render(<PainelEquipe atencao={0} />)
    await screen.findByRole('region', { name: 'Equipe' })
    const semana = screen.getByRole('button', { name: 'Semana' })
    expect(semana).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(semana)
    await waitFor(() => expect(pedidosDoPainel('SEMANA')).toBe(1))
    expect(semana).toHaveAttribute('aria-pressed', 'true')
  })

  it('socket painel-mudou recarrega', async () => {
    render(<PainelEquipe atencao={0} />)
    await screen.findByRole('region', { name: 'Equipe' })
    const antes = pedidosDoPainel()
    act(() => {
      for (const s of socketsFalsos) s.servidor('painel-mudou', {})
    })
    await waitFor(() => expect(pedidosDoPainel()).toBeGreaterThan(antes))
  })

  it('atalhos Estoque, Metas e Tempo de preparo navegam', async () => {
    render(<PainelEquipe atencao={3} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Estoque · 3 acabando' }))
    expect(window.location.pathname).toBe('/estoque')
    await userEvent.click(screen.getByRole('button', { name: 'Metas' }))
    expect(window.location.pathname).toBe('/metas')
    await userEvent.click(screen.getByRole('button', { name: 'Tempo de preparo' }))
    expect(window.location.pathname).toBe('/tempos')
  })

  it('operação: ticket médio e mais pedidos', async () => {
    painel.operacao = {
      ...painel.operacao,
      faturamentoCentavos: 300000,
      contas: 4,
      ticketMedioCentavos: 75000,
      maisVendidos: [
        { nome: 'Pizza', quantidade: 12 },
        { nome: 'Suco', quantidade: 5 },
      ],
      porHora: [{ hora: 20, rodadas: 7 }],
      estacoes: [
        { estacao: 'Cozinha', pedidos: 9, avaliados: 8, noTempo: 6, noTempoPct: 75, mediaMin: 14, esquecidos: [] },
      ],
      chamadosDemorados: { quantidade: 2, mediaRespostaSeg: 95 },
      perdasSemana: [{ item: 'Tomate', unidade: 'G', quantidade: 1500, motivo: 'VALIDADE' }],
    }
    render(<PainelEquipe atencao={0} />)
    const op = await screen.findByRole('region', { name: 'Operação' })
    expect(within(op).getByText(reais(75000))).toBeInTheDocument()
    expect(within(op).getByText(reais(300000))).toBeInTheDocument()
    const mais = within(op).getByRole('list', { name: 'Mais pedidos' })
    expect(within(mais).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Pizza · 12', 'Suco · 5'])
    expect(within(op).getByText('20h')).toBeInTheDocument()
    expect(within(op).getByText(/75% no tempo/)).toBeInTheDocument()
    expect(within(op).getByText(/2 chamados demoraram/)).toBeInTheDocument()
    expect(within(op).getByText(/Tomate/)).toHaveTextContent('Tomate · 1,5 kg · Validade')
  })
})

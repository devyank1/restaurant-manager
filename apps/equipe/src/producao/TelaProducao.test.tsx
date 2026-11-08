import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PedidoProducao } from '../api/tipos'
import { criarApiFalsa, dani, type ApiFalsa } from '../test/api-falsa'
import { ultimoSocket } from '../test/socket-falso'
import TelaProducao from './TelaProducao'
import { liberarSom, tocarBipe } from './somEPresenca'

vi.mock('./somEPresenca', () => ({
  liberarSom: vi.fn(() => true),
  tocarBipe: vi.fn(),
  manterTelaLigada: vi.fn(() => () => undefined),
}))

const minutosAtras = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

function pedido(mesa: number, itens: Partial<PedidoProducao['itens'][number]>[], extra: Partial<PedidoProducao> = {}) {
  return {
    rodadaId: `r-${mesa}`,
    mesa: { numero: mesa },
    garcomNome: 'Ana',
    confirmadaEm: minutosAtras(2),
    cancelada: false,
    itens: itens.map((i, n) => ({
      id: `i-${mesa}-${n}`,
      nome: 'Mix da Casa',
      resumoOpcoes: '',
      observacao: '',
      quantidade: 1,
      status: 'NA_FILA' as const,
      ...i,
    })),
    ...extra,
  }
}

describe('TelaProducao', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...dani }
    api.estado.producao = {
      Cozinha: [pedido(7, [{ nome: 'Mix da Casa', observacao: 'sem cebola' }, { nome: 'Pudim de Leite' }])],
      Bar: [pedido(8, [{ nome: 'Suco Natural', quantidade: 2 }])],
    }
    vi.stubGlobal('fetch', api.fetch)
    try {
      localStorage.clear()
      localStorage.setItem('estacao', 'Cozinha')
    } catch {
      // sem storage: tudo bem
    }
    vi.mocked(tocarBipe).mockClear()
    vi.mocked(liberarSom).mockClear()
  })

  const cartao = async (mesa: number) => (await screen.findByRole('article', { name: `Mesa ${mesa}` }))

  it('mostra os pedidos da estação escolhida e troca pelo chip', async () => {
    render(<TelaProducao />)
    const sete = await cartao(7)
    expect(within(sete).getByText('Mix da Casa')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Mesa 8' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Bar' }))
    const oito = await cartao(8)
    expect(within(oito).getByText('Suco Natural')).toBeInTheDocument()
    expect(within(oito).getByText('2×')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bar' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sem estação guardada abre a primeira e guarda a escolhida', async () => {
    localStorage.clear()
    render(<TelaProducao />)
    expect(await cartao(8)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cozinha' }))
    expect(await cartao(7)).toBeInTheDocument()
    expect(localStorage.getItem('estacao')).toBe('Cozinha')
  })

  it('tocar no item avança o status', async () => {
    render(<TelaProducao />)
    const sete = await cartao(7)
    await userEvent.click(within(sete).getByRole('button', { name: /Mix da Casa: Na fila/ }))
    expect(api.chamadas('PATCH', /\/api\/equipe\/producao\/itens\/i-7-0$/)).toHaveLength(1)
    expect(await within(sete).findByRole('button', { name: /Mix da Casa: Preparando/ })).toBeInTheDocument()
    await userEvent.click(within(sete).getByRole('button', { name: /Mix da Casa: Preparando/ }))
    expect(await within(sete).findByRole('button', { name: /Mix da Casa: Pronto/ })).toBeDisabled()
  })

  it('Começar e Pronto mandam a estação inteira', async () => {
    render(<TelaProducao />)
    const sete = await cartao(7)
    await userEvent.click(within(sete).getByRole('button', { name: 'Começar' }))
    const [url, init] = api.chamadas('PATCH', /\/api\/equipe\/producao\/rodadas\/r-7$/)[0]
    expect(String(url)).toContain('r-7')
    expect(JSON.parse(String(init?.body))).toEqual({ estacao: 'Cozinha', status: 'EM_PREPARO' })
    await userEvent.click(await within(sete).findByRole('button', { name: 'Pronto' }))
    expect(api.chamadas('PATCH', /\/rodadas\/r-7$/)).toHaveLength(2)
    expect(JSON.parse(String(api.chamadas('PATCH', /\/rodadas\/r-7$/)[1][1]?.body))).toEqual({
      estacao: 'Cozinha',
      status: 'PRONTO',
    })
  })

  it('observação aparece em destaque', async () => {
    render(<TelaProducao />)
    const sete = await cartao(7)
    expect(within(sete).getByText('sem cebola')).toHaveClass('producao-obs')
  })

  it('cancelado fica vermelho e Ok esconde', async () => {
    api.estado.producao.Cozinha = [pedido(9, [{ nome: 'Pudim de Leite' }], { cancelada: true })]
    render(<TelaProducao />)
    const nove = await cartao(9)
    expect(nove).toHaveClass('cartao-producao--cancelado')
    expect(within(nove).getByText('Cancelado')).toBeInTheDocument()
    expect(within(nove).getByRole('button', { name: /Pudim de Leite/ })).toBeDisabled()
    await userEvent.click(within(nove).getByRole('button', { name: 'Ok' }))
    expect(screen.queryByRole('article', { name: 'Mesa 9' })).not.toBeInTheDocument()
  })

  it('409 avisa e recarrega', async () => {
    render(<TelaProducao />)
    const sete = await cartao(7)
    const antes = api.chamadas('GET', /\/api\/equipe\/producao/).length
    api.uma('PATCH', /\/producao\/itens\//, () => ({ status: 409, corpo: { mensagem: 'Este pedido mudou' } }))
    await userEvent.click(within(sete).getByRole('button', { name: /Mix da Casa: Na fila/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Este pedido mudou')
    expect(api.chamadas('GET', /\/api\/equipe\/producao/).length).toBeGreaterThan(antes)
  })

  it('producao-mudou recarrega', async () => {
    render(<TelaProducao />)
    await cartao(7)
    api.estado.producao.Cozinha = [...api.estado.producao.Cozinha, pedido(3, [{ nome: 'Picanha na Chapa' }])]
    act(() => ultimoSocket().servidor('producao-mudou'))
    expect(await cartao(3)).toBeInTheDocument()
  })

  it('pedido novo toca o bipe depois de Ativar som', async () => {
    render(<TelaProducao />)
    await cartao(7)
    api.estado.producao.Cozinha = [...api.estado.producao.Cozinha, pedido(3, [{ nome: 'Picanha na Chapa' }])]
    act(() => ultimoSocket().servidor('producao-mudou'))
    await cartao(3)
    expect(tocarBipe).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Ativar som' }))
    expect(liberarSom).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Ativar som' })).not.toBeInTheDocument()
    api.estado.producao.Cozinha = [...api.estado.producao.Cozinha, pedido(4, [{ nome: 'Petit Gâteau' }])]
    act(() => ultimoSocket().servidor('producao-mudou'))
    await cartao(4)
    expect(tocarBipe).toHaveBeenCalledTimes(1)
  })

  it('tempo passa de 10 min → cartão em alerta', async () => {
    api.estado.producao.Cozinha = [
      pedido(5, [{ nome: 'Pudim de Leite' }], { confirmadaEm: minutosAtras(11) }),
      pedido(6, [{ nome: 'Pudim de Leite' }], { confirmadaEm: minutosAtras(21) }),
    ]
    render(<TelaProducao />)
    expect(await cartao(5)).toHaveClass('cartao-producao--alerta')
    expect(await cartao(6)).toHaveClass('cartao-producao--perigo')
    expect(await cartao(5)).toHaveTextContent('11 min')
  })

  it('pedido todo pronto vai para a faixa Prontos com Desfazer', async () => {
    api.estado.producao.Cozinha = [pedido(5, [{ nome: 'Pudim de Leite', status: 'PRONTO' }])]
    render(<TelaProducao />)
    const prontos = await screen.findByRole('region', { name: 'Prontos' })
    const cinco = within(prontos).getByRole('article', { name: 'Mesa 5' })
    await userEvent.click(within(cinco).getByRole('button', { name: 'Desfazer' }))
    expect(JSON.parse(String(api.chamadas('PATCH', /\/rodadas\/r-5$/)[0][1]?.body))).toEqual({
      estacao: 'Cozinha',
      status: 'EM_PREPARO',
    })
  })
})

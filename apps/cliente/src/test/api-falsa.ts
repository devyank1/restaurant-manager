// API em memória para os testes: responde como os endpoints da mesa.
import { vi } from 'vitest'
import type { CarrinhoPublico, RodadaPublica } from '../api/tipos'
import type { ItemCarrinho } from '../carrinho/carrinho'
import { precoUnitario, type Selecao } from '../preco/preco'
import { cardapioDemo } from './fixtures'

type Resposta = { status: number; corpo?: unknown }
type Rota = (corpo: unknown) => Resposta | undefined

const pratos = cardapioDemo.categorias.flatMap((c) => c.pratos)

export function criarApiFalsa() {
  const estado = {
    equipe: false,
    itens: [] as ItemCarrinho[],
    rodadas: [] as RodadaPublica[],
    totalParcialCentavos: 0,
  }
  const desvios: { metodo: string; padrao: RegExp; rota: Rota }[] = []
  let proximoId = 1

  const carrinho = (): CarrinhoPublico => ({
    itens: estado.itens,
    totalCentavos: estado.itens.reduce((s, i) => s + i.precoUnitarioCentavos * i.quantidade, 0),
  })

  const padrao = (metodo: string, caminho: string, corpo: unknown): Resposta => {
    if (caminho === '/api/equipe/eu') return estado.equipe ? { status: 200, corpo: {} } : { status: 401 }
    const mesa = /^\/api\/publico\/mesas\/[^/]+\/(.*)$/.exec(caminho)?.[1] ?? ''
    if (mesa === 'entrar') return { status: 200, corpo: { dispositivoConfirmado: false } }
    if (mesa === 'cardapio') return { status: 200, corpo: cardapioDemo }
    if (mesa === 'carrinho') return { status: 200, corpo: carrinho() }
    if (mesa === 'carrinho/itens' && metodo === 'POST') {
      const novo = corpo as { pratoId: string; selecao: Selecao; observacao: string; quantidade: number }
      const prato = pratos.find((p) => p.id === novo.pratoId)!
      estado.itens = [
        ...estado.itens,
        {
          id: `item-${proximoId++}`,
          nome: prato.nome,
          resumoOpcoes: '',
          precoUnitarioCentavos: precoUnitario(prato, novo.selecao),
          ...novo,
        },
      ]
      return { status: 201, corpo: carrinho() }
    }
    const item = /^carrinho\/itens\/(.+)$/.exec(mesa)?.[1]
    if (item && metodo === 'PATCH') {
      const { quantidade } = corpo as { quantidade: number }
      estado.itens = estado.itens
        .map((i) => (i.id === item ? { ...i, quantidade } : i))
        .filter((i) => i.quantidade > 0)
      return { status: 200, corpo: carrinho() }
    }
    if (item && metodo === 'DELETE') {
      estado.itens = estado.itens.filter((i) => i.id !== item)
      return { status: 200, corpo: carrinho() }
    }
    if (mesa === 'rodadas' && metodo === 'POST') {
      if (estado.itens.length === 0) return { status: 422, corpo: { mensagem: 'Carrinho vazio' } }
      const rodada: RodadaPublica = {
        id: `rodada-${proximoId++}`,
        status: 'AGUARDANDO_GARCOM',
        criadoEm: new Date().toISOString(),
        totalCentavos: carrinho().totalCentavos,
        itens: estado.itens.map(({ nome, resumoOpcoes, observacao, quantidade, precoUnitarioCentavos }) => ({
          nome,
          resumoOpcoes,
          observacao,
          quantidade,
          precoUnitarioCentavos,
        })),
      }
      estado.itens = []
      estado.rodadas = [...estado.rodadas, rodada]
      return { status: 201, corpo: rodada }
    }
    if (mesa === 'rodadas') {
      return { status: 200, corpo: { rodadas: estado.rodadas, totalParcialCentavos: estado.totalParcialCentavos } }
    }
    if (mesa === 'chamados') return { status: 201, corpo: { ok: true } }
    return { status: 404, corpo: { mensagem: `rota falsa ausente: ${metodo} ${caminho}` } }
  }

  const fetch = vi.fn<typeof globalThis.fetch>(async (entrada, init) => {
    const caminho = String(entrada)
    const metodo = init?.method ?? 'GET'
    const corpo: unknown = init?.body ? JSON.parse(String(init.body)) : undefined
    const desvio = desvios.find((d) => d.metodo === metodo && d.padrao.test(caminho))
    const resposta = desvio?.rota(corpo) ?? padrao(metodo, caminho, corpo)
    if (desvio && resposta) desvios.splice(desvios.indexOf(desvio), 1)
    return new Response(resposta.corpo === undefined ? null : JSON.stringify(resposta.corpo), {
      status: resposta.status,
    })
  })

  return {
    estado,
    fetch,
    /** Próxima chamada que casar responde com `rota` (uma vez). */
    uma(metodo: string, padrao: RegExp, rota: Rota) {
      desvios.push({ metodo, padrao, rota })
    },
    /** Chamadas feitas para um método + caminho. */
    chamadas(metodo: string, padrao: RegExp) {
      return fetch.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === metodo && padrao.test(String(url)))
    },
  }
}

export type ApiFalsa = ReturnType<typeof criarApiFalsa>

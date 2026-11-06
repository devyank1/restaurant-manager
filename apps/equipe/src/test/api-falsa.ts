// API da equipe em memória para os testes. `uma(...)` desvia a próxima chamada.
import { vi } from 'vitest'
import { precoUnitario, resumirOpcoes } from '@cardapio/opcoes'
import type { CardapioPublico } from '../api/cardapio'
import type { ChamadoEquipe, ItemRodadaEquipe, MesaEquipe, MesaResumo, UsuarioEquipe } from '../api/tipos'

type Resposta = { status: number; corpo?: unknown }
type Rota = (corpo: unknown, caminho: string) => Resposta | undefined

export const ana: UsuarioEquipe = { id: 'u-ana', nome: 'Ana', papel: 'GARCOM', emTurno: false }

export function criarApiFalsa() {
  const estado = {
    /** Pessoa logada (cookie válido); null = sem sessão. */
    usuario: null as UsuarioEquipe | null,
    senhas: { 'ana@demo.com': 'demo1234' } as Record<string, string>,
    chamados: [] as ChamadoEquipe[],
    mesas: [] as MesaResumo[],
    /** Detalhe por token; ausente = 404. */
    mesa: {} as Record<string, MesaEquipe>,
    cardapio: null as unknown,
    chavePush: null as string | null,
  }
  const desvios: { metodo: string; padrao: RegExp; rota: Rota }[] = []

  const padrao = (metodo: string, caminho: string, corpo: unknown): Resposta => {
    if (caminho === '/api/equipe/login' && metodo === 'POST') {
      const { email, senha } = corpo as { email: string; senha: string }
      if (estado.senhas[email] !== senha) return { status: 401, corpo: { mensagem: 'E-mail ou senha inválidos' } }
      estado.usuario = { ...ana }
      return { status: 200, corpo: estado.usuario }
    }
    if (caminho === '/api/equipe/logout') {
      estado.usuario = null
      return { status: 204 }
    }
    const publico = /^\/api\/publico\/mesas\/[^/]+\/cardapio$/.test(caminho)
    if (publico) return estado.cardapio ? { status: 200, corpo: estado.cardapio } : { status: 404 }
    if (!estado.usuario) return { status: 401, corpo: { mensagem: 'Faça login' } }

    if (caminho === '/api/equipe/eu') return { status: 200, corpo: estado.usuario }
    if (caminho === '/api/equipe/turno' && metodo === 'PATCH') {
      estado.usuario = { ...estado.usuario, emTurno: (corpo as { emTurno: boolean }).emTurno }
      return { status: 200, corpo: estado.usuario }
    }
    if (caminho === '/api/equipe/chamados') return { status: 200, corpo: estado.chamados }
    const chamado = /^\/api\/equipe\/chamados\/([^/]+)\/(lido|resolver)$/.exec(caminho)
    if (chamado) {
      const [, id, acao] = chamado
      const atual = estado.chamados.find((c) => c.id === id)
      if (!atual) return { status: 404, corpo: { mensagem: 'Chamado não encontrado' } }
      if (acao === 'resolver') {
        estado.chamados = estado.chamados.filter((c) => c.id !== id)
        return { status: 200, corpo: { ...atual, status: 'RESOLVIDO' } }
      }
      atual.status = 'LIDO'
      return { status: 200, corpo: atual }
    }
    if (caminho === '/api/equipe/mesas') return { status: 200, corpo: estado.mesas }
    const mesa = /^\/api\/equipe\/mesas\/([^/]+)$/.exec(caminho)?.[1]
    if (mesa) {
      const detalhe = estado.mesa[decodeURIComponent(mesa)]
      return detalhe ? { status: 200, corpo: detalhe } : { status: 404, corpo: { mensagem: 'Mesa não encontrada' } }
    }
    const itemRodada = /^\/api\/equipe\/rodadas\/([^/]+)\/itens(?:\/([^/]+))?$/.exec(caminho)
    if (itemRodada) {
      const [, rodadaId, itemId] = itemRodada
      const r = Object.values(estado.mesa)
        .flatMap((m) => m.rodadas)
        .find((x) => x.id === rodadaId)
      if (!r) return { status: 404, corpo: { mensagem: 'Rodada não encontrada' } }
      if (r.status !== 'AGUARDANDO_GARCOM') {
        return { status: 409, corpo: { mensagem: 'Esta rodada já foi confirmada ou recusada' } }
      }
      const pratos = ((estado.cardapio as CardapioPublico | null)?.categorias ?? []).flatMap((c) => c.pratos)
      const montar = (base: ItemRodadaEquipe, mudanca: Partial<ItemRodadaEquipe>): ItemRodadaEquipe => {
        const novo = { ...base, ...mudanca }
        const prato = pratos.find((p) => p.id === novo.pratoId)
        if (!prato) return novo
        return {
          ...novo,
          nome: prato.nome,
          resumoOpcoes: resumirOpcoes(prato, novo.selecao),
          precoUnitarioCentavos: precoUnitario(prato, novo.selecao),
        }
      }
      if (metodo === 'POST') {
        const novo = corpo as Omit<ItemRodadaEquipe, 'id' | 'nome' | 'resumoOpcoes' | 'precoUnitarioCentavos'>
        const vazio = { id: `i-${r.itens.length + 100}`, nome: '', resumoOpcoes: '', precoUnitarioCentavos: 0 }
        r.itens = [...r.itens, montar({ ...vazio, ...novo }, {})]
      } else {
        const edicao = corpo as Partial<ItemRodadaEquipe>
        r.itens = r.itens
          .map((i) => (i.id === itemId ? montar(i, edicao) : i))
          .filter((i) => i.quantidade > 0)
      }
      r.totalCentavos = r.itens.reduce((s, i) => s + i.precoUnitarioCentavos * i.quantidade, 0)
      return { status: metodo === 'POST' ? 201 : 200, corpo: r }
    }
    const rodada = /^\/api\/equipe\/rodadas\/([^/]+)\/(confirmar|recusar)$/.exec(caminho)
    if (rodada) {
      const [, id, acao] = rodada
      for (const m of Object.values(estado.mesa)) {
        const r = m.rodadas.find((x) => x.id === id)
        if (!r) continue
        if (r.status !== 'AGUARDANDO_GARCOM') {
          return { status: 409, corpo: { mensagem: 'Esta rodada já foi confirmada ou recusada' } }
        }
        r.status = acao === 'confirmar' ? 'CONFIRMADA' : 'CANCELADA'
        if (r.status === 'CONFIRMADA') m.totalConfirmadoCentavos += r.totalCentavos
        return { status: 200, corpo: r }
      }
      return { status: 404, corpo: { mensagem: 'Rodada não encontrada' } }
    }
    if (caminho === '/api/equipe/push/chave') return { status: 200, corpo: { chavePublica: estado.chavePush } }
    if (caminho === '/api/equipe/push/inscricoes') return { status: 201 }
    return { status: 404, corpo: { mensagem: `rota falsa ausente: ${metodo} ${caminho}` } }
  }

  const fetch = vi.fn<typeof globalThis.fetch>(async (entrada, init) => {
    const caminho = String(entrada)
    const metodo = init?.method ?? 'GET'
    const corpo: unknown = init?.body ? JSON.parse(String(init.body)) : undefined
    const desvio = desvios.find((d) => d.metodo === metodo && d.padrao.test(caminho))
    const resposta = desvio?.rota(corpo, caminho) ?? padrao(metodo, caminho, corpo)
    if (desvio) desvios.splice(desvios.indexOf(desvio), 1)
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

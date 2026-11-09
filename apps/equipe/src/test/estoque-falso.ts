// Parte de estoque da API falsa (etapa 4A).
import type {
  Desfazivel,
  Fornecedor,
  GrupoCompra,
  ItemEstoque,
  ListaCompra,
  MovimentoEstoque,
  PratoReceita,
  ResumoEstoque,
} from '../api/tipos'

type Resposta = { status: number; corpo?: unknown }
type Linha = { itemId: string; quantidade: number }

export type EstoqueFalso = {
  itens: ItemEstoque[]
  resumo: ResumoEstoque
  fornecedores: Fornecedor[]
  movimentos: Record<string, MovimentoEstoque[]>
  receitas: PratoReceita[]
  sugestao: GrupoCompra[]
  listas: Record<string, ListaCompra>
  desfazivel: Desfazivel | null
}

export function estoqueVazio(): EstoqueFalso {
  return {
    itens: [],
    resumo: { acabando: [], acabou: [], perdasHoje: [], listaAberta: null },
    fornecedores: [],
    movimentos: {},
    receitas: [],
    sugestao: [],
    listas: {},
    desfazivel: null,
  }
}

const naoAchou = (o: string): Resposta => ({ status: 404, corpo: { mensagem: `${o} não encontrado` } })

export function rotaEstoque(e: EstoqueFalso, metodo: string, caminho: string, corpo: unknown): Resposta {
  const url = new URL(caminho, 'http://x')
  const p = url.pathname.replace(/^\/api\/equipe/, '')
  let m: RegExpExecArray | null

  if ((m = /^\/pratos\/([^/]+)$/.exec(p)) && metodo === 'PATCH') {
    const esgotado = (corpo as { esgotado: boolean }).esgotado
    for (const a of e.resumo.acabou) for (const pr of a.pratos) if (pr.id === m[1]) pr.esgotado = esgotado
    for (const r of e.receitas) if (r.id === m[1]) r.esgotado = esgotado
    return { status: 200, corpo: { id: m[1], esgotado } }
  }
  if (p === '/estoque') return { status: 200, corpo: e.resumo }

  if (p === '/estoque/itens') {
    if (metodo === 'GET') return { status: 200, corpo: e.itens }
    const d = corpo as ItemEstoque & { fornecedorId?: string; quantidade?: number }
    const novo: ItemEstoque = {
      id: `item-${e.itens.length + 1}`,
      nome: d.nome,
      unidade: d.unidade,
      quantidade: d.quantidade ?? 0,
      minimo: d.minimo,
      cheio: d.cheio,
      nivel: 'OK',
      fornecedor: e.fornecedores.find((f) => f.id === d.fornecedorId) ?? null,
      embalagem: null,
    }
    e.itens.push(novo)
    return { status: 201, corpo: novo }
  }
  if ((m = /^\/estoque\/itens\/([^/]+)$/.exec(p))) {
    const item = e.itens.find((i) => i.id === m![1])
    if (!item) return naoAchou('Item')
    if (metodo === 'DELETE') {
      e.itens = e.itens.filter((i) => i !== item)
      return { status: 204 }
    }
    Object.assign(item, corpo)
    return { status: 200, corpo: item }
  }
  if ((m = /^\/estoque\/itens\/([^/]+)\/(movimentos|contagem)$/.exec(p))) {
    const item = e.itens.find((i) => i.id === m![1])
    if (!item) return naoAchou('Item')
    if (m[2] === 'movimentos') return { status: 200, corpo: e.movimentos[item.id] ?? [] }
    item.quantidade = (corpo as { quantidade: number }).quantidade
    return { status: 200, corpo: item }
  }
  if (p === '/estoque/entradas') {
    for (const l of (corpo as { itens: Linha[] }).itens) {
      const item = e.itens.find((i) => i.id === l.itemId)
      if (item) item.quantidade += l.quantidade
    }
    return { status: 200, corpo: e.itens }
  }
  if (p === '/estoque/perdas') {
    const perda = corpo as Linha
    const item = e.itens.find((i) => i.id === perda.itemId)
    if (!item) return naoAchou('Item')
    item.quantidade -= perda.quantidade
    e.desfazivel = { lote: 'lote-1', descricao: `Perda de ${item.nome}`, ate: new Date(Date.now() + 600_000).toISOString() }
    return { status: 200, corpo: item }
  }
  if (p === '/estoque/desfazer') {
    if (metodo === 'GET') return { status: 200, corpo: { desfazivel: e.desfazivel } }
    if (!e.desfazivel) return { status: 409, corpo: { mensagem: 'Nada para desfazer' } }
    e.desfazivel = null
    return { status: 200, corpo: {} }
  }

  if (p === '/estoque/fornecedores') {
    if (metodo === 'GET') return { status: 200, corpo: e.fornecedores }
    const f: Fornecedor = { telefone: null, observacao: null, ...(corpo as Partial<Fornecedor>), id: `f-${e.fornecedores.length + 1}`, nome: (corpo as Fornecedor).nome }
    e.fornecedores.push(f)
    return { status: 201, corpo: f }
  }
  if ((m = /^\/estoque\/fornecedores\/([^/]+)$/.exec(p))) {
    const f = e.fornecedores.find((x) => x.id === m![1])
    if (!f) return naoAchou('Fornecedor')
    if (metodo === 'DELETE') {
      e.fornecedores = e.fornecedores.filter((x) => x !== f)
      return { status: 204 }
    }
    Object.assign(f, corpo)
    return { status: 200, corpo: f }
  }

  if (p === '/estoque/receitas') return { status: 200, corpo: e.receitas }
  if (/^\/estoque\/receitas\/(pratos|opcoes)\/[^/]+$/.test(p)) return { status: 200, corpo: {} }

  if (p === '/estoque/compras/sugestao') return { status: 200, corpo: e.sugestao }
  if (p === '/estoque/compras' && metodo === 'POST') {
    const pedidas = (corpo as { itens: Linha[] }).itens
    const grupos = e.sugestao
      .map((g) => ({
        ...g,
        itens: g.itens
          .filter((l) => pedidas.some((x) => x.itemId === l.itemId))
          .map((l) => ({ ...l, quantidade: pedidas.find((x) => x.itemId === l.itemId)!.quantidade })),
      }))
      .filter((g) => g.itens.length > 0)
    const lista: ListaCompra = { id: 'lista-1', restaurante: 'Cantina Demo', criadaEm: new Date().toISOString(), chegouEm: null, grupos }
    e.listas[lista.id] = lista
    return { status: 201, corpo: lista }
  }
  if ((m = /^\/estoque\/compras\/([^/]+)(\/chegou)?$/.exec(p))) {
    const lista = e.listas[m[1]]
    if (!lista) return naoAchou('Lista')
    if (!m[2]) return { status: 200, corpo: lista }
    if (lista.chegouEm) return { status: 409, corpo: { mensagem: 'Esta compra já foi lançada' } }
    lista.chegouEm = new Date().toISOString()
    return { status: 200, corpo: {} }
  }
  return { status: 404, corpo: { mensagem: `rota falsa ausente: ${metodo} ${caminho}` } }
}

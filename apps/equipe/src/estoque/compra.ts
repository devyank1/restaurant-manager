// Linhas editáveis da lista de compras e da chegada.
import type { Embalagem, LinhaCompra, Unidade } from '../api/tipos'
import { campoDe, lerCampo, type ValorCampo } from './campo'

export type FornecedorLinha = { id: string; nome: string; telefone: string | null } | null

export type LinhaEditavel = {
  itemId: string
  nome: string
  unidade: Unidade
  embalagem: Embalagem | null
  fornecedor: FornecedorLinha
  /** Item com embalagem: quantas embalagens (texto). Sem: quantidade + unidade. */
  embalagens: string
  valor: ValorCampo
}

/** Plural simples para nomes de embalagem ("Cartela" → "Cartelas", "Barril" → "Barris"). */
export function plural(nome: string): string {
  if (/s$/i.test(nome)) return nome
  if (/il$/i.test(nome)) return `${nome.slice(0, -1)}s`
  if (/l$/i.test(nome)) return `${nome.slice(0, -1)}is`
  if (/[rz]$/i.test(nome)) return `${nome}es`
  if (/m$/i.test(nome)) return `${nome.slice(0, -1)}ns`
  return `${nome}s`
}

export function linhaEditavel(l: LinhaCompra, fornecedor: FornecedorLinha): LinhaEditavel {
  return {
    itemId: l.itemId,
    nome: l.nome,
    unidade: l.unidade,
    embalagem: l.embalagem,
    fornecedor,
    embalagens: l.embalagem ? String(Math.ceil(l.quantidade / l.embalagem.quantidade)) : '',
    valor: campoDe(l.quantidade, l.unidade),
  }
}

/** Quantidade na unidade base; inválida → null. */
export function lerLinha(l: LinhaEditavel, aceitaZero: boolean): number | null {
  if (l.embalagem) {
    const n = l.embalagens.trim()
    if (!/^\d+$/.test(n)) return null
    const total = Number(n) * l.embalagem.quantidade
    return total > 0 || aceitaZero ? total : null
  }
  return lerCampo(l.valor, l.unidade, aceitaZero)
}

/** Agrupa as linhas por fornecedor (A→Z, "Sem fornecedor" por último). */
export function porFornecedor(linhas: LinhaEditavel[]): { fornecedor: FornecedorLinha; linhas: LinhaEditavel[] }[] {
  const grupos = new Map<string, { fornecedor: FornecedorLinha; linhas: LinhaEditavel[] }>()
  for (const l of linhas) {
    const chave = l.fornecedor?.id ?? ''
    if (!grupos.has(chave)) grupos.set(chave, { fornecedor: l.fornecedor, linhas: [] })
    grupos.get(chave)!.linhas.push(l)
  }
  return [...grupos.values()].sort((a, b) => {
    if (!a.fornecedor) return 1
    if (!b.fornecedor) return -1
    return a.fornecedor.nome.localeCompare(b.fornecedor.nome, 'pt-BR')
  })
}

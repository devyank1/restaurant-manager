import type { Selecao } from '../preco/preco'

export type ItemCarrinho = {
  id: string
  pratoId: string
  nome: string
  resumoOpcoes: string
  selecao: Selecao
  observacao: string
  quantidade: number
  precoUnitarioCentavos: number
}

export type AcaoCarrinho =
  | { tipo: 'adicionar'; item: Omit<ItemCarrinho, 'id'> }
  | { tipo: 'remover'; id: string }
  | { tipo: 'quantidade'; id: string; quantidade: number }

export function reduzirCarrinho(itens: ItemCarrinho[], acao: AcaoCarrinho): ItemCarrinho[] {
  switch (acao.tipo) {
    case 'adicionar':
      return [...itens, { ...acao.item, id: crypto.randomUUID() }]
    case 'remover':
      return itens.filter((item) => item.id !== acao.id)
    case 'quantidade':
      if (acao.quantidade <= 0) return itens.filter((item) => item.id !== acao.id)
      return itens.map((item) =>
        item.id === acao.id ? { ...item, quantidade: acao.quantidade } : item,
      )
  }
}

export function totalCarrinho(itens: ItemCarrinho[]): number {
  return itens.reduce((total, item) => total + item.precoUnitarioCentavos * item.quantidade, 0)
}

export function contarItens(itens: ItemCarrinho[]): number {
  return itens.reduce((total, item) => total + item.quantidade, 0)
}

const chave = (token: string) => `carrinho:${token}`

// Acessar `localStorage` pode lançar (aba anônima, cookies bloqueados),
// então a resolução do storage padrão também fica dentro do try.
export function carregarCarrinho(token: string, storage?: Storage): ItemCarrinho[] {
  try {
    const bruto = (storage ?? localStorage).getItem(chave(token))
    if (!bruto) return []
    const itens: unknown = JSON.parse(bruto)
    return Array.isArray(itens) ? (itens as ItemCarrinho[]) : []
  } catch {
    return []
  }
}

export function salvarCarrinho(token: string, itens: ItemCarrinho[], storage?: Storage): void {
  try {
    ;(storage ?? localStorage).setItem(chave(token), JSON.stringify(itens))
  } catch {
    // Sem storage o carrinho segue só em memória.
  }
}

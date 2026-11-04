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

// `crypto.randomUUID` só existe em contexto seguro (HTTPS ou localhost);
// no celular pela rede local (http://<ip>) ele não existe.
function novoId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function itemValido(item: unknown): item is ItemCarrinho {
  if (typeof item !== 'object' || item === null) return false
  const i = item as Record<string, unknown>
  return (
    typeof i.id === 'string' &&
    typeof i.pratoId === 'string' &&
    typeof i.nome === 'string' &&
    typeof i.resumoOpcoes === 'string' &&
    typeof i.observacao === 'string' &&
    typeof i.selecao === 'object' &&
    i.selecao !== null &&
    Number.isInteger(i.quantidade) &&
    (i.quantidade as number) > 0 &&
    Number.isInteger(i.precoUnitarioCentavos) &&
    (i.precoUnitarioCentavos as number) >= 0
  )
}

export function reduzirCarrinho(itens: ItemCarrinho[], acao: AcaoCarrinho): ItemCarrinho[] {
  switch (acao.tipo) {
    case 'adicionar':
      return [...itens, { ...acao.item, id: novoId() }]
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
    return Array.isArray(itens) ? itens.filter(itemValido) : []
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

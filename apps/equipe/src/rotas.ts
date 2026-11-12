import { useSyncExternalStore } from 'react'

export type Rota =
  | { nome: 'login'; volta?: string }
  | { nome: 'inicio' }
  | { nome: 'mesas' }
  | { nome: 'producao' }
  | { nome: 'mesa'; token: string }
  | { nome: 'estoque' }
  | { nome: 'tempos' }
  | { nome: 'hoje'; estacao: string }
  | { nome: 'metas' }
  | { nome: 'meta-pessoa'; id: string }
  | { nome: 'estoque-itens' }
  | { nome: 'estoque-item'; id: string }
  | { nome: 'estoque-fornecedores' }
  | { nome: 'estoque-receitas' }
  | { nome: 'estoque-receita'; pratoId: string }
  | { nome: 'estoque-compras' }
  | { nome: 'estoque-pedido'; fornecedorId: string }
  | { nome: 'estoque-chegou'; listaId: string }

/** Só caminho interno (evita mandar para outro site depois do login). */
function voltaSegura(volta: string | null): string | undefined {
  return volta && volta.startsWith('/') && !volta.startsWith('//') ? volta : undefined
}

export function lerRota(caminho: string, busca: string): Rota {
  if (caminho === '/login') {
    const volta = voltaSegura(new URLSearchParams(busca).get('volta'))
    return volta ? { nome: 'login', volta } : { nome: 'login' }
  }
  if (caminho === '/mesas') return { nome: 'mesas' }
  if (caminho === '/producao') return { nome: 'producao' }
  if (caminho === '/tempos') return { nome: 'tempos' }
  const hoje = /^\/hoje\/([^/]+)$/.exec(caminho)?.[1]
  if (hoje) return { nome: 'hoje', estacao: decodeURIComponent(hoje) }
  if (caminho === '/metas') return { nome: 'metas' }
  const pessoa = /^\/metas\/garcom\/([^/]+)$/.exec(caminho)?.[1]
  if (pessoa) return { nome: 'meta-pessoa', id: decodeURIComponent(pessoa) }
  const estoque = lerEstoque(caminho)
  if (estoque) return estoque
  const mesa = /^\/mesa\/([^/]+)$/.exec(caminho)?.[1]
  if (mesa) return { nome: 'mesa', token: decodeURIComponent(mesa) }
  return { nome: 'inicio' }
}

/** Telas do estoque (só o gerente). */
function lerEstoque(caminho: string): Rota | null {
  const id = (padrao: RegExp) => {
    const achado = padrao.exec(caminho)?.[1]
    return achado ? decodeURIComponent(achado) : null
  }
  if (caminho === '/estoque') return { nome: 'estoque' }
  if (caminho === '/estoque/itens') return { nome: 'estoque-itens' }
  if (caminho === '/estoque/fornecedores') return { nome: 'estoque-fornecedores' }
  if (caminho === '/estoque/receitas') return { nome: 'estoque-receitas' }
  if (caminho === '/estoque/compras') return { nome: 'estoque-compras' }
  const item = id(/^\/estoque\/itens\/([^/]+)$/)
  if (item) return { nome: 'estoque-item', id: item }
  const prato = id(/^\/estoque\/receitas\/([^/]+)$/)
  if (prato) return { nome: 'estoque-receita', pratoId: prato }
  const fornecedor = id(/^\/estoque\/compras\/f\/([^/]+)$/)
  if (fornecedor) return { nome: 'estoque-pedido', fornecedorId: fornecedor }
  const lista = id(/^\/estoque\/compras\/([^/]+)\/chegou$/)
  if (lista) return { nome: 'estoque-chegou', listaId: lista }
  return null
}

/** Tela de cima, para o botão Voltar do topo (null no início). */
export function voltaDe(rota: Rota): string | null {
  switch (rota.nome) {
    case 'inicio':
    case 'login':
      return null
    case 'estoque-item':
      return '/estoque/itens'
    case 'estoque-receita':
      return '/estoque/receitas'
    case 'estoque-pedido':
      return '/estoque/compras'
    case 'meta-pessoa':
      return '/metas'
    case 'estoque-itens':
    case 'estoque-receitas':
    case 'estoque-fornecedores':
    case 'estoque-compras':
    case 'estoque-chegou':
      return '/estoque'
    default:
      return '/'
  }
}

const MUDOU = 'popstate'

export function navegar(caminho: string): void {
  if (caminho === window.location.pathname + window.location.search) return
  window.history.pushState({}, '', caminho)
  window.dispatchEvent(new PopStateEvent(MUDOU))
}

/** Caminho atual com a busca, para voltar a ele depois do login. */
export function caminhoAtual(): string {
  return window.location.pathname + window.location.search
}

function assinar(aoMudar: () => void) {
  window.addEventListener(MUDOU, aoMudar)
  return () => window.removeEventListener(MUDOU, aoMudar)
}

export function useRota(): Rota {
  const atual = useSyncExternalStore(assinar, caminhoAtual)
  const i = atual.indexOf('?')
  return i < 0 ? lerRota(atual, '') : lerRota(atual.slice(0, i), atual.slice(i))
}

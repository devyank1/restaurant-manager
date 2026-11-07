import { useSyncExternalStore } from 'react'

export type Rota =
  | { nome: 'login'; volta?: string }
  | { nome: 'inicio' }
  | { nome: 'mesas' }
  | { nome: 'mesa'; token: string }

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
  const mesa = /^\/mesa\/([^/]+)$/.exec(caminho)?.[1]
  if (mesa) return { nome: 'mesa', token: decodeURIComponent(mesa) }
  return { nome: 'inicio' }
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

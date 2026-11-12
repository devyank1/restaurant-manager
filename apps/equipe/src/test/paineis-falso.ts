// Parte de painéis, metas e tempos da API falsa (etapa 4B).
import type { TemposCardapio } from '../api/tipos'

type Resposta = { status: number; corpo?: unknown }

export type PaineisFalso = {
  tempos: TemposCardapio
}

export function paineisVazio(): PaineisFalso {
  return { tempos: { categorias: [] } }
}

export function rotaPaineis(e: PaineisFalso, metodo: string, caminho: string, corpo: unknown): Resposta | undefined {
  const p = caminho.replace(/^\/api\/equipe/, '')
  let m: RegExpExecArray | null
  if (p === '/tempos' && metodo === 'GET') return { status: 200, corpo: e.tempos }
  if ((m = /^\/tempos\/(categorias|pratos)\/([^/]+)$/.exec(p)) && metodo === 'PATCH') {
    const { tempoPreparoMin } = corpo as { tempoPreparoMin: number | null }
    for (const c of e.tempos.categorias) {
      if (m[1] === 'categorias' && c.id === m[2]) c.tempoPreparoMin = tempoPreparoMin
      for (const prato of c.pratos) if (m[1] === 'pratos' && prato.id === m[2]) prato.tempoPreparoMin = tempoPreparoMin
    }
    return { status: 200, corpo: { id: m[2], tempoPreparoMin } }
  }
  return undefined
}

// Parte de painéis, metas e tempos da API falsa (etapa 4B).
import type { MetaPessoa, MetasConfig, TemposCardapio } from '../api/tipos'

type Resposta = { status: number; corpo?: unknown }

export type PaineisFalso = {
  tempos: TemposCardapio
  metas: MetasConfig
  pessoas: Record<string, MetaPessoa>
}

export function paineisVazio(): PaineisFalso {
  return {
    tempos: { categorias: [] },
    metas: {
      equipe: { VALOR: null, MESAS: null },
      garcomPadrao: { VALOR: null, MESAS: null },
      estacoes: [],
      garcons: [],
      horasSemPausa: 4,
    },
    pessoas: {},
  }
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
  if (p === '/metas' && metodo === 'GET') return { status: 200, corpo: e.metas }
  if ((m = /^\/metas\/garcom\/pessoa\/([^/]+)$/.exec(p)) && metodo === 'GET') {
    const pessoa = e.pessoas[decodeURIComponent(m[1])]
    return pessoa ? { status: 200, corpo: pessoa } : { status: 404, corpo: { mensagem: 'Garçom não encontrado' } }
  }
  if (p.startsWith('/metas/') && metodo === 'PUT') return { status: 200, corpo: {} }
  if (p.startsWith('/metas/') && metodo === 'DELETE') return { status: 204 }
  if (p === '/configuracoes/painel' && metodo === 'PATCH') {
    e.metas.horasSemPausa = (corpo as { horasSemPausa: number }).horasSemPausa
    return { status: 200, corpo }
  }
  return undefined
}

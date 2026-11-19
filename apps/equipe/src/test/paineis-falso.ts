// Parte de painéis, metas e tempos da API falsa (etapa 4B).
import type {
  CentralResposta,
  LimitesAlerta,
  MedidaEstacao,
  MetaPessoa,
  MetasConfig,
  PainelEquipe,
  PainelEstacao,
  PainelGarcom,
  TemposCardapio,
} from '../api/tipos'

type Resposta = { status: number; corpo?: unknown }

export type PaineisFalso = {
  tempos: TemposCardapio
  metas: MetasConfig
  pessoas: Record<string, MetaPessoa>
  equipe: PainelEquipe
  eu: PainelGarcom | null
  estacoes: Record<string, PainelEstacao>
  central: CentralResposta
  limites: LimitesAlerta
}

export const medidaVazia = (estacao: string): MedidaEstacao => ({
  estacao,
  pedidos: 0,
  avaliados: 0,
  noTempo: 0,
  noTempoPct: null,
  mediaMin: null,
  esquecidos: [],
})

/** Painel do garçom com valores neutros (sobrescreve o que o teste pedir). */
export function meuPainel(
  p: { metaEquipe?: PainelGarcom['metaEquipe']; eu?: Partial<PainelGarcom['eu']> } = {},
): PainelGarcom {
  return {
    metaEquipe: p.metaEquipe ?? [],
    eu: {
      id: 'u-ana',
      nome: 'Ana',
      emTurno: true,
      emTurnoDesde: null,
      avisos: [],
      metas: [],
      mesasHoje: 0,
      ...p.eu,
    },
  }
}

export function painelVazio(): PainelEquipe {
  return {
    periodo: 'DIA',
    inicio: '2026-11-11T08:00:00.000Z',
    metaEquipe: [],
    pessoas: [],
    operacao: {
      faturamentoCentavos: 0,
      contas: 0,
      ticketMedioCentavos: null,
      porHora: [],
      porDiaSemana: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, mediaRodadas: 0 })),
      maisVendidos: [],
      estacoes: [],
      chamadosDemorados: { quantidade: 0, mediaRespostaSeg: null },
      perdasSemana: [],
    },
  }
}

export const centralVazia = (): CentralResposta => ({
  verificadoEm: '2026-11-11T12:00:00.000Z',
  alertas: [],
  cargaGarcons: [],
  cargaEstacoes: [],
  grupo: { garconsEmTurno: 0, cargaTotal: 0, cargaMedia: null },
  contexto: { faturamentoCentavos: 0, ticketMedioCentavos: null, porHora: [] },
})

export const limitesPadrao = (): LimitesAlerta => ({
  MESA_SEM_ATENDIMENTO: { ativo: true, valor: 10 },
  CHAMADO_SEM_RESPOSTA: { ativo: true, valor: 3 },
  PEDIDO_ATRASADO: { ativo: true, valor: null },
  PEDIDO_ESQUECIDO: { ativo: true, valor: null },
  FILA_ACUMULADA: { ativo: true, valor: 6 },
  GARCOM_CARGA_ALTA: { ativo: true, valor: null },
  GARCOM_SEM_PAUSA: { ativo: true, valor: null },
  ESTOQUE_CRITICO: { ativo: true, valor: null },
  MOVIMENTO_ALTO: { ativo: true, valor: 140 },
  SEM_GARCOM: { ativo: true, valor: null },
  CHAMADO_PARA_TODOS: { ativo: true, valor: null },
})

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
    equipe: painelVazio(),
    eu: meuPainel(),
    estacoes: {},
    central: centralVazia(),
    limites: limitesPadrao(),
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
  if ((m = /^\/painel(\?periodo=(DIA|SEMANA))?$/.exec(p)) && metodo === 'GET') {
    return { status: 200, corpo: { ...e.equipe, periodo: m[2] ?? 'DIA' } }
  }
  if (p === '/painel/central' && metodo === 'GET') return { status: 200, corpo: e.central }
  if (p === '/painel/central/limites' && metodo === 'GET') return { status: 200, corpo: e.limites }
  if ((m = /^\/painel\/central\/limites\/([A-Z_]+)$/.exec(p)) && metodo === 'PUT') {
    e.limites[m[1] as keyof LimitesAlerta] = corpo as LimitesAlerta[keyof LimitesAlerta]
    return { status: 200, corpo }
  }
  if ((m = /^\/painel\/central\/garcom\/([^/]+)$/.exec(p)) && metodo === 'GET') {
    const id = decodeURIComponent(m[1])
    const g = e.central.cargaGarcons.find((x) => x.id === id)
    if (!g) return { status: 404, corpo: { mensagem: 'Garçom não encontrado' } }
    return {
      status: 200,
      corpo: {
        id,
        nome: g.nome,
        emTurno: g.emTurnoDesde !== null,
        emTurnoDesde: g.emTurnoDesde,
        horasEmTurno: null,
        mesasAbertas: [],
        chamadosPendentes: [],
      },
    }
  }
  if (p === '/painel/eu' && metodo === 'GET') {
    return e.eu ? { status: 200, corpo: e.eu } : { status: 403, corpo: { mensagem: 'Acesso só para garçom' } }
  }
  if ((m = /^\/painel\/estacao\/([^/]+)$/.exec(p)) && metodo === 'GET') {
    const estacao = decodeURIComponent(m[1])
    return {
      status: 200,
      corpo: e.estacoes[estacao] ?? { estacao, metaEquipe: [], metas: [], medida: medidaVazia(estacao) },
    }
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

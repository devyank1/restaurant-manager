// Chamadas da equipe. O cookie httpOnly `equipe` vai junto (mesma origem, via proxy /api).
import type { CardapioPublico } from './cardapio'
import { caminhoAtual, navegar } from '../rotas'
import type {
  ChamadoEquipe,
  FilaProducao,
  MesaEquipe,
  MesaResumo,
  RodadaEquipe,
  StatusProducao,
  UsuarioEquipe,
} from './tipos'
import type { Selecao } from '@cardapio/opcoes'

/** Sem sessão (cookie ausente ou vencido): o app já foi para o login. */
export class ErroNaoAutenticado extends Error {}

/** Recusa do servidor com mensagem para mostrar (403/404/409/422). */
export class ErroEquipe extends Error {
  readonly status: number

  constructor(mensagem: string, status: number) {
    super(mensagem)
    this.status = status
  }
}

/** Sem rede ou erro inesperado do servidor. */
export class ErroRede extends Error {}

async function lerJson(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json()
  } catch {
    return null
  }
}

/** Leva ao login guardando onde estava (não sai do login para o login). */
function irParaLogin() {
  if (window.location.pathname === '/login') return
  navegar(`/login?volta=${encodeURIComponent(caminhoAtual())}`)
}

async function chamar<T>(url: string, init?: RequestInit, opcoes: { semRedirecionar?: boolean } = {}): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(url, init)
  } catch (erro) {
    throw new ErroRede(String(erro))
  }
  if (resposta.ok) return (await lerJson(resposta)) as T
  const corpo = ((await lerJson(resposta)) ?? {}) as { mensagem?: string }
  if (resposta.status === 401) {
    if (!opcoes.semRedirecionar) irParaLogin()
    throw new ErroNaoAutenticado(corpo.mensagem ?? 'Faça login')
  }
  if ([403, 404, 409, 422].includes(resposta.status) && corpo.mensagem) {
    throw new ErroEquipe(corpo.mensagem, resposta.status)
  }
  throw new ErroRede(`HTTP ${resposta.status}`)
}

const json = (method: string, corpo?: unknown): RequestInit => ({
  method,
  headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
  body: corpo === undefined ? undefined : JSON.stringify(corpo),
})

const enc = encodeURIComponent

// Sessão
export const login = (email: string, senha: string) =>
  chamar<UsuarioEquipe>('/api/equipe/login', json('POST', { email, senha }), { semRedirecionar: true })
export const logout = () => chamar<null>('/api/equipe/logout', json('POST'), { semRedirecionar: true })
/** Quem está logado; sem sessão lança ErroNaoAutenticado sem redirecionar. */
export const eu = () => chamar<UsuarioEquipe>('/api/equipe/eu', undefined, { semRedirecionar: true })
export const mudarTurno = (emTurno: boolean) => chamar<UsuarioEquipe>('/api/equipe/turno', json('PATCH', { emTurno }))

// Chamados
export const buscarChamados = () => chamar<ChamadoEquipe[]>('/api/equipe/chamados')
export const marcarLido = (id: string) => chamar<ChamadoEquipe>(`/api/equipe/chamados/${enc(id)}/lido`, json('POST'))
export const resolverChamado = (id: string) =>
  chamar<ChamadoEquipe>(`/api/equipe/chamados/${enc(id)}/resolver`, json('POST'))

// Mesas e rodadas
export const buscarMesas = () => chamar<MesaResumo[]>('/api/equipe/mesas')
export const buscarMesa = (token: string) => chamar<MesaEquipe>(`/api/equipe/mesas/${enc(token)}`)
export const buscarCardapio = (token: string) =>
  chamar<CardapioPublico>(`/api/publico/mesas/${enc(token)}/cardapio`)

export type EdicaoItem = { quantidade?: number; selecao?: Selecao; observacao?: string }
export type NovoItemRodada = { pratoId: string; selecao: Selecao; observacao: string; quantidade: number }

export const alterarItem = (rodadaId: string, itemId: string, edicao: EdicaoItem) =>
  chamar<RodadaEquipe>(`/api/equipe/rodadas/${enc(rodadaId)}/itens/${enc(itemId)}`, json('PATCH', edicao))
export const adicionarItem = (rodadaId: string, item: NovoItemRodada) =>
  chamar<RodadaEquipe>(`/api/equipe/rodadas/${enc(rodadaId)}/itens`, json('POST', item))
export const confirmarRodada = (rodadaId: string) =>
  chamar<RodadaEquipe>(`/api/equipe/rodadas/${enc(rodadaId)}/confirmar`, json('POST'))
export const recusarRodada = (rodadaId: string) =>
  chamar<RodadaEquipe>(`/api/equipe/rodadas/${enc(rodadaId)}/recusar`, json('POST'))
/** Rodada que foi direto para a produção, dentro da janela de cancelamento. */
export const cancelarRodada = (rodadaId: string) =>
  chamar<RodadaEquipe>(`/api/equipe/rodadas/${enc(rodadaId)}/cancelar`, json('POST'))
export const entregarRodada = (rodadaId: string) =>
  chamar<RodadaEquipe>(`/api/equipe/rodadas/${enc(rodadaId)}/entregar`, json('POST'))

// Produção (cozinha, bar)
export const buscarProducao = (estacao?: string) =>
  chamar<FilaProducao>(`/api/equipe/producao${estacao ? `?estacao=${enc(estacao)}` : ''}`)
export const mudarItemProducao = (id: string, status: StatusProducao) =>
  chamar<{ ok: true }>(`/api/equipe/producao/itens/${enc(id)}`, json('PATCH', { status }))
export const mudarRodadaProducao = (id: string, estacao: string, status: StatusProducao) =>
  chamar<{ ok: true }>(`/api/equipe/producao/rodadas/${enc(id)}`, json('PATCH', { estacao, status }))

// Push
export const chavePush = () => chamar<{ chavePublica: string | null }>('/api/equipe/push/chave')
export const inscreverPush = (inscricao: PushSubscriptionJSON) =>
  chamar<null>('/api/equipe/push/inscricoes', json('POST', inscricao))

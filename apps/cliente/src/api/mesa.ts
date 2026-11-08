// Chamadas da mesa (sessão, carrinho compartilhado, pedido e chamado).
// O cookie `dispositivo` identifica o celular; vai junto por ser mesma origem.
import type { ItemCarrinho } from '../carrinho/carrinho'
import { ErroMesaNaoEncontrada, ErroRede } from './cardapio'
import type { CarrinhoPublico, RodadaPublica, RodadasDaMesa } from './tipos'

/** O celular não está na sessão aberta da mesa (cookie perdido ou mesa fechada). */
export class ErroForaDaSessao extends Error {}

/** O garçom fechou a conta da sessão deste celular: mostra o agradecimento. */
export class ErroContaFechada extends Error {}

/** Recusa do servidor com mensagem para mostrar (409/422/404). */
export class ErroPedido extends Error {
  readonly pratoIds: string[]

  constructor(mensagem: string, pratoIds: string[] = []) {
    super(mensagem)
    this.pratoIds = pratoIds
  }
}

type CorpoErro = { mensagem?: string; codigo?: string; pratoIds?: string[] }

const base = (token: string) => `/api/publico/mesas/${encodeURIComponent(token)}`

async function lerJson(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json()
  } catch {
    return null
  }
}

async function requisitar(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (erro) {
    throw new ErroRede(String(erro))
  }
}

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await requisitar(url, init)
  if (resposta.ok) return (await lerJson(resposta)) as T
  const corpo = ((await lerJson(resposta)) ?? {}) as CorpoErro
  if (resposta.status === 403 && corpo.codigo === 'CONTA_FECHADA') {
    throw new ErroContaFechada(corpo.mensagem)
  }
  if (resposta.status === 403 && corpo.codigo === 'FORA_DA_SESSAO') {
    throw new ErroForaDaSessao(corpo.mensagem)
  }
  if ([404, 409, 422].includes(resposta.status) && corpo.mensagem) {
    throw new ErroPedido(corpo.mensagem, corpo.pratoIds)
  }
  throw new ErroRede(`HTTP ${resposta.status}`)
}

const json = (method: string, corpo?: unknown): RequestInit => ({
  method,
  headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
  body: corpo === undefined ? undefined : JSON.stringify(corpo),
})

/** Fora da sessão: entra de novo e repete uma vez. */
async function naMesa<T>(token: string, caminho: string, init?: RequestInit): Promise<T> {
  try {
    return await chamar<T>(base(token) + caminho, init)
  } catch (erro) {
    if (!(erro instanceof ErroForaDaSessao)) throw erro
    await entrarNaMesa(token)
    return chamar<T>(base(token) + caminho, init)
  }
}

export async function entrarNaMesa(token: string): Promise<{ dispositivoConfirmado: boolean }> {
  const resposta = await requisitar(`${base(token)}/entrar`, { method: 'POST' })
  // 400: token malformado recusado pelo servidor; para o cliente é a mesma coisa.
  if (resposta.status === 404 || resposta.status === 400) throw new ErroMesaNaoEncontrada()
  if (!resposta.ok) throw new ErroRede(`HTTP ${resposta.status}`)
  return (await lerJson(resposta)) as { dispositivoConfirmado: boolean }
}

export const buscarCarrinho = (token: string) => naMesa<CarrinhoPublico>(token, '/carrinho')

export const adicionarAoCarrinho = (
  token: string,
  item: Pick<ItemCarrinho, 'pratoId' | 'selecao' | 'observacao' | 'quantidade'>,
) => naMesa<CarrinhoPublico>(token, '/carrinho/itens', json('POST', item))

export const alterarQuantidade = (token: string, id: string, quantidade: number) =>
  naMesa<CarrinhoPublico>(token, `/carrinho/itens/${encodeURIComponent(id)}`, json('PATCH', { quantidade }))

export const removerDoCarrinho = (token: string, id: string) =>
  naMesa<CarrinhoPublico>(token, `/carrinho/itens/${encodeURIComponent(id)}`, json('DELETE'))

export const enviarPedido = (token: string) => naMesa<RodadaPublica>(token, '/rodadas', json('POST'))

export const buscarRodadas = (token: string) => naMesa<RodadasDaMesa>(token, '/rodadas')

export const chamarAtendente = (token: string) => naMesa<{ ok: true }>(token, '/chamados', json('POST'))

/** Sessão de equipe no navegador (garçom abrindo a etiqueta da mesa). */
export async function souEquipe(): Promise<boolean> {
  try {
    const resposta = await fetch('/api/equipe/eu')
    return resposta.ok
  } catch {
    return false
  }
}

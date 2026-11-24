import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { ErroMesaNaoEncontrada, ErroRede } from './cardapio'
import {
  adicionarAoCarrinho,
  buscarRodadas,
  chamarAtendente,
  enviarPedido,
  entrarNaMesa,
  ErroContaFechada,
  ErroForaDaSessao,
  ErroPedido,
  souEquipe,
} from './mesa'

const MIX = { pratoId: 'mix', selecao: {}, observacao: '', quantidade: 1 }
const fora = () => ({ status: 403, corpo: { mensagem: 'Entre na mesa novamente', codigo: 'FORA_DA_SESSAO' } })

describe('api da mesa', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    vi.stubGlobal('fetch', api.fetch)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('entrarNaMesa faz POST em /entrar', async () => {
    await entrarNaMesa('tok')
    expect(api.chamadas('POST', /\/api\/publico\/mesas\/tok\/entrar$/)).toHaveLength(1)
  })

  it('entrarNaMesa com mesa inexistente lança ErroMesaNaoEncontrada', async () => {
    api.uma('POST', /entrar$/, () => ({ status: 404, corpo: { mensagem: 'Mesa não encontrada' } }))
    await expect(entrarNaMesa('tok')).rejects.toBeInstanceOf(ErroMesaNaoEncontrada)
  })

  it('fora da sessão entra de novo e repete a ação', async () => {
    api.uma('POST', /carrinho\/itens$/, fora)
    const carrinho = await adicionarAoCarrinho('tok', MIX)
    expect(carrinho.itens).toHaveLength(1)
    expect(api.chamadas('POST', /entrar$/)).toHaveLength(1)
    expect(api.chamadas('POST', /carrinho\/itens$/)).toHaveLength(2)
  })

  it('fora da sessão duas vezes lança ErroForaDaSessao', async () => {
    api.uma('POST', /chamados$/, fora)
    api.uma('POST', /chamados$/, fora)
    await expect(chamarAtendente('tok')).rejects.toBeInstanceOf(ErroForaDaSessao)
  })

  it('409 vira ErroPedido com a mensagem e os pratos', async () => {
    api.uma('POST', /rodadas$/, () => ({ status: 409, corpo: { mensagem: 'Mix da Casa esgotou', pratoIds: ['mix'] } }))
    const erro: unknown = await enviarPedido('tok').catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroPedido)
    expect(erro).toMatchObject({ message: 'Mix da Casa esgotou', pratoIds: ['mix'] })
  })

  it('422 vira ErroPedido', async () => {
    await expect(enviarPedido('tok')).rejects.toMatchObject({ message: 'Carrinho vazio' })
  })

  it('falha de rede vira ErroRede', async () => {
    api.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(chamarAtendente('tok')).rejects.toBeInstanceOf(ErroRede)
  })

  it('souEquipe reflete /equipe/eu', async () => {
    expect(await souEquipe()).toBe(false)
    api.estado.equipe = true
    expect(await souEquipe()).toBe(true)
  })

  it('souEquipe sem rede é false', async () => {
    api.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await souEquipe()).toBe(false)
  })

  it('CONTA_FECHADA não tenta entrar de novo', async () => {
    api.estado.contaFechada = true
    await expect(buscarRodadas('tok')).rejects.toBeInstanceOf(ErroContaFechada)
    expect(api.chamadas('POST', /\/entrar$/)).toHaveLength(0)
  })
})

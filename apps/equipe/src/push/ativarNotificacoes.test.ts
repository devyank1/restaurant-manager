import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ana, criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { ativarNotificacoes, chaveParaBytes, estadoNotificacoes } from './ativarNotificacoes'

// Chave pública VAPID de exemplo (65 bytes em base64url).
const CHAVE = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'

function instalarNavegador(permissaoFinal: NotificationPermission) {
  const inscricao = {
    toJSON: () => ({ endpoint: 'https://push.exemplo/abc', keys: { p256dh: 'p', auth: 'a' } }),
  }
  const subscribe = vi.fn().mockResolvedValue(inscricao)
  const registro = { pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe } }
  vi.stubGlobal('PushManager', class {})
  const Notificacao = { permission: 'default' as NotificationPermission, requestPermission: vi.fn() }
  Notificacao.requestPermission.mockImplementation(async () => {
    Notificacao.permission = permissaoFinal
    return permissaoFinal
  })
  vi.stubGlobal('Notification', Notificacao)
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registro), register: vi.fn() },
  })
  return { subscribe, Notificacao }
}

describe('ativarNotificacoes', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...ana }
    vi.stubGlobal('fetch', api.fetch)
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('sem PushManager → sem-suporte', async () => {
    expect(estadoNotificacoes()).toBe('sem-suporte')
    expect(await ativarNotificacoes()).toBe('sem-suporte')
    expect(api.fetch).not.toHaveBeenCalled()
  })

  it('chave vazia → sem-chave', async () => {
    instalarNavegador('granted')
    api.estado.chavePush = null
    expect(await ativarNotificacoes()).toBe('sem-chave')
  })

  it('permissão negada → negado', async () => {
    const { subscribe } = instalarNavegador('denied')
    api.estado.chavePush = CHAVE
    expect(await ativarNotificacoes()).toBe('negado')
    expect(subscribe).not.toHaveBeenCalled()
    expect(estadoNotificacoes()).toBe('negado')
  })

  it('assina com a chave e envia a inscrição', async () => {
    const { subscribe } = instalarNavegador('granted')
    api.estado.chavePush = CHAVE
    expect(await ativarNotificacoes()).toBe('ativado')
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(CHAVE) })
    const [, init] = api.chamadas('POST', /\/api\/equipe\/push\/inscricoes$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      endpoint: 'https://push.exemplo/abc',
      keys: { p256dh: 'p', auth: 'a' },
    })
    expect(estadoNotificacoes()).toBe('ativado')
  })

  it('pede a permissão antes de qualquer rede (iPhone exige o toque direto)', async () => {
    const { Notificacao } = instalarNavegador('granted')
    api.estado.chavePush = CHAVE
    let fetchAntes = -1
    Notificacao.requestPermission.mockImplementation(async () => {
      fetchAntes = api.fetch.mock.calls.length
      Notificacao.permission = 'granted'
      return 'granted'
    })
    expect(await ativarNotificacoes()).toBe('ativado')
    expect(fetchAntes).toBe(0)
  })

  it('chaveParaBytes decodifica base64url', () => {
    expect(chaveParaBytes(CHAVE)).toHaveLength(65)
    expect(chaveParaBytes(CHAVE)[0]).toBe(4)
  })
})

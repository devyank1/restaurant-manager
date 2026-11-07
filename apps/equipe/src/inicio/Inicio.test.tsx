import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ana, criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { chamado, mesasDemo } from '../test/fixtures'
import { ultimoSocket } from '../test/socket-falso'
import Inicio from './Inicio'

describe('Início', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...ana, emTurno: true }
    api.estado.mesas = mesasDemo
    vi.stubGlobal('fetch', api.fetch)
  })

  const renderizar = () => render(<Inicio usuario={{ ...ana, emTurno: true }} />)
  const lista = () => screen.getByRole('list', { name: 'Chamados' })

  it('mostra os chamados do garçom com o tipo certo', async () => {
    api.estado.chamados = [
      chamado({ id: 'c1', tipo: 'ATENDENTE' }),
      chamado({ id: 'c2', tipo: 'CONFIRMAR_RODADA', mesa: { numero: 8, token: 'tok8' }, paraTodos: true, tentativas: 3 }),
    ]
    renderizar()
    expect(await screen.findByText('Chamou o atendente')).toBeInTheDocument()
    const itens = within(lista()).getAllByRole('listitem')
    expect(itens).toHaveLength(2)
    expect(within(itens[0]).getByText('Mesa 7')).toBeInTheDocument()
    expect(within(itens[0]).getByText('há 2 min')).toBeInTheDocument()
    expect(within(itens[1]).getByText('Novo pedido para confirmar')).toBeInTheDocument()
    expect(within(itens[1]).getByText('Para todos')).toBeInTheDocument()
    expect(within(itens[1]).getByText('Repassado')).toBeInTheDocument()
  })

  it('sem chamados mostra que está tudo em dia', async () => {
    renderizar()
    expect(await screen.findByText('Nenhum chamado agora')).toBeInTheDocument()
  })

  it('tocar no chamado marca lido', async () => {
    api.estado.chamados = [chamado({ id: 'c1' })]
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: /Mesa 7.*Chamou o atendente/ }))
    expect(api.chamadas('POST', /\/api\/equipe\/chamados\/c1\/lido$/)).toHaveLength(1)
  })

  it('chamado de pedido abre a mesa', async () => {
    api.estado.chamados = [chamado({ id: 'c2', tipo: 'CONFIRMAR_RODADA' })]
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: /Novo pedido para confirmar/ }))
    expect(window.location.pathname).toBe('/mesa/tok7')
  })

  it('Atendido resolve', async () => {
    api.estado.chamados = [chamado({ id: 'c1' })]
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Atendido' }))
    expect(api.chamadas('POST', /\/api\/equipe\/chamados\/c1\/resolver$/)).toHaveLength(1)
    expect(await screen.findByText('Nenhum chamado agora')).toBeInTheDocument()
  })

  it('chamado de outro garçom (403) recarrega a lista', async () => {
    api.estado.chamados = [chamado({ id: 'c1' })]
    api.uma('POST', /\/lido$/, () => {
      api.estado.chamados = []
      return { status: 403, corpo: { mensagem: 'Este chamado é de outro garçom' } }
    })
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: /Chamou o atendente/ }))
    expect(await screen.findByText('Nenhum chamado agora')).toBeInTheDocument()
  })

  it('evento chamados-mudaram recarrega a lista', async () => {
    renderizar()
    await screen.findByText('Nenhum chamado agora')
    api.estado.chamados = [chamado({ id: 'c9' })]
    act(() => ultimoSocket().servidor('chamados-mudaram'))
    expect(await screen.findByText('Chamou o atendente')).toBeInTheDocument()
  })

  it('desbloquear o celular refaz a conexão e recarrega', async () => {
    renderizar()
    await screen.findByText('Nenhum chamado agora')
    const socket = ultimoSocket()
    api.estado.chamados = [chamado({ id: 'c9' })]
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(socket.reconexoes).toBe(1)
    expect(await screen.findByText('Chamou o atendente')).toBeInTheDocument()
  })

  it('toda conexão do socket recarrega chamados', async () => {
    renderizar()
    await screen.findByText('Nenhum chamado agora')
    api.estado.chamados = [chamado({ id: 'c9' })]
    act(() => ultimoSocket().servidor('connect'))
    expect(await screen.findByText('Chamou o atendente')).toBeInTheDocument()
  })

  it('minhas mesas mostra só as minhas com pendentes', async () => {
    renderizar()
    const minhas = await screen.findByRole('region', { name: 'Minhas mesas' })
    await waitFor(() => expect(within(minhas).getByText('Mesa 7')).toBeInTheDocument())
    expect(within(minhas).getByText('1 aguardando')).toBeInTheDocument()
    expect(within(minhas).queryByText('Mesa 8')).not.toBeInTheDocument()
  })

  it('Todas as mesas leva à lista', async () => {
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Todas as mesas' }))
    expect(window.location.pathname).toBe('/mesas')
  })

  it('notificação bloqueada aparece no início', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: new Promise(() => {}) } })
    renderizar()
    expect(await screen.findByText('Notificações bloqueadas no navegador')).toBeInTheDocument()
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('notificação ainda não pedida mostra Ativar notificações', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: new Promise(() => {}) } })
    renderizar()
    expect(await screen.findByRole('button', { name: 'Ativar notificações' })).toBeInTheDocument()
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('resposta antiga que chega depois não apaga a lista nova', async () => {
    renderizar()
    await screen.findByText('Nenhum chamado agora')
    let soltarAntiga: (r: { status: number; corpo: unknown }) => void = () => {}
    api.uma('GET', /\/api\/equipe\/chamados$/, () => new Promise((ok) => (soltarAntiga = ok)))
    api.uma('GET', /\/api\/equipe\/chamados$/, () => ({ status: 200, corpo: [chamado({ id: 'c9' })] }))
    act(() => ultimoSocket().servidor('chamados-mudaram'))
    act(() => ultimoSocket().servidor('chamados-mudaram'))
    expect(await screen.findByText('Chamou o atendente')).toBeInTheDocument()
    await act(async () => soltarAntiga({ status: 200, corpo: [] }))
    expect(screen.getByText('Chamou o atendente')).toBeInTheDocument()
  })

  it('navegador sem push avisa que as notificações não chegam', async () => {
    renderizar()
    expect(await screen.findByText(/Notificações indisponíveis neste navegador/)).toBeInTheDocument()
  })

  it('sem Web NFC não mostra Ler etiqueta', async () => {
    renderizar()
    await screen.findByText('Nenhum chamado agora')
    expect(screen.queryByRole('button', { name: /Ler etiqueta/ })).not.toBeInTheDocument()
  })
})

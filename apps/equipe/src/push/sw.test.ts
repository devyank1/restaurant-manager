// Roda public/sw.js com um `self` falso e confere o toque na notificação.
import codigoSw from '../../public/sw.js?raw'
import { describe, expect, it, vi } from 'vitest'

type Ouvinte = (evento: unknown) => void

function carregarSw(janelas: { url: string; focus: () => Promise<unknown>; navigate?: (u: string) => Promise<unknown>; postMessage?: (m: unknown) => void }[]) {
  const ouvintes: Record<string, Ouvinte> = {}
  const openWindow = vi.fn().mockResolvedValue(null)
  const self = {
    location: { origin: 'https://casa.ts.net:8443' },
    addEventListener: (nome: string, f: Ouvinte) => (ouvintes[nome] = f),
    skipWaiting: vi.fn(),
    registration: { showNotification: vi.fn() },
    clients: { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue(janelas), openWindow },
  }
  new Function('self', codigoSw)(self)
  const tocar = async (url: string) => {
    let espera: Promise<unknown> = Promise.resolve()
    ouvintes.notificationclick({
      notification: { close: vi.fn(), data: { url } },
      waitUntil: (p: Promise<unknown>) => (espera = p),
    })
    await espera
  }
  return { tocar, openWindow }
}

describe('service worker: toque na notificação', () => {
  it('sem janela aberta, abre a mesa', async () => {
    const { tocar, openWindow } = carregarSw([])
    await tocar('/mesa/tok7')
    expect(openWindow).toHaveBeenCalledWith('https://casa.ts.net:8443/mesa/tok7')
  })

  it('com janela aberta, foca e pede para ela ir à mesa sem recarregar', async () => {
    const janela = { url: 'https://casa.ts.net:8443/', focus: vi.fn(), postMessage: vi.fn() }
    janela.focus.mockResolvedValue(janela)
    const { tocar, openWindow } = carregarSw([janela])
    await tocar('/mesa/tok7')
    expect(janela.postMessage).toHaveBeenCalledWith({ tipo: 'abrir', url: '/mesa/tok7' })
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('se focar falhar, abre uma janela nova', async () => {
    const janela = { url: 'https://casa.ts.net:8443/', focus: vi.fn().mockRejectedValue(new Error('x')), postMessage: vi.fn() }
    const { tocar, openWindow } = carregarSw([janela])
    await tocar('/mesa/tok7')
    expect(openWindow).toHaveBeenCalledWith('https://casa.ts.net:8443/mesa/tok7')
  })
})

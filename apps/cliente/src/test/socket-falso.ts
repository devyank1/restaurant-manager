// Substitui `socket.io-client` nos testes (vi.mock em setup.ts).
type Ouvinte = (dados?: unknown) => void

export class SocketFalso {
  private ouvintes = new Map<string, Ouvinte[]>()
  emitidos: { evento: string; dados: unknown }[] = []
  desconectado = false

  on(evento: string, ouvinte: Ouvinte) {
    this.ouvintes.set(evento, [...(this.ouvintes.get(evento) ?? []), ouvinte])
    return this
  }

  off() {
    return this
  }

  emit(evento: string, dados?: unknown) {
    this.emitidos.push({ evento, dados })
    return this
  }

  disconnect() {
    this.desconectado = true
    return this
  }

  /** Simula um evento vindo do servidor (inclui `connect`). */
  servidor(evento: string, dados?: unknown) {
    for (const ouvinte of this.ouvintes.get(evento) ?? []) ouvinte(dados)
  }
}

export const socketsFalsos: SocketFalso[] = []

export function io(): SocketFalso {
  const socket = new SocketFalso()
  socketsFalsos.push(socket)
  return socket
}

/** O socket aberto mais recente (o da tela montada). */
export function ultimoSocket(): SocketFalso {
  const socket = socketsFalsos.at(-1)
  if (!socket) throw new Error('nenhum socket aberto')
  return socket
}

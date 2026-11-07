// Web NFC (só Chrome do Android). O caminho principal é outro: encostar o
// celular na etiqueta abre /m/<token> e o app do cliente redireciona a equipe.

type RegistroNdef = { recordType: string; data?: DataView | ArrayBuffer | Uint8Array }
type LeituraNdef = { message: { records: RegistroNdef[] } }
type LeitorNdef = {
  onreading: ((evento: LeituraNdef) => void) | null
  onreadingerror: (() => void) | null
  scan(opcoes?: { signal?: AbortSignal }): Promise<void>
}

declare global {
  interface Window {
    NDEFReader?: new () => LeitorNdef
  }
}

export function suportaNfc(): boolean {
  return typeof window.NDEFReader === 'function'
}

export function tokenDaUrl(url: string): string | null {
  return /\/m\/([^/?#]+)/.exec(url)?.[1] ?? null
}

function texto(dados: RegistroNdef['data']): string {
  if (!dados) return ''
  const bytes = dados instanceof DataView ? new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength) : dados
  return new TextDecoder().decode(bytes)
}

/** Espera o garçom encostar numa etiqueta e devolve o token da mesa. */
export async function lerEtiqueta(): Promise<string | null> {
  const Leitor = window.NDEFReader
  if (!Leitor) return null
  const leitor = new Leitor()
  const parar = new AbortController()
  return new Promise<string>((resolver, rejeitar) => {
    leitor.onreading = (evento) => {
      for (const registro of evento.message.records) {
        if (registro.recordType !== 'url') continue
        const token = tokenDaUrl(texto(registro.data))
        if (token) {
          parar.abort()
          resolver(token)
          return
        }
      }
    }
    leitor.onreadingerror = () => rejeitar(new Error('Não consegui ler a etiqueta. Tente de novo.'))
    leitor.scan({ signal: parar.signal }).catch(rejeitar)
  })
}

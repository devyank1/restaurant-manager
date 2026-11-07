import { afterEach, describe, expect, it, vi } from 'vitest'
import { lerEtiqueta, suportaNfc, tokenDaUrl } from './lerEtiqueta'

/** NDEFReader falso: `scan()` resolve e, em seguida, "lê" os registros dados. */
function instalarLeitor(registros: { recordType: string; texto: string }[]) {
  class LeitorFalso {
    onreading: ((evento: unknown) => void) | null = null
    onreadingerror: (() => void) | null = null
    async scan() {
      setTimeout(() =>
        this.onreading?.({
          message: {
            records: registros.map((r) => ({ recordType: r.recordType, data: new TextEncoder().encode(r.texto) })),
          },
        }),
      )
    }
  }
  vi.stubGlobal('NDEFReader', LeitorFalso)
}

describe('lerEtiqueta', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tokenDaUrl pega o token de /m/<token>', () => {
    expect(tokenDaUrl('https://casa.ts.net/m/pY3ctIV2EM2O-YGGKGSnMw')).toBe('pY3ctIV2EM2O-YGGKGSnMw')
    expect(tokenDaUrl('http://192.168.1.9:5173/m/abc?x=1')).toBe('abc')
    expect(tokenDaUrl('https://outro.site/qualquer')).toBeNull()
  })

  it('sem Web NFC → sem suporte e null', async () => {
    expect(suportaNfc()).toBe(false)
    expect(await lerEtiqueta()).toBeNull()
  })

  it('extrai o token da URL lida', async () => {
    instalarLeitor([{ recordType: 'url', texto: 'https://casa.ts.net/m/tok7' }])
    expect(suportaNfc()).toBe(true)
    expect(await lerEtiqueta()).toBe('tok7')
  })
})

// Tela da produção fica aberta horas num tablet/TV: avisa pedido novo com som
// e não deixa a tela apagar. O navegador só libera som depois de um toque.

let contexto: AudioContext | null = null

/** Chamar num toque (botão "Ativar som"). Devolve se o aparelho tem som. */
export function liberarSom(): boolean {
  const Contexto = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Contexto) return false
  try {
    contexto ??= new Contexto()
    void contexto.resume()
    return true
  } catch {
    return false
  }
}

/** Dois tons curtos (pedido novo). Sem som liberado, não faz nada. */
export function tocarBipe(): void {
  if (!contexto) return
  const inicio = contexto.currentTime
  for (const [frequencia, atraso] of [
    [880, 0],
    [1320, 0.18],
  ]) {
    const oscilador = contexto.createOscillator()
    const volume = contexto.createGain()
    oscilador.frequency.value = frequencia
    volume.gain.setValueAtTime(0.25, inicio + atraso)
    volume.gain.exponentialRampToValueAtTime(0.001, inicio + atraso + 0.15)
    oscilador.connect(volume).connect(contexto.destination)
    oscilador.start(inicio + atraso)
    oscilador.stop(inicio + atraso + 0.16)
  }
}

type Trava = { release: () => Promise<void> }
type ComWakeLock = { wakeLock?: { request: (tipo: 'screen') => Promise<Trava> } }

/**
 * Mantém a tela ligada enquanto a página estiver aberta (Wake Lock). O
 * navegador solta a trava quando a aba some; ao voltar, pede de novo.
 * Devolve a função que solta tudo.
 */
export function manterTelaLigada(): () => void {
  const wakeLock = (navigator as ComWakeLock).wakeLock
  if (!wakeLock) return () => undefined
  let trava: Trava | null = null
  let ativo = true
  const pedir = () => {
    if (!ativo || document.visibilityState !== 'visible') return
    wakeLock.request('screen').then(
      (nova) => {
        trava = nova
      },
      () => undefined,
    )
  }
  pedir()
  document.addEventListener('visibilitychange', pedir)
  return () => {
    ativo = false
    document.removeEventListener('visibilitychange', pedir)
    void trava?.release().catch(() => undefined)
  }
}

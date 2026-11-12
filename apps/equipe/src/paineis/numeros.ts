// Números digitados nas telas de metas (pt-BR: "1.500,50").

/** Reais digitados → centavos; inválido ou ≤ 0 → null. */
export function lerReais(texto: string): number | null {
  const t = texto.replace(/R\$/g, '').trim()
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(t)) return null
  const [inteiro, decimal = ''] = t.replace(/\./g, '').split(',')
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'))
  return centavos > 0 && Number.isSafeInteger(centavos) ? centavos : null
}

/** Inteiro de `min` a `max`; senão null. */
export function lerInteiro(texto: string, min: number, max: number): number | null {
  const t = texto.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n >= min && n <= max ? n : null
}

/** Centavos → texto para o campo ("800" ou "800,50"). */
export function reaisNoCampo(centavos: number): string {
  const resto = centavos % 100
  const reais = Math.floor(centavos / 100)
  return resto === 0 ? String(reais) : `${reais},${String(resto).padStart(2, '0')}`
}

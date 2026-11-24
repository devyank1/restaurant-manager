// Quantidades do estoque: o servidor guarda na unidade base (un, g, ml).
// A tela aceita g/kg e ml/L e mostra "1,5 kg". Espelha
// apps/api/src/estoque/quantidade.ts (mesmos casos de teste).

export type Unidade = 'UN' | 'G' | 'ML'
export type UnidadeDigitada = 'un' | 'g' | 'kg' | 'ml' | 'L'

const FATOR: Record<UnidadeDigitada, number> = { un: 1, g: 1, kg: 1000, ml: 1, L: 1000 }

export function unidadesDe(u: Unidade): UnidadeDigitada[] {
  if (u === 'G') return ['g', 'kg']
  if (u === 'ML') return ['ml', 'L']
  return ['un']
}

function numero(valor: number): string {
  return String(Math.round(valor * 1000) / 1000).replace('.', ',')
}

/** Teto de qualquer quantidade (igual ao da API). */
export const QUANTIDADE_MAXIMA = 1_000_000_000

/** Texto digitado → número. Ponto seguido de 3 dígitos é milhar ("1.500"); vírgula é decimal. */
function lerNumero(texto: string): number | null {
  let t = texto.trim()
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '')
  t = t.replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

/** "1,5" em kg → 1500. Inválido, ≤ 0, fração de unidade ou acima do teto → null (zero só com `aceitaZero`). */
export function paraBase(texto: string, digitada: UnidadeDigitada, aceitaZero = false): number | null {
  const n = lerNumero(texto)
  if (n === null) return null
  if (digitada === 'un' && !Number.isInteger(n)) return null
  const base = Math.round(n * FATOR[digitada])
  if (base < 0 || (base === 0 && !aceitaZero) || base > QUANTIDADE_MAXIMA) return null
  return base
}

/** Base → número na unidade escolhida, para preencher o campo ("1,5"). */
export function daBase(base: number, digitada: UnidadeDigitada): string {
  return numero(base / FATOR[digitada])
}

/** Unidade digitada que fica melhor para mostrar a quantidade. */
export function melhorUnidade(base: number, u: Unidade): UnidadeDigitada {
  if (u === 'G') return base >= 1000 ? 'kg' : 'g'
  if (u === 'ML') return base >= 1000 ? 'L' : 'ml'
  return 'un'
}

export function formatarQuantidade(base: number, u: Unidade): string {
  if (base < 0) return '0 (conferir)'
  const digitada = melhorUnidade(base, u)
  return `${daBase(base, digitada)} ${digitada}`
}

const NOMES: Record<UnidadeDigitada, [string, string]> = {
  un: ['unidade', 'unidades'],
  g: ['grama', 'gramas'],
  kg: ['quilo', 'quilos'],
  ml: ['mililitro', 'mililitros'],
  L: ['litro', 'litros'],
}

/** Para leitor de tela: "1,5 quilo", "30 unidades". */
export function falarQuantidade(base: number, u: Unidade): string {
  if (base < 0) return 'zero, conferir'
  const digitada = melhorUnidade(base, u)
  const valor = base / FATOR[digitada]
  const [um, varios] = NOMES[digitada]
  return `${numero(valor)} ${valor >= 2 ? varios : um}`
}

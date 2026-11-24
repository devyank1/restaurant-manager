// Números das metas: o que se digita (pt-BR: "1.500,50") e o que se mostra.
import { formatarReais } from '@cardapio/opcoes'
import type { MetaBatida, PeriodoMeta, ProgressoMeta } from '../api/tipos'

const horaSP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
})

/** "Em turno desde 18:00" ou "Fora do turno". */
export function textoTurno(emTurno: boolean, desde: string | null): string {
  return emTurno && desde ? `Em turno desde ${horaSP.format(new Date(desde))}` : 'Fora do turno'
}

const mesas = (n: number) => `${n} ${n === 1 ? 'mesa' : 'mesas'}`

export const textoPeriodo = (p: PeriodoMeta) => (p === 'DIA' ? 'hoje' : 'na semana')

/** "R$ 1.200,00 de R$ 2.000,00", "6 de 10 mesas", "82% no tempo · meta 85%"… */
export function textoMeta(m: ProgressoMeta): string {
  switch (m.tipo) {
    case 'VALOR':
      return `${formatarReais(m.atual)} de ${formatarReais(m.alvo)}`
    case 'MESAS':
      return `${m.atual} de ${mesas(m.alvo)}`
    case 'NO_TEMPO':
      return `${m.atual}% no tempo · meta ${m.alvo}%`
    case 'ESQUECIDOS':
      if (m.atual > 0) return `${m.atual} ${m.atual === 1 ? 'esquecido' : 'esquecidos'}`
      return m.batida ? 'Nenhum esquecido' : 'Nenhum esquecido até agora'
  }
}

/** "R$ 2.000,00 hoje", "30 mesas na semana". */
export function textoAlvo(m: MetaBatida): string {
  const quanto =
    m.tipo === 'VALOR'
      ? formatarReais(m.alvo)
      : m.tipo === 'MESAS'
        ? mesas(m.alvo)
        : m.tipo === 'NO_TEMPO'
          ? `${m.alvo}% no tempo`
          : 'nenhum esquecido'
  return `${quanto} ${textoPeriodo(m.periodo)}`
}

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

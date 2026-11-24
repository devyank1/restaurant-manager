import { formatarReais } from '@cardapio/opcoes'
import type { MetaValor, TipoPessoa } from '../api/tipos'

export const NOME_TIPO: Record<TipoPessoa, string> = { VALOR: 'Valor vendido', MESAS: 'Mesas atendidas' }

/** "R$ 800,00 por dia" / "30 mesas por semana". */
export function textoMetaValor(tipo: TipoPessoa, v: NonNullable<MetaValor>): string {
  const quanto = tipo === 'VALOR' ? formatarReais(v.alvo) : `${v.alvo} ${v.alvo === 1 ? 'mesa' : 'mesas'}`
  return `${quanto} por ${v.periodo === 'DIA' ? 'dia' : 'semana'}`
}

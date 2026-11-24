// Valor de um CampoQuantidade e como ler/preencher na unidade base.
import type { Unidade } from '../api/tipos'
import { daBase, melhorUnidade, paraBase, unidadesDe, type UnidadeDigitada } from './unidades'

/** O que a pessoa digitou: texto + unidade escolhida (kg, g, L…). */
export type ValorCampo = { texto: string; digitada: UnidadeDigitada }

export const campoVazio = (unidade: Unidade): ValorCampo => ({ texto: '', digitada: unidadesDe(unidade)[0] })

/** Preenche o campo com uma quantidade na unidade base, na melhor unidade. */
export function campoDe(base: number, unidade: Unidade): ValorCampo {
  const digitada = melhorUnidade(Math.max(base, 0), unidade)
  return { texto: daBase(Math.max(base, 0), digitada), digitada }
}

/** Unidade digitada válida para a medida (trocou de "peso" para "volume"). */
export function digitadaDe(valor: ValorCampo, unidade: Unidade): UnidadeDigitada {
  const opcoes = unidadesDe(unidade)
  return opcoes.includes(valor.digitada) ? valor.digitada : opcoes[0]
}

/** Quantidade na unidade base; inválida → null. */
export function lerCampo(valor: ValorCampo, unidade: Unidade, aceitaZero = false): number | null {
  return paraBase(valor.texto, digitadaDe(valor, unidade), aceitaZero)
}

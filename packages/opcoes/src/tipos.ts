// Espelho de apps/api/src/cardapio-publico/cardapio-publico.types.ts — manter em sincronia.
export type OpcaoPublica = {
  id: string
  nome: string
  precoCentavos: number
  precoPromocionalCentavos: number | null
}

export type GrupoOpcaoPublico = {
  id: string
  nome: string
  tipo: 'UNICA' | 'MULTIPLA' | 'SABORES'
  obrigatorio: boolean
  min: number
  max: number
  opcoes: OpcaoPublica[]
}

export type PratoPublico = {
  id: string
  nome: string
  descricao: string
  precoCentavos: number
  precoPromocionalCentavos: number | null
  destaque: boolean
  esgotado: boolean
  videoUrl: string | null
  posterUrl: string | null
  grupos: GrupoOpcaoPublico[]
}

import type { Selecao } from './preco'

/** O que o seletor devolve: um item pronto para o carrinho ou para a rodada. */
export type ItemEscolhido = {
  pratoId: string
  nome: string
  resumoOpcoes: string
  selecao: Selecao
  observacao: string
  quantidade: number
  precoUnitarioCentavos: number
}

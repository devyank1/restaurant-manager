import type { PratoPublico } from '@cardapio/opcoes'
import type { ItemCarrinho } from '../carrinho/carrinho'

// Espelho de apps/api/src/cardapio-publico/cardapio-publico.types.ts — manter em sincronia.
// Os tipos de prato moram em @cardapio/opcoes (compartilhado com o app da equipe).
export type { GrupoOpcaoPublico, OpcaoPublica, PratoPublico } from '@cardapio/opcoes'

export type CategoriaPublica = {
  id: string
  nome: string
  pratos: PratoPublico[]
}

export type CardapioPublico = {
  restaurante: {
    nome: string
    logoUrl: string | null
    googleAvaliacaoUrl: string | null
    // null quando o restaurante não configurou o Wi-Fi.
    wifi: { ssid: string; senha: string | null } | null
  }
  mesa: { numero: number }
  // Ordenadas por `ordem`; categorias sem pratos ficam de fora.
  categorias: CategoriaPublica[]
}

// Espelho de apps/api/src/carrinho/carrinho.types.ts e rodadas.types.ts.
export type CarrinhoPublico = {
  itens: ItemCarrinho[]
  totalCentavos: number
  // Cresce a cada leitura no servidor; foto com versão menor é mais velha.
  versao: number
}

export type RodadaPublica = {
  id: string
  status: 'AGUARDANDO_GARCOM' | 'CONFIRMADA' | 'CANCELADA'
  /** Andamento calculado pela API a partir dos itens. */
  fase: 'AGUARDANDO_GARCOM' | 'NA_COZINHA' | 'PRONTO' | 'ENTREGUE' | 'CANCELADA'
  criadoEm: string
  totalCentavos: number
  itens: {
    nome: string
    resumoOpcoes: string
    observacao: string
    quantidade: number
    precoUnitarioCentavos: number
  }[]
}

export type RodadasDaMesa = {
  rodadas: RodadaPublica[]
  // Soma só das rodadas confirmadas.
  totalParcialCentavos: number
  // Chamado de atendente ainda não resolvido (aviso "Garçom chamado!").
  chamadoAberto: boolean
}
